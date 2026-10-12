import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isMilitaryAdsbRecord,
  isMilitaryIcaoRange,
  isNavalVessel,
} from './civilianTraffic.js';
import {
  civilianAdsbPayload,
  civilianStatesBody,
  isMilitaryAircraft,
  prepareCivilianFilter,
  resetCivilianFilterForTests,
} from '../../server/providers/common/civilian.js';
import { ingestAisStreamEnvelope } from '../../server/providers/vessels/ais-store.js';
import { aisStreamRows } from '../../server/providers/vessels/ais-store.js';

test('reserved military address blocks are recognised offline', () => {
  assert.equal(isMilitaryIcaoRange('7CF800'), true); // Australia
  assert.equal(isMilitaryIcaoRange('7cfaff'), true);
  assert.equal(isMilitaryIcaoRange('ae01ce'), true); // United States
  assert.equal(isMilitaryIcaoRange('43c123'), true); // United Kingdom
  assert.equal(isMilitaryIcaoRange('7c6b2d'), false); // Australian civil
  assert.equal(isMilitaryIcaoRange('7cfb00'), false);
  assert.equal(isMilitaryIcaoRange(''), false);
  assert.equal(isMilitaryIcaoRange('~12345'), false);
});

test('a database military flag withholds an aircraft outside the blocks', () => {
  assert.equal(isMilitaryAdsbRecord({ hex: '7c6b2d', dbFlags: 1 }), true);
  assert.equal(isMilitaryAdsbRecord({ hex: '7c6b2d', dbFlags: 8 }), false);
  assert.equal(isMilitaryAdsbRecord({ hex: '7c6b2d' }), false);
  assert.equal(isMilitaryAdsbRecord({ hex: 'ae01ce' }), true);
});

test('state vectors lose military aircraft and keep the rest untouched', () => {
  resetCivilianFilterForTests();
  const body = JSON.stringify({
    time: 1,
    states: [
      ['7c6b2d', 'QFA1'],
      ['7cf801', 'ASY123'],
      ['ae01ce', 'RCH451'],
    ],
  });
  assert.deepEqual(JSON.parse(civilianStatesBody(body)), {
    time: 1,
    states: [['7c6b2d', 'QFA1']],
  });
  const civilian = JSON.stringify({ time: 1, states: [['7c6b2d', 'QFA1']] });
  assert.equal(civilianStatesBody(civilian), civilian);
  assert.equal(civilianStatesBody('{"error":"x"}'), '{"error":"x"}');
  assert.equal(civilianStatesBody('not json'), 'not json');
});

test('a flagged aircraft stays withheld from later state vectors', () => {
  resetCivilianFilterForTests();
  const payload = civilianAdsbPayload({
    now: 1,
    ac: [
      { hex: '7c6b2d', flight: 'QFA1' },
      { hex: '7c1234', flight: 'DRAGN1', dbFlags: 1 },
    ],
  });
  assert.deepEqual(
    payload.ac.map((aircraft) => aircraft.hex),
    ['7c6b2d'],
  );
  assert.equal(isMilitaryAircraft('7C1234'), true);
  assert.deepEqual(
    JSON.parse(
      civilianStatesBody(JSON.stringify({ states: [['7c1234'], ['7c6b2d']] })),
    ).states,
    [['7c6b2d']],
  );
});

test('the listed addresses are applied, and a failed refresh still filters', async () => {
  resetCivilianFilterForTests();
  await prepareCivilianFilter({
    fetchImpl: async () => {
      throw new Error('offline');
    },
  });
  assert.equal(isMilitaryAircraft('7cf801'), true);
  assert.equal(isMilitaryAircraft('7c4321'), false);

  resetCivilianFilterForTests();
  await prepareCivilianFilter({
    fetchImpl: async () =>
      new Response(JSON.stringify({ ac: [{ hex: '7C4321' }] }), {
        status: 200,
      }),
  });
  assert.equal(isMilitaryAircraft('7c4321'), true);
});

test('naval vessels are recognised by ship type or name', () => {
  assert.equal(isNavalVessel({ type: 35 }), true);
  assert.equal(isNavalVessel({ type: '35' }), true);
  assert.equal(isNavalVessel({ type: 'Military ops' }), true);
  assert.equal(isNavalVessel({ name: 'HMAS HOBART' }), true);
  assert.equal(isNavalVessel({ name: 'AUSTRALIAN WARSHIP' }), true);
  assert.equal(isNavalVessel({ name: 'US NAVY SHIP 51' }), true);
  assert.equal(isNavalVessel({ type: 70, name: 'SPIRIT OF TASMANIA' }), false);
  assert.equal(isNavalVessel({ type: 60, name: 'THOMAS' }), false);
  assert.equal(isNavalVessel({}), false);
});

test('a vessel is withheld, and forgotten, once it identifies as naval', () => {
  const position = (mmsi, name) => ({
    MessageType: 'PositionReport',
    MetaData: {
      MMSI: mmsi,
      ShipName: name,
      latitude: -33.8,
      longitude: 151.2,
      time_utc: '2026-10-12 01:00:00 +0000 UTC',
    },
    Message: { PositionReport: { UserID: mmsi, Sog: 5, Cog: 90 } },
  });
  const names = () =>
    aisStreamRows(100)
      .map((row) => row.name)
      .sort();
  assert.equal(ingestAisStreamEnvelope(position(503900001, 'MANLY FERRY')), true);
  assert.equal(ingestAisStreamEnvelope(position(503900002, 'HMAS HOBART')), true);
  assert.equal(ingestAisStreamEnvelope(position(503900003, 'GREY SHIP')), true);
  assert.deepEqual(names(), ['GREY SHIP', 'MANLY FERRY']);
  ingestAisStreamEnvelope({
    MessageType: 'ShipStaticData',
    MetaData: { MMSI: 503900003, ShipName: 'GREY SHIP' },
    Message: { ShipStaticData: { UserID: 503900003, Type: 35 } },
  });
  assert.deepEqual(names(), ['MANLY FERRY']);
  assert.equal(ingestAisStreamEnvelope(position(503900003, 'GREY SHIP')), true);
  assert.deepEqual(names(), ['MANLY FERRY']);
});
