import {
  isMilitaryAdsbRecord,
  isMilitaryIcaoRange,
  normalizeIcaoAddress,
} from '../../../src/sources/civilianTraffic.js';
import { readResponseJsonCapped } from './http.js';

/**
 * Server-side civilian filter for aircraft feeds. Military aircraft are
 * recognised two ways: reserved address blocks (offline, always applied) and
 * the addresses adsb.lol currently lists as military (refreshed while flights
 * are being served). The list only improves on the blocks, so a failed
 * refresh never leaves the feed unfiltered.
 */
const MILITARY_LIST_URL = 'https://api.adsb.lol/v2/mil';
const MILITARY_LIST_REFRESH_MS = 60_000;
const MILITARY_LIST_TIMEOUT_MS = 8000;
const MILITARY_LIST_MAX_BYTES = 8 * 1024 * 1024;
const KNOWN_MILITARY_MAX = 50_000;

/** @type {Set<string>} Addresses seen flagged military. Additive within the cap. */
const _knownMilitary = new Set();
let _lastRefreshAt = 0;
/** @type {Promise<void>|null} */
let _refreshing = null;
/** True once the first refresh has settled, successfully or not. */
let _primed = false;

/** Remember an address flagged military by any upstream. */
export function rememberMilitaryAircraft(icao) {
  const hex = normalizeIcaoAddress(icao);
  if (!hex) return;
  if (_knownMilitary.size >= KNOWN_MILITARY_MAX) _knownMilitary.clear();
  _knownMilitary.add(hex);
}

/**
 * Whether an aircraft must be withheld from every response.
 * @param {string} icao - ICAO24 hex (any case).
 * @returns {boolean}
 */
export function isMilitaryAircraft(icao) {
  const hex = normalizeIcaoAddress(icao);
  return !!hex && (_knownMilitary.has(hex) || isMilitaryIcaoRange(hex));
}

/**
 * Refresh the listed military addresses when stale. Concurrent callers share
 * one request; failures keep the current set and are retried after the same
 * interval.
 * @returns {Promise<void>}
 */
export function refreshMilitaryAircraft({
  fetchImpl = fetch,
  now = Date.now,
} = {}) {
  if (_refreshing) return _refreshing;
  if (_lastRefreshAt && now() - _lastRefreshAt < MILITARY_LIST_REFRESH_MS)
    return Promise.resolve();
  _lastRefreshAt = now();
  _refreshing = (async () => {
    try {
      const upstream = await fetchImpl(MILITARY_LIST_URL, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'ozeye-civilian-filter/1.0',
        },
        signal: AbortSignal.timeout(MILITARY_LIST_TIMEOUT_MS),
      });
      if (!upstream.ok) throw new Error(`upstream HTTP ${upstream.status}`);
      const payload = await readResponseJsonCapped(
        upstream,
        MILITARY_LIST_MAX_BYTES,
      );
      for (const aircraft of Array.isArray(payload?.ac) ? payload.ac : [])
        rememberMilitaryAircraft(aircraft?.hex);
    } catch (error) {
      console.warn('[Civilian Filter]', error?.message || error);
    } finally {
      _refreshing = null;
    }
  })();
  return _refreshing;
}

/**
 * Keep the listed addresses current without delaying responses. Only the
 * first call waits, so the first snapshot served is already list-filtered.
 * @returns {Promise<void>}
 */
export async function prepareCivilianFilter(options) {
  const pending = refreshMilitaryAircraft(options);
  if (_primed) return;
  await pending;
  _primed = true;
}

/**
 * Drop military aircraft from a raw adsb.lol/readsb response.
 * @param {object} payload - Response with an `ac` array.
 * @returns {object} The payload with only civilian aircraft.
 */
export function civilianAdsbPayload(payload) {
  if (!Array.isArray(payload?.ac)) return payload;
  const ac = payload.ac.filter((aircraft) => {
    if (isMilitaryAdsbRecord(aircraft)) {
      rememberMilitaryAircraft(aircraft?.hex);
      return false;
    }
    return !isMilitaryAircraft(aircraft?.hex);
  });
  return { ...payload, ac };
}

/**
 * Drop military aircraft from an OpenSky-shaped `{states: [[icao24, …], …]}`
 * body. A body that is not such a document is returned unchanged.
 * @param {string} body - JSON text.
 * @returns {string} JSON text with only civilian state vectors.
 */
export function civilianStatesBody(body) {
  let document;
  try {
    document = JSON.parse(body);
  } catch {
    return body;
  }
  if (!Array.isArray(document?.states)) return body;
  const states = document.states.filter(
    (state) => !isMilitaryAircraft(state?.[0]),
  );
  if (states.length === document.states.length) return body;
  return JSON.stringify({ ...document, states });
}

/** Test seam: forget every listed address and the refresh clock. */
export function resetCivilianFilterForTests() {
  _knownMilitary.clear();
  _lastRefreshAt = 0;
  _refreshing = null;
  _primed = false;
}
