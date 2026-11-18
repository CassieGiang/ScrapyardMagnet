import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as engine from './engine.js';

test('game frames collect the starter pile, bank rewards, buy power and recharge blast', () => {
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
    localStorage: { getItem: () => null, setItem: (_, value) => saved = JSON.parse(value) },
    requestAnimationFrame: fn => nextFrame = fn, HTMLButtonElement: class {},
  };
  const source = readFileSync(new URL('./game.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/, '');
  vm.runInNewContext(source, sandbox);
  function frames(n) { for (let i = 0; i < n; i++) { now += 1000 / 60; nextFrame(now); } }
  const yard = elements.get('yard');
  yard.events.pointerdown({ button: 0, pointerId: 1, clientX: 500, clientY: 465, preventDefault() {} });
  frames(6);
  assert.ok(parseInt(elements.get('cargo').textContent) < 6, 'A single click does not instantly fill a haul');
  frames(84);
  assert.ok(parseInt(elements.get('cargo').textContent) >= 6, 'Starter haul is collected within 1.5 seconds');
  yard.events.pointerup();
  yard.events.pointermove({ clientX: 500, clientY: 610 }); frames(60);
  assert.ok(saved.credits >= 38, 'First sale pays job bonus');
  assert.equal(saved.contracts, 1);
  elements.get('upgrade-power').events.click();
  assert.equal(saved.upgrades.power, 1);
  const blast = elements.get('blast');
  assert.equal(blast.disabled, false);
  blast.onclick(); frames(1);
  assert.equal(blast.disabled, true); assert.match(blast.textContent, /Recharging/);
  frames(430); assert.equal(blast.disabled, false);
  windowEvents.blur(); frames(1);
  assert.equal(elements.get('paused').hidden, false);
  assert.equal(blast.disabled, true);
});
