import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState, restoreState, canCollect, sell, buy, capacity, haulRewards, contractFor, contractProgress, YARDS, yardFor, recoverWreck, nextYard, TYPES, UPGRADES } from './engine.js';

test('complete collect, sell, upgrade loop unlocks heavy scrap', () => {
  const state = freshState(), cargo = [];
  assert.equal(canCollect(state, cargo, { type: 2 }), false);
  for (let trip = 0; trip < 2; trip++) {
    for (let i = 0; i < 12; i++) { assert.ok(canCollect(state, cargo, { type: 0 })); cargo.push({ type: 0 }); }
    assert.equal(canCollect(state, cargo, { type: 0 }), false);
    assert.equal(sell(state, cargo), trip === 0 ? 68 : 48); assert.equal(cargo.length, 0);
  }
  assert.equal(state.credits, 116); assert.equal(state.sold, 24);
  assert.ok(buy(state, 'power')); assert.equal(state.credits, 96);
  assert.ok(canCollect(state, cargo, { type: 2 }));
  state.credits = 19;
  assert.equal(buy(state, 'capacity'), false); assert.equal(state.credits, 19);
});

test('first six-piece haul buys a real upgrade and job bonus is paid once', () => {
  const state = freshState(), cargo = Array.from({ length: 6 }, () => ({ type: 0 }));
  assert.deepEqual(haulRewards(state, cargo), { base: 12, multiplier: 1.5, bonus: 20, total: 38 });
  assert.equal(sell(state, cargo), 38); assert.equal(state.contracts, 1);
  assert.ok(buy(state, 'power')); assert.ok(canCollect(state, [], { type: 2 }));
  assert.equal(sell(state, []), 0); assert.equal(state.contracts, 1);
  assert.equal(contractFor(state).name, 'Copper rush');
});

test('jobs require matching cargo in one haul; completed jobs survive reload', () => {
  const state = freshState(); state.contracts = 1;
  const mixed = [{ type: 1 }, { type: 1 }, { type: 0 }];
  assert.equal(contractProgress(state, mixed), 2); assert.equal(haulRewards(state, mixed).bonus, 0);
  sell(state, mixed); assert.equal(state.contracts, 1);
  assert.equal(sell(state, [{ type: 1 }, { type: 1 }, { type: 1 }]), 50);
  assert.equal(restoreState(state).contracts, 2);
  assert.equal(restoreState({ credits: 40, upgrades: {} }).contracts, 0);
  state.contracts = 99;
  assert.equal(contractFor(state).name, 'Clean sweep');
});
test('mixed cargo respects weight, and upgrades cannot exceed maximum', () => {
  const state = freshState(); state.credits = 5000;
  assert.ok(buy(state, 'power'));
  const cargo = [{ type: 2 }, { type: 2 }, { type: 1 }, { type: 0 }];
  assert.equal(canCollect(state, cargo, { type: 1 }), false);
  assert.ok(canCollect(state, cargo, { type: 0 }));
  for (let i = 0; i < 3; i++) assert.ok(buy(state, 'capacity'));
  assert.equal(capacity(state), 60); const balance = state.credits;
  assert.equal(buy(state, 'capacity'), false); assert.equal(state.credits, balance);
});

test('wreck recovery pays once, unlocks travel, and preserves equipment', () => {
  const state = freshState(); state.upgrades.power = 2;
  assert.equal(nextYard(state), false); assert.equal(recoverWreck(state), false);
  state.yardCleared = yardFor(state).target;
  assert.ok(recoverWreck(state)); assert.equal(state.credits, 100);
  assert.equal(recoverWreck(state), false); assert.equal(state.credits, 100);
  const restored = restoreState(JSON.parse(JSON.stringify(state)));
  assert.ok(nextYard(restored)); assert.equal(restored.yard, 1);
  assert.equal(restored.upgrades.power, 2); assert.equal(restored.yardCleared, 0); assert.equal(restored.recovered, false);
  restored.yard = 2; restored.yardCleared = YARDS[2].target; assert.ok(recoverWreck(restored));
  assert.ok(nextYard(restored)); assert.equal(restored.yard, 0);
});

test('later upgrades require several full hauls and unlock new salvage', () => {
  const state = freshState(); state.credits = 20;
  buy(state, 'power'); assert.equal(canCollect(state, [], { type: 3 }), false);
  state.credits = UPGRADES.power.costs[1]; buy(state, 'power');
  assert.ok(canCollect(state, [], { type: 3 })); assert.equal(canCollect(state, [], { type: 4 }), false);
  state.credits = UPGRADES.power.costs[2]; buy(state, 'power'); assert.ok(canCollect(state, [], { type: 4 }));
  assert.ok(UPGRADES.power.costs[2] > 10 * 48);
});

test('rotating contracts fit cargo and only request accessible local materials', () => {
  for (let yard = 0; yard < YARDS.length; yard++) for (let power = 0; power <= 3; power++) for (let contracts = 3; contracts < 20; contracts++) {
    const state = freshState(); Object.assign(state, { yard, contracts }); state.upgrades.power = power;
    const job = contractFor(state);
    assert.ok(job.count <= capacity(state));
    if (job.type !== null) {
      assert.ok(yardFor(state).materials.includes(job.type)); assert.ok(TYPES[job.type].power <= power + 1);
      assert.ok(job.count * TYPES[job.type].weight <= capacity(state));
    }
  }
  const restored = restoreState({ yard: 500, yardCleared: 9999, recovered: true });
  assert.equal(restored.yard, 2); assert.equal(restored.yardCleared, 150);
});
test('saved progress round-trips and malformed saves cannot break progression', () => {
  const state = freshState(); state.credits = 87; state.parts = 3; state.sold = 51; state.upgrades.range = 2;
  assert.deepEqual(restoreState(JSON.parse(JSON.stringify(state))), state);
  assert.deepEqual(restoreState(null), freshState());
  const invalid = restoreState({ credits: -10, parts: 99, sold: 'bad', upgrades: { power: 300, capacity: -4 } });
  assert.equal(invalid.credits, 0); assert.equal(invalid.parts, 5); assert.equal(invalid.sold, 0); assert.equal(invalid.upgrades.power, 3); assert.equal(invalid.upgrades.capacity, 0);
});
