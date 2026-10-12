/**
 * Civilian-only traffic policy. OzEye shows no military aircraft or naval
 * vessels, so providers drop them before a record leaves the server. This
 * module holds the offline rules; it performs no requests.
 */

/**
 * ICAO 24-bit address blocks national regulators reserve for military
 * aircraft, as published by the tar1090-db project (ranges.json). Inclusive.
 * @type {ReadonlyArray<readonly [number, number]>}
 */
export const MILITARY_ICAO_RANGES = Object.freeze(
  [
    ['adf7c8', 'afffff'],
    ['010070', '01008f'],
    ['0a4000', '0a4fff'],
    ['33ff00', '33ffff'],
    ['350000', '37ffff'],
    ['3aa000', '3affff'],
    ['3b7000', '3bffff'],
    ['3ea000', '3ebfff'],
    ['3f4000', '3fbfff'],
    ['400000', '40003f'],
    ['43c000', '43cfff'],
    ['444000', '446fff'],
    ['44f000', '44ffff'],
    ['457000', '457fff'],
    ['45f400', '45f4ff'],
    ['468000', '4683ff'],
    ['473c00', '473c0f'],
    ['478100', '4781ff'],
    ['480000', '480fff'],
    ['48d800', '48d87f'],
    ['497c00', '497cff'],
    ['498420', '49842f'],
    ['4b7000', '4b7fff'],
    ['4b8200', '4b82ff'],
    ['70c070', '70c07f'],
    ['710258', '71028f'],
    ['710380', '71039f'],
    ['738a00', '738aff'],
    ['7cf800', '7cfaff'],
    ['800200', '8002ff'],
    ['c20000', 'c3ffff'],
    ['e40000', 'e41fff'],
  ].map(([from, to]) =>
    Object.freeze([Number.parseInt(from, 16), Number.parseInt(to, 16)]),
  ),
);

/** Lowercase six-digit ICAO address, or '' when the value is not one. */
export function normalizeIcaoAddress(value) {
  const hex = String(value ?? '')
    .trim()
    .toLowerCase();
  return /^[0-9a-f]{6}$/.test(hex) ? hex : '';
}

/**
 * Whether an ICAO address falls in a reserved military block.
 * @param {string} icao - ICAO24 hex (any case).
 * @returns {boolean}
 */
export function isMilitaryIcaoRange(icao) {
  const hex = normalizeIcaoAddress(icao);
  if (!hex) return false;
  const address = Number.parseInt(hex, 16);
  return MILITARY_ICAO_RANGES.some(
    ([from, to]) => address >= from && address <= to,
  );
}

/**
 * Whether a readsb/adsb.lol aircraft record is military: its database flag
 * (dbFlags bit 0) or its address block says so.
 * @param {object} aircraft - Raw record with `hex` and optional `dbFlags`.
 * @returns {boolean}
 */
export function isMilitaryAdsbRecord(aircraft) {
  const flags = Number(aircraft?.dbFlags);
  if (Number.isFinite(flags) && (flags & 1) === 1) return true;
  return isMilitaryIcaoRange(aircraft?.hex);
}

/** AIS ship-type code for "military operations" (ITU-R M.1371). */
const AIS_TYPE_MILITARY_OPS = 35;
const NAVAL_TYPE_TEXT = /military|naval|warship/i;
/** Ship-name prefixes navies use, and words a warship broadcasts in its name. */
const NAVAL_NAME_PREFIX =
  /^(?:HMAS|HMNZS|HMS|HMCS|USS|USNS|ADV|NUSHIP|INS|ROKS|KRI|FGS)\s/i;
const NAVAL_NAME_WORD = /\b(?:WARSHIP|NAVY|NAVAL)\b/i;

/**
 * Whether an AIS vessel identifies itself as naval, by ship type or name.
 * AIS is self-reported, so a vessel that sends neither is not recognised.
 * @param {{type?: string|number|null, name?: string|null}} vessel
 * @returns {boolean}
 */
export function isNavalVessel({ type, name } = {}) {
  const typeText = String(type ?? '').trim();
  if (typeText) {
    if (Number(typeText) === AIS_TYPE_MILITARY_OPS) return true;
    if (NAVAL_TYPE_TEXT.test(typeText)) return true;
  }
  const nameText = String(name ?? '').trim();
  return (
    !!nameText &&
    (NAVAL_NAME_PREFIX.test(nameText) || NAVAL_NAME_WORD.test(nameText))
  );
}
