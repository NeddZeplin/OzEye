import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUSTRALIA_BOUNDS,
  AUSTRALIA_REQUEST_BOUNDS,
  AUSTRALIAN_TERRITORY_BOXES,
  isInAustralia,
} from './australia.js';
import {
  australianAdsbPayload,
  australianStatesBody,
} from '../../server/providers/common/region.js';

test('the mainland, Tasmania and offshore waters are inside', () => {
  for (const [name, latitude, longitude] of [
    ['Sydney', -33.87, 151.21],
    ['Perth', -31.95, 115.86],
    ['Darwin', -12.46, 130.84],
    ['Hobart', -42.88, 147.33],
    ['Thursday Island', -10.58, 142.22],
    ['Lord Howe Island', -31.55, 159.08],
    ['Tasman Sea, 300 nm east of Sydney', -34.0, 157.5],
    ['Great Australian Bight', -36.0, 131.0],
  ])
    assert.equal(isInAustralia(latitude, longitude), true, name);
});

test('the external territories are inside', () => {
  for (const [name, latitude, longitude] of [
    ['Norfolk Island', -29.04, 167.95],
    ['Christmas Island', -10.45, 105.69],
    ['Cocos (Keeling) Islands', -12.19, 96.83],
    ['Macquarie Island', -54.62, 158.86],
    ['Heard Island', -53.1, 73.51],
  ])
    assert.equal(isInAustralia(latitude, longitude), true, name);
});

test('neighbouring countries and the rest of the world are outside', () => {
  for (const [name, latitude, longitude] of [
    ['Port Moresby', -9.44, 147.18],
    ['Daru, Papua New Guinea', -9.08, 143.2],
    ['Dili', -8.56, 125.57],
    ['Kupang', -10.18, 123.6],
    ['Bali', -8.65, 115.22],
    ['Auckland', -36.85, 174.76],
    ['Noumea', -22.27, 166.44],
    ['Singapore', 1.35, 103.8],
    ['Austin, Texas', 30.27, -97.74],
  ])
    assert.equal(isInAustralia(latitude, longitude), false, name);
});

test('a missing or malformed position is outside', () => {
  assert.equal(isInAustralia(null, null), false);
  assert.equal(isInAustralia(undefined, 151), false);
  assert.equal(isInAustralia(Number.NaN, 151), false);
  assert.equal(isInAustralia('-33.87', '151.21'), false);
});

test('the request box contains the outline and every territory', () => {
  for (const box of [AUSTRALIA_BOUNDS, ...AUSTRALIAN_TERRITORY_BOXES]) {
    assert.ok(AUSTRALIA_REQUEST_BOUNDS.west <= box.west);
    assert.ok(AUSTRALIA_REQUEST_BOUNDS.south <= box.south);
    assert.ok(AUSTRALIA_REQUEST_BOUNDS.east >= box.east);
    assert.ok(AUSTRALIA_REQUEST_BOUNDS.north >= box.north);
  }
});

test('state vectors outside Australia, or without a position, are dropped', () => {
  const state = (icao, longitude, latitude) => [
    icao,
    'CALL',
    null,
    1,
    1,
    longitude,
    latitude,
  ];
  const body = JSON.stringify({
    time: 1,
    states: [
      state('7c6b2d', 151.21, -33.87),
      state('a12345', -97.74, 30.27),
      state('c81234', 174.76, -36.85),
      state('7c0001', null, null),
    ],
  });
  assert.deepEqual(
    JSON.parse(australianStatesBody(body)).states.map((s) => s[0]),
    ['7c6b2d'],
  );
  const inside = JSON.stringify({ states: [state('7c6b2d', 151.21, -33.87)] });
  assert.equal(australianStatesBody(inside), inside);
  assert.equal(australianStatesBody('{"error":"x"}'), '{"error":"x"}');
  assert.equal(australianStatesBody('not json'), 'not json');
});

test('raw aircraft records outside Australia are dropped', () => {
  const payload = australianAdsbPayload({
    now: 1,
    ac: [
      { hex: '7c6b2d', lat: -33.87, lon: 151.21 },
      { hex: 'a12345', lat: 30.27, lon: -97.74 },
      { hex: '7c0002' },
    ],
  });
  assert.deepEqual(
    payload.ac.map((aircraft) => aircraft.hex),
    ['7c6b2d'],
  );
  assert.deepEqual(australianAdsbPayload({ error: 'x' }), { error: 'x' });
});
