import {
  normalizeFeedType,
  isVideoFeedType,
} from '../../../src/sources/cctvTypes.js';
export { normalizeFeedType, isVideoFeedType };
import { directionToHeading } from '../../../src/data/directionText.js';
import { haversineKm } from '../common/geo.js';
/**
 * FNV-1a 32-bit hash of a string, used to derive deterministic pseudo-random
 * values (e.g. hue for synthetic SVG billboards, fallback heading angles).
 *
 * @param {string} text
 * @returns {number} Unsigned 32-bit hash.
 */
export function hashSeed(text) {
  let h = 2166136261 >>> 0; // FNV offset basis
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619); // FNV prime
  }
  return h >>> 0;
}

/**
 * Escape special XML/HTML characters for safe embedding in SVG text nodes.
 *
 * @param {string} text
 * @returns {string}
 */
export function escapeXml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Coerce a value to a finite number, returning fallback if NaN/Infinity.
 *
 * @param {*} value
 * @param {number} [fallback=NaN]
 * @returns {number}
 */
export function toFiniteNumber(value, fallback = NaN) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * Bounding-box sanity check: is this coordinate plausibly on the Finnish road
 * network? Generous around the observed catalog extent (59.86..70.09 N,
 * 19.62..31.28 E) so a real new station is never dropped, tight enough that a
 * swapped lat/lon or a null island record is.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {boolean}
 */
/** Longest unselected camera label the HUD shows before it gets noisy. */
export const CAMERA_CODE_MAX_CHARS = 28;

/**
 * Short display code for the unselected camera label ("CAM-<code>"): the
 * feed's own name for the camera ("5TH ST / CONGRESS AVE", "TRAFALGAR
 * SQUARE"), trimmed to CAMERA_CODE_MAX_CHARS. A pack may pass an explicit
 * `code` (TxDOT's device key, NSW's title); the id is the last resort.
 *
 * @param {string} text
 * @returns {string}
 */
export function cameraDisplayCode(text) {
  const clean = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= CAMERA_CODE_MAX_CHARS) return clean;
  return `${clean.slice(0, CAMERA_CODE_MAX_CHARS - 1).trimEnd()}…`;
}

/** Finite, in range, and not the null island that Number(null) produces. */
export function isPlausibleLatLon(lat, lon) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180 &&
    !(lat === 0 && lon === 0)
  );
}

/** New South Wales bounding box (incl. the ACT and Lord Howe Island). */
export function isLikelyNswCoordinate(lat, lon) {
  return (
    isPlausibleLatLon(lat, lon) &&
    lat >= -38 &&
    lat <= -28 &&
    lon >= 140.9 &&
    lon <= 159.2
  );
}

/**
 * Derive a deterministic fallback heading from a camera ID hash.
 *
 * Produces one of 16 evenly-spaced compass directions (0, 22.5, 45, ...).
 *
 * @param {string} cameraId
 * @returns {number} Heading in degrees [0..360).
 */
export function fallbackHeadingFromId(cameraId) {
  return (hashSeed(String(cameraId)) % 16) * 22.5;
}

/**
 * Distance-prioritizes cameras to a cap: keeps the maxCount cameras closest
 * to ANY of the given anchor points (min distance over anchors), tie-broken
 * by original array order. Used by every live source pack (Austin: one
 * downtown anchor; Caltrans: one anchor per major CA metro; TfL: central
 * London) so a cap always keeps the densest, most interesting cores.
 *
 * @param {Array<object>} cameras - Normalized camera source objects.
 * @param {number} maxCount - Cap (<=0 or >= length disables).
 * @param {Array<{lat:number,lon:number}>} anchors - At least one anchor.
 * @returns {Array<object>} Capped, priority-ordered camera list.
 */
