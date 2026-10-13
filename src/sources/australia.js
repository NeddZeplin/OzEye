/**
 * The area OzEye shows live data for: Australia and its surrounding waters.
 * This module holds the geometry and the test; it performs no requests.
 *
 * The outline is a hand-drawn approximation of the Australian maritime zone,
 * roughly 200 nautical miles off the coast and following the agreed seabed
 * lines with Indonesia, Timor-Leste and Papua New Guinea in the north. It is
 * a display boundary, not a legal one.
 */

/**
 * Mainland and Tasmania with surrounding waters, as [longitude, latitude]
 * vertices in order around the outline.
 * @type {ReadonlyArray<readonly [number, number]>}
 */
export const AUSTRALIA_OUTLINE = Object.freeze(
  [
    [109.0, -21.0],
    [112.0, -13.5],
    [118.0, -12.0],
    [123.5, -11.0],
    [127.5, -9.6],
    [133.0, -8.9],
    [139.5, -9.0],
    [142.0, -9.1],
    [144.2, -9.2],
    [146.0, -10.5],
    [151.0, -12.5],
    [156.5, -13.5],
    [158.5, -18.0],
    [160.5, -24.0],
    [163.5, -30.0],
    [160.5, -36.0],
    [158.0, -41.0],
    [152.5, -47.0],
    [144.0, -47.8],
    [136.0, -41.0],
    [130.0, -37.5],
    [120.0, -38.5],
    [111.0, -37.5],
    [108.5, -31.0],
  ].map((vertex) => Object.freeze(vertex)),
);

/**
 * External territories outside the outline, each with surrounding waters, as
 * boxes of west, south, east and north in degrees.
 * @type {ReadonlyArray<Readonly<{name: string, west: number, south: number, east: number, north: number}>>}
 */
export const AUSTRALIAN_TERRITORY_BOXES = Object.freeze(
  [
    {
      name: 'Cocos (Keeling) Islands',
      west: 93.5,
      south: -15.5,
      east: 100.5,
      north: -8.5,
    },
    {
      name: 'Christmas Island',
      west: 102.3,
      south: -13.9,
      east: 109.0,
      north: -8.4,
    },
    {
      name: 'Norfolk Island',
      west: 164.5,
      south: -32.5,
      east: 171.4,
      north: -25.6,
    },
    {
      name: 'Macquarie Island',
      west: 155.0,
      south: -58.0,
      east: 163.0,
      north: -51.0,
    },
    {
      name: 'Heard and McDonald Islands',
      west: 69.5,
      south: -56.5,
      east: 77.5,
      north: -49.5,
    },
  ].map((box) => Object.freeze(box)),
);

/** The smallest box containing the mainland outline; territories lie outside it. */
export const AUSTRALIA_BOUNDS = Object.freeze({
  west: Math.min(...AUSTRALIA_OUTLINE.map(([longitude]) => longitude)),
  south: Math.min(...AUSTRALIA_OUTLINE.map(([, latitude]) => latitude)),
  east: Math.max(...AUSTRALIA_OUTLINE.map(([longitude]) => longitude)),
  north: Math.max(...AUSTRALIA_OUTLINE.map(([, latitude]) => latitude)),
});

function insideOutline(longitude, latitude) {
  let inside = false;
  for (
    let i = 0, j = AUSTRALIA_OUTLINE.length - 1;
    i < AUSTRALIA_OUTLINE.length;
    j = i++
  ) {
    const [xi, yi] = AUSTRALIA_OUTLINE[i];
    const [xj, yj] = AUSTRALIA_OUTLINE[j];
    if (
      yi > latitude !== yj > latitude &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi
    )
      inside = !inside;
  }
  return inside;
}

/**
 * Whether a position is in Australia or its surrounding waters.
 * @param {number} latitude - Degrees north.
 * @param {number} longitude - Degrees east.
 * @returns {boolean} False for a missing or non-finite position.
 */
export function isInAustralia(latitude, longitude) {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  )
    return false;
  if (
    longitude >= AUSTRALIA_BOUNDS.west &&
    longitude <= AUSTRALIA_BOUNDS.east &&
    latitude >= AUSTRALIA_BOUNDS.south &&
    latitude <= AUSTRALIA_BOUNDS.north &&
    insideOutline(longitude, latitude)
  )
    return true;
  return AUSTRALIAN_TERRITORY_BOXES.some(
    (box) =>
      longitude >= box.west &&
      longitude <= box.east &&
      latitude >= box.south &&
      latitude <= box.north,
  );
}

/**
 * One box containing the outline and every territory box, for upstream
 * requests that accept a single bounding box. It is wider than the area
 * itself, so results still need `isInAustralia`.
 */
export const AUSTRALIA_REQUEST_BOUNDS = Object.freeze({
  west: Math.min(
    AUSTRALIA_BOUNDS.west,
    ...AUSTRALIAN_TERRITORY_BOXES.map((box) => box.west),
  ),
  south: Math.min(
    AUSTRALIA_BOUNDS.south,
    ...AUSTRALIAN_TERRITORY_BOXES.map((box) => box.south),
  ),
  east: Math.max(
    AUSTRALIA_BOUNDS.east,
    ...AUSTRALIAN_TERRITORY_BOXES.map((box) => box.east),
  ),
  north: Math.max(
    AUSTRALIA_BOUNDS.north,
    ...AUSTRALIAN_TERRITORY_BOXES.map((box) => box.north),
  ),
});
