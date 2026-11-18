import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as engine from './engine.js';

function createGame(initial = null) {
  // Run the real frame/input code with a minimal DOM and drawing surface.
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const elements = new Map();
  function element() {
    return { style: {}, classList: { toggle() {} }, events: {}, textContent: '', disabled: false,
      addEventListener(name, fn) { this.events[name] = fn; }, setAttribute() {},
      append(button) { elements.set(button.id, button); }, focus() {}, setPointerCapture() {},
      getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 670 }; },
    };
  }
  for (const [, id] of html.matchAll(/id="([^"]+)"/g)) elements.set(id, element());
  const context2d = new Proxy({}, { get: (_, key) => key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}, set: () => true });
  elements.get('yard').getContext = () => context2d;
  let nextFrame, saved, now = 0;
  const windowEvents = {};
  const sandbox = { ...engine, console,
    document: { getElementById: id => { assert.ok(elements.has(id), 'Missing element: ' + id); return elements.get(id); }, createElement: element, querySelector: () => element(), addEventListener() {} },
    window: { matchMedia: () => ({ matches: false }), addEventListener: (name, fn) => windowEvents[name] = fn },
    localStorage: { getItem: () => JSON.stringify(initial), setItem: (_, value) => saved = JSON.parse(value) },
    requestAnimationFrame: fn => nextFrame = fn, HTMLButtonElement: class {},
  };
  const source = readFileSync(new URL('./game.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/, '');
  vm.createContext(sandbox); vm.runInContext(source, sandbox);
  function frames(n) { for (let i = 0; i < n; i++) { now += 1000 / 60; nextFrame(now); } }
  return { elements, frames, windowEvents, get saved() { return saved; }, get scrap() { return JSON.parse(vm.runInContext('JSON.stringify(scrap)', sandbox)); } };
}

test('game frames collect the starter pile, bank rewards, buy power and recharge blast', () => {
  const game = createGame(), { elements, frames, windowEvents } = game;
  const yard = elements.get('yard');
  yard.events.pointerdown({ button: 0, pointerId: 1, clientX: 500, clientY: 465, preventDefault() {} });
  frames(6);
  assert.ok(parseInt(elements.get('cargo').textContent) < 6, 'A single click does not instantly fill a haul');
  frames(84);
  assert.ok(parseInt(elements.get('cargo').textContent) >= 6, 'Starter haul is collected within 1.5 seconds');
  yard.events.pointerup();
  yard.events.pointermove({ clientX: 500, clientY: 610 }); frames(60);
  assert.ok(game.saved.credits >= 38, 'First sale pays job bonus');
  assert.equal(game.saved.contracts, 1);
  elements.get('upgrade-power').events.click();
  assert.equal(game.saved.upgrades.power, 1);
  const blast = elements.get('blast');
  assert.equal(blast.disabled, false);
  blast.onclick(); frames(1);
  assert.equal(blast.disabled, true); assert.match(blast.textContent, /Recharging/);
  frames(430); assert.equal(blast.disabled, false);
  windowEvents.blur(); frames(1);
  assert.equal(elements.get('paused').hidden, false);
  assert.equal(blast.disabled, true);
});

test('travel creates a fully spread yard and cancels an active blast before it can move new scrap', () => {
  const initial = engine.freshState(); initial.yardCleared = 60; initial.recovered = true; initial.upgrades.power = 1;
  const game = createGame(initial);
  game.elements.get('blast').onclick();
  game.elements.get('next-yard').onclick();
  assert.equal(game.saved.yard, 1);
  const before = game.scrap;
  assert.equal(before.length, engine.YARDS[1].count);
  assert.ok(before.some(p => p.x < 150)); assert.ok(before.some(p => p.x > 850));
  game.frames(45);
  assert.deepEqual(game.scrap, before, 'Fresh scrap stays in its arrival layout until the player pulls');
});

test('exposed wreck can be recovered in real frames and travel preserves the workshop', () => {
  const initial = engine.freshState(); initial.yardCleared = 60; initial.upgrades.power = 1;
  const game = createGame(initial), { elements, frames } = game;
  const yard = elements.get('yard');
  yard.events.pointerdown({ button: 0, pointerId: 1, clientX: 500, clientY: 280, preventDefault() {} });
  frames(200); yard.events.pointerup();
  assert.equal(game.saved.recovered, true);
  assert.equal(game.saved.credits, 100);
  assert.equal(elements.get('next-yard').hidden, false);
  // Any scrap picked up during recovery must be sold before travelling.
  if (parseInt(elements.get('cargo').textContent) > 0) {
    elements.get('next-yard').onclick(); assert.equal(game.saved.yard, 0);
    yard.events.pointermove({ clientX: 500, clientY: 610 }); frames(60);
  }
  const credits = game.saved.credits;
  elements.get('next-yard').onclick();
  assert.equal(game.saved.yard, 1); assert.equal(game.saved.yardCleared, 0);
  assert.equal(game.saved.upgrades.power, 1); assert.equal(game.saved.credits, credits);
  assert.match(elements.get('yard-name').textContent, /RAIL DEPOT/);
  frames(200); assert.equal(game.saved.credits, credits, 'Recovered wreck cannot pay twice');
});
