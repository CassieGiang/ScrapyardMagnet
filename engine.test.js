import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState, restoreState, canCollect, sell, buy, capacity } from './engine.js';

test('complete collect, sell, upgrade loop unlocks heavy scrap', () => {
  const state = freshState(), cargo = [];
  assert.equal(canCollect(state, cargo, { type: 2 }), false);
  for (let trip = 0; trip < 2; trip++) {
    for (let i = 0; i < 12; i++) { assert.ok(canCollect(state, cargo, { type: 0 })); cargo.push({ type: 0 }); }
    assert.equal(canCollect(state, cargo, { type: 0 }), false);
    assert.equal(sell(state, cargo), 24); assert.equal(cargo.length, 0);
  }
  assert.equal(state.credits, 48); assert.equal(state.sold, 24);
  assert.ok(buy(state, 'power')); assert.equal(state.credits, 18);
  assert.ok(canCollect(state, cargo, { type: 2 }));
  assert.equal(buy(state, 'capacity'), false); assert.equal(state.credits, 18);
});
test('mixed cargo respects weight, and upgrades cannot exceed maximum', () => {
  const state = freshState(); state.credits = 1000;
  assert.ok(buy(state, 'power'));
  const cargo = [{ type: 2 }, { type: 2 }, { type: 1 }, { type: 0 }];
  assert.equal(canCollect(state, cargo, { type: 1 }), false);
  assert.ok(canCollect(state, cargo, { type: 0 }));
  for (let i = 0; i < 3; i++) assert.ok(buy(state, 'capacity'));
  assert.equal(capacity(state), 60); const balance = state.credits;
  assert.equal(buy(state, 'capacity'), false); assert.equal(state.credits, balance);
});
test('saved progress round-trips and malformed saves cannot break progression', () => {
  const state = freshState(); state.credits = 87; state.parts = 3; state.sold = 51; state.upgrades.range = 2;
  assert.deepEqual(restoreState(JSON.parse(JSON.stringify(state))), state);
  assert.deepEqual(restoreState(null), freshState());
  const invalid = restoreState({ credits: -10, parts: 99, sold: 'bad', upgrades: { power: 300, capacity: -4 } });
  assert.equal(invalid.credits, 0); assert.equal(invalid.parts, 5); assert.equal(invalid.sold, 0); assert.equal(invalid.upgrades.power, 3); assert.equal(invalid.upgrades.capacity, 0);
});
