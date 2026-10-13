import { isInAustralia } from '../../../src/sources/australia.js';

/**
 * Server-side Australia filter for aircraft feeds. OzEye shows live data for
 * Australia and its surrounding waters only, so anything positioned
 * elsewhere, or with no position, is dropped before a response is sent.
 */

/** Label for the coverage a filtered aircraft response describes. */
export const AUSTRALIA_COVERAGE = 'Australia and surrounding waters';

/**
 * Keep the aircraft positioned in Australia in a raw adsb.lol/readsb response.
 * @param {object} payload - Response with an `ac` array.
 * @returns {object} The payload with only those aircraft.
 */
export function australianAdsbPayload(payload) {
  if (!Array.isArray(payload?.ac)) return payload;
  return {
    ...payload,
    ac: payload.ac.filter((aircraft) =>
      isInAustralia(aircraft?.lat, aircraft?.lon),
    ),
  };
}

/**
 * Keep the state vectors positioned in Australia in an OpenSky-shaped
 * `{states: [[icao24, …, longitude, latitude, …], …]}` body. A body that is
 * not such a document is returned unchanged.
 * @param {string} body - JSON text.
 * @returns {string} JSON text with only those state vectors.
 */
export function australianStatesBody(body) {
  let document;
  try {
    document = JSON.parse(body);
  } catch {
    return body;
  }
  if (!Array.isArray(document?.states)) return body;
  const states = document.states.filter((state) =>
    isInAustralia(state?.[6], state?.[5]),
  );
  if (states.length === document.states.length) return body;
  return JSON.stringify({ ...document, states });
}