export function prioritizeSources(cameras, maxCount, anchors) {
  const list = Array.isArray(cameras) ? cameras : [];
  const anchorList = (Array.isArray(anchors) ? anchors : []).filter(
    (a) => Number.isFinite(a?.lat) && Number.isFinite(a?.lon),
  );
  if (!anchorList.length) return list;
  // Always sort when anchors exist, even when the pack fits its own cap: the
  // catalog-wide cap (cap.js) thins a pack from the END of this order, so
  // "nearest to an anchor first" has to hold whether or not the pack was
  // trimmed here.
  const cap =
    Number.isFinite(maxCount) && maxCount > 0
      ? Math.min(maxCount, list.length)
      : list.length;

  const scored = list.map((camera, idx) => {
    const lat = Number(camera?.lat);
    const lon = Number(camera?.lon);
    const distKm =
      Number.isFinite(lat) && Number.isFinite(lon)
        ? Math.min(
            ...anchorList.map((a) => haversineKm(lat, lon, a.lat, a.lon)),
          )
        : Number.POSITIVE_INFINITY;
    return { camera, idx, distKm };
  });

  scored.sort((a, b) => {
    if (a.distKm !== b.distKm) return a.distKm - b.distKm;
    return a.idx - b.idx;
  });

  const kept = scored.slice(0, cap).map((entry) => entry.camera);
  // How many cameras the pack offered before trimming, and where, for
  // coverage reports.
  Object.defineProperty(kept, 'available', { value: list.length });
  Object.defineProperty(kept, 'region', { value: cameraRegion(list) });
  return kept;
}

/** The bounding box of cameras with coordinates, or null. */
export function cameraRegion(cameras) {
  let region = null;
  for (const camera of cameras || []) {
    const lat = Number(camera?.lat);
    const lon = Number(camera?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    region = region
      ? {
          west: Math.min(region.west, lon),
          south: Math.min(region.south, lat),
          east: Math.max(region.east, lon),
          north: Math.max(region.north, lat),
        }
      : { west: lon, south: lat, east: lon, north: lat };
  }
  return region;
}

/**
 * Normalize a raw CCTV source item into a canonical shape with safe defaults.
 *
 * @param {object} item - Raw source from file, env, or Austin Open Data.
 * @returns {object} Normalized source with all expected fields populated.
 */
export function normalizeSourceItem(item) {
  return {
    id: String(item.id || '').trim(),
    name: String(item.name || item.id || '').trim(),
    city: String(item.city || ''),
    cityId: String(item.cityId || ''),
    provider: String(item.provider || 'Configured CCTV Source'),
    lat: toFiniteNumber(item.lat),
    lon: toFiniteNumber(item.lon),
    headingDeg: toFiniteNumber(item.headingDeg),
    headingConfidence: String(
      item.headingConfidence || item.headingSource || '',
    ).toLowerCase(),
    pitchDeg: toFiniteNumber(item.pitchDeg),
    fovDeg: toFiniteNumber(item.fovDeg),
    rangeM: toFiniteNumber(item.rangeM),
    mountHeightM: toFiniteNumber(item.mountHeightM),
    groundElevationM: toFiniteNumber(item.groundElevationM),
    feedType: normalizeFeedType(item.feedType || item.type || ''),
    url: typeof item.url === 'string' ? item.url : '',
    snapshotUrl: typeof item.snapshotUrl === 'string' ? item.snapshotUrl : '',
    license: String(item.license || item.licenseNote || ''),
    // Per-camera attribution for feeds a partner supplies inside a pack
    // (DriveBC: TransLink, city cameras). Shown beside the provider.
    credit: String(item.credit || '').trim(),
    // Unselected-label code: the pack's explicit short name, else the feed's
    // name, else the id.
    code: cameraDisplayCode(
      item.code || String(item.name || '').toUpperCase() || item.id || '',
    ),
    sourceKind: String(item.sourceKind || item.kind || 'configured'),
    // Optional CAL badge input (cctv-v2 design §3b/§9.2, additive-only per the
    // global constraints — nothing else in this file changes): hand-authored
    // file/env catalog entries may declare poseSource:'curated' so the panel
    // badge can distinguish them from raw automated priors (e.g. Austin Open
    // Data, which never sets this field). Passed through as-is to the client.
    poseSource: item.poseSource === 'curated' ? 'curated' : undefined,
  };
}
