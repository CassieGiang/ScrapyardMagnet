import { TYPES, UPGRADES, YARDS, LOCKERS, openLocker, yardFor, scatterScrap, recoverWreck, nextYard, freshState, restoreState, capacity, cargoWeight, haulRewards, contractFor, contractProgress, canCollect, sell, buy } from './engine.js?v=6';

const $ = id => document.getElementById(id);
const canvas = $('yard'), ctx = canvas.getContext('2d');
const W = 1000, H = 670, SAVE = 'scrapyard-magnet-v1';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let state = freshState(), storageOK = true;
try { state = restoreState(JSON.parse(localStorage.getItem(SAVE))); } catch { storageOK = false; }
let cargo = [], scrap = [], particles = [], labels = [], keys = new Set();
let magnet = { x: 500, y: 525 }, target = { ...magnet }, pulling = false, paused = false;
let sound = false, audio, lastTime = 0, clock = 0, toastUntil = 6, fullWarn = 0;
let part = null, victoryTime = 0;
let blastUntil = 0, blastReady = 0, shake = 0, lastPickup = -5, streak = 0;
let nextPickupAt = 0;
let wreckCharge = 0;
let lockerCharge = 0, revealUntil = 0;
const robotShapes = [
  '<rect x="99" y="74" width="62" height="47" rx="9"/><rect x="112" y="85" width="36" height="20" rx="4"/>',
  '<rect x="104" y="34" width="52" height="36" rx="10"/><path d="M130 34V20"/><circle cx="130" cy="17" r="4"/><circle cx="118" cy="50" r="3" fill="#152127"/><circle cx="142" cy="50" r="3" fill="#152127"/><path d="M120 59H140"/>',
  '<path d="M94 82L80 100L70 90M75 85L65 95" fill="none" stroke-width="11" stroke-linecap="round"/>',
  '<path d="M166 82L180 100L190 90M185 85L195 95" fill="none" stroke-width="11" stroke-linecap="round"/>',
  '<path d="M113 122V137H100M147 122V137H160" fill="none" stroke-width="12" stroke-linecap="round"/>',
];

function save() {
  try { localStorage.setItem(SAVE, JSON.stringify(state)); storageOK = true; }
  catch { storageOK = false; }
  $('save-status').textContent = storageOK ? 'Progress saved on this device' : 'Saving unavailable · keep this tab open';
}
function toast(message, duration = 3) { $('toast').textContent = message; toastUntil = clock + duration; }
function tone(freq = 500, duration = .06, volume = .035) {
  if (!sound) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(freq, audio.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * .6, audio.currentTime + duration);
    gain.gain.setValueAtTime(volume, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
    osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration);
  } catch { sound = false; $('sound').textContent = 'Sound unavailable'; $('sound').setAttribute('aria-pressed', 'false'); }
}
function populate() {
  const starter = state.yard === 0 && state.yardCleared === 0 ? 12 : 0;
  scrap = scatterScrap(yardFor(state).count - state.yardCleared - starter, yardFor(state).materials);
  // An immediate first cluster lets players feel a full haul before crossing the yard.
  for (let i = 0; i < starter; i++) scrap.push({ x: 440 + i % 4 * 38, y: 420 + Math.floor(i / 4) * 30, vx: 0, vy: 0, type: 0, angle: i, shape: i % 3 });
  const locker = LOCKERS[state.yard];
  if (!state.lockers[state.yard]) {
    // Keep the door approachable at every power level. Cover pieces count as ordinary yard scrap.
    for (const item of scrap) if (Math.hypot(item.x - locker.x, item.y - locker.y) < 80) item.type = 0;
    const cover = Math.min(6, Math.max(0, 6 - Math.floor(state.yardCleared / 3)), scrap.length - starter);
    for (let i = 0; i < cover; i++) Object.assign(scrap[i], { x: locker.x - 38 + (i % 3) * 38, y: locker.y - 20 + Math.floor(i / 3) * 40, type: 0 });
  }
}
function nearbyLockerScrap() { const locker = LOCKERS[state.yard]; return scrap.filter(item => Math.hypot(item.x - locker.x, item.y - locker.y) < 72).length; }
function fieldRadius() { return [110, 160, 215, 275][state.upgrades.range]; }
function blast() {
  if (paused || !state.upgrades.power || clock < blastReady) return;
  blastUntil = clock + .9; blastReady = clock + 7; shake = 8;
  burst(magnet.x, magnet.y, '#ffad59', 35); tone(160, .35, .07);
  toast('MAGNETIC BLAST! Sweep across the pile.', 2);
}
function refreshBlast() {
  const wait = Math.max(0, Math.ceil(blastReady - clock));
  $('blast').disabled = paused || !state.upgrades.power || wait > 0;
  $('blast').textContent = !state.upgrades.power ? 'ϟ Blast · unlock power' : wait ? `ϟ Recharging · ${wait}s` : 'ϟ BLAST READY · E';
}
function refresh() {
  const yard = yardFor(state);
  $('yard-name').textContent = yard.name.toUpperCase();
  $('expedition-title').textContent = yard.title;
  $('expedition-progress').textContent = state.recovered ? `Recovered! +$${yard.reward} paid. ${state.yard === YARDS.length - 1 ? 'All three yards explored.' : 'Next yard unlocked.'}` : state.yardCleared >= yard.target ? 'Wreck exposed! Hold your magnet over its center to recover it.' : `Sell ${yard.target - state.yardCleared} more pieces to expose the wreck. Recovery pays $${yard.reward}.`;
  $('yard-fill').style.width = Math.min(100, state.yardCleared / yard.target * 100) + '%';
  $('next-yard').hidden = !state.recovered;
  $('next-yard').textContent = state.yard === YARDS.length - 1 ? 'Expedition complete · revisit North yard ↻' : 'Travel to ' + YARDS[state.yard + 1].name + ' →';
  $('credits').textContent = '$' + state.credits;
  $('finds').textContent = state.lockers.filter(Boolean).length + ' / 3';
  $('collection-list').innerHTML = LOCKERS.map((locker, i) => `<li class="${state.lockers[i] ? 'found' : ''}"><span>${state.lockers[i] ? '◆' : '◇'}</span> ${state.lockers[i] ? locker.find : 'Undiscovered · ' + YARDS[i].name}</li>`).join('');
  $('locker-hint').textContent = state.lockers[state.yard] ? 'Find kept in your collection. Explore the next yard for another.' : 'Find the sealed locker. Clear its surroundings, then pull its door from the marked circle on the right.';
  $('cargo').textContent = `${cargoWeight(cargo)} / ${capacity(state)} kg`;
  $('cargo-fill').style.width = `${cargoWeight(cargo) / capacity(state) * 100}%`;
  const reward = haulRewards(state, cargo), job = contractFor(state);
  $('haul').textContent = `$${reward.total} haul${reward.multiplier > 1 ? ' · ' + reward.multiplier + '×' : ''}`;
  $('job-title').textContent = job.name;
  $('job-goal').textContent = `Bring ${job.count} ${job.type === null ? 'pieces' : TYPES[job.type].name.toLowerCase() + ' pieces'} in one haul`;
  $('job-progress').textContent = `${contractProgress(state, cargo)} / ${job.count}`;
  $('job-reward').textContent = '+$' + job.reward;
  document.querySelector('.job').classList.toggle('complete', reward.bonus > 0);
  refreshBlast();
  for (const key of Object.keys(UPGRADES)) {
    const config = UPGRADES[key], level = state.upgrades[key], button = $('upgrade-' + key);
    button.disabled = level === 3 || state.credits < config.costs[level];
    button.innerHTML = `<span class="icon">${config.icon}</span><span class="details"><strong>${config.name} <small style="display:inline">${level + 1}/4</small></strong><small>${config.text[level]}</small></span><span class="price">${level === 3 ? 'MAX' : '$' + config.costs[level]}</span>`;
    button.setAttribute('aria-label', `${config.name}, ${config.text[level]}, ${level === 3 ? 'fully upgraded' : 'upgrade for ' + config.costs[level] + ' dollars'}`);
  }
  $('parts').textContent = state.parts + ' / 5'; $('robot-fill').style.width = state.parts * 20 + '%';
  $('robot-parts').innerHTML = robotShapes.map((shape, i) => `<g fill="${i < state.parts ? '#b8dfb5' : '#27353b'}" stroke="${i < state.parts ? '#b8dfb5' : '#53636a'}" stroke-width="2">${shape}</g>`).join('');
  if (state.parts === 5) $('robot-copy').innerHTML = 'Rusty is back on his feet. Thanks to you.<br>Take him along on your salvage expedition.';
}
$('next-yard').onclick = () => {
  if (cargo.length) { toast('Sell your cargo before travelling. Your upgrades come with you.'); return; }
  if (nextYard(state)) {
    pulling = false; keys.clear(); blastUntil = 0; nextPickupAt = clock;
    part = null; wreckCharge = 0; lockerCharge = 0; revealUntil = 0; particles = []; labels = []; magnet = { x: 500, y: 525 }; target = { ...magnet };
    populate(); refresh(); save(); toast(`${yardFor(state).name}: a new wreck, new salvage. Your workshop travels with you.`, 5);
  }
};
for (const key of Object.keys(UPGRADES)) {
  const button = document.createElement('button'); button.className = 'upgrade'; button.id = 'upgrade-' + key;
    button.addEventListener('click', () => { if (buy(state, key)) { tone(750, .15); shake = 5; toast(key === 'power' && state.upgrades.power === 1 ? 'MAGNETIC BLAST UNLOCKED! Press E or the Blast button.' : UPGRADES[key].name + ' upgraded. Try your new magnet.'); refresh(); save(); } });
  $('upgrades').append(button);
}
function setPause(value) { paused = value; pulling = false; keys.clear(); $('paused').hidden = !value; $('pause').textContent = value ? 'Resume' : 'Pause'; refreshBlast(); }
$('pause').onclick = () => setPause(!paused);
$('blast').onclick = blast;
$('sound').onclick = () => { sound = !sound; $('sound').textContent = sound ? 'Sound on' : 'Sound off'; $('sound').setAttribute('aria-pressed', String(sound)); tone(); };
$('reset').onclick = () => { setPause(true); $('reset-dialog').showModal(); };
$('reset-dialog').addEventListener('close', () => {
  if ($('reset-dialog').returnValue === 'reset') {
    state = freshState(); cargo = []; particles = []; labels = []; part = null; victoryTime = 0; magnet = { x: 500, y: 525 }; target = { ...magnet };
    blastUntil = 0; blastReady = 0; shake = 0; streak = 0; lastPickup = -5; nextPickupAt = 0; wreckCharge = 0; lockerCharge = 0; revealUntil = 0;
    $('robot-copy').innerHTML = 'Five lost parts. One second chance.<br>Find glowing parts buried in the scrap.';
    populate(); refresh(); save(); toast('Fresh yard. Fresh possibilities.');
  }
  setPause(false);
});
function pointer(event) {
  const rect = canvas.getBoundingClientRect();
  target.x = Math.max(25, Math.min(975, (event.clientX - rect.left) * W / rect.width));
  target.y = Math.max(50, Math.min(630, (event.clientY - rect.top) * H / rect.height));
}
canvas.addEventListener('pointerdown', e => { if (e.button !== 0 || paused) return; e.preventDefault(); canvas.focus({ preventScroll: true }); pointer(e); pulling = true; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', pointer);
canvas.addEventListener('pointerup', () => pulling = false);
canvas.addEventListener('pointercancel', () => pulling = false);
window.addEventListener('blur', () => { if (!$('reset-dialog').open) setPause(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden) setPause(true); });
window.addEventListener('keydown', e => {
  if ($('reset-dialog').open) return;
  const key = e.key.toLowerCase();
  if (key === 'e' && !e.repeat) { e.preventDefault(); blast(); return; }
  if (e.target instanceof HTMLButtonElement && key === ' ') return;
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'p'].includes(key)) { e.preventDefault(); if (key === 'p' && !e.repeat) setPause(!paused); else keys.add(key); }
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

function burst(x, y, color, count = 8) { for (let i = 0; i < count; i++) particles.push({ x, y, vx: (Math.random() - .5) * 180, vy: (Math.random() - .5) * 180, life: .6, color }); }
function update(dt) {
  clock += dt;
  const dx = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
  const dy = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
  if (dx || dy) { const len = Math.hypot(dx, dy); target = { x: Math.max(25, Math.min(975, magnet.x + dx / len * 360 * dt)), y: Math.max(50, Math.min(630, magnet.y + dy / len * 360 * dt)) }; magnet = { ...target }; }
  else { const ease = 1 - Math.exp(-12 * dt); magnet.x += (target.x - magnet.x) * ease; magnet.y += (target.y - magnet.y) * ease; }
  const blasting = clock < blastUntil;
  const active = pulling || keys.has(' ') || blasting, radius = fieldRadius() + (blasting ? 130 + state.upgrades.power * 35 : 0);
  refreshBlast(); shake = Math.max(0, shake - dt * 18);
  for (let i = scrap.length - 1; i >= 0; i--) {
    const item = scrap[i], distance = Math.hypot(magnet.x - item.x, magnet.y - item.y);
    if (active && distance < radius && canCollect(state, cargo, item)) {
      const speed = (180 + state.upgrades.power * 80) * (blasting ? 1.6 : 1);
      const step = Math.min(distance, speed * dt);
      item.x += (magnet.x - item.x) / Math.max(1, distance) * step;
      item.y += (magnet.y - item.y) / Math.max(1, distance) * step;
      item.angle += dt * 4;
      if (distance - step < 22 && clock >= nextPickupAt) {
        nextPickupAt = clock + (blasting ? .07 : .14);
        cargo.push(item); scrap.splice(i, 1); burst(item.x, item.y, TYPES[item.type].color, 9);
        streak = clock - lastPickup < .8 ? streak + 1 : 1; lastPickup = clock;
        shake = Math.min(4, 1 + streak * .25); tone(440 + Math.min(streak, 16) * 45);
        labels.push({ x: magnet.x + (Math.random() - .5) * 45, y: magnet.y - 30, text: '+$' + TYPES[item.type].value, life: .6, small: true });
        if (cargo.length === 6 || cargo.length === 10) { const multi = cargo.length === 10 ? '2×' : '1.5×'; labels.push({ x: magnet.x, y: magnet.y - 65, text: multi + ' HAUL BONUS', life: 1.2 }); tone(900, .15); }
        refresh(); continue;
      }
    } else if (active && distance < 45 && clock > fullWarn) {
      toast(TYPES[item.type].power > state.upgrades.power + 1 ? `${TYPES[item.type].name} needs pull power level ${TYPES[item.type].power}.` : 'Cargo full. Bring your haul to the sell bay below.'); fullWarn = clock + 5;
    }
    const drag = Math.exp(-5 * dt); item.vx *= drag; item.vy *= drag;
    item.x = Math.max(30, Math.min(970, item.x + item.vx * dt)); item.y = Math.max(55, Math.min(525, item.y + item.vy * dt));
  }
  if (magnet.y > 555 && magnet.x > 335 && magnet.x < 665 && cargo.length) {
    const reward = haulRewards(state, cargo), value = sell(state, cargo);
    labels.push({ x: 500, y: 535, text: '+$' + value + (reward.bonus ? ' · JOB COMPLETE!' : ''), life: 2 });
    burst(magnet.x, magnet.y, '#b8dfb5', 45); shake = 6; tone(1000, .25);
    toast(reward.bonus ? `JOB COMPLETE! $${reward.base} scrap × ${reward.multiplier} + $${reward.bonus} job = $${value}. Pick a workshop upgrade!` : `$${value} banked! ${reward.multiplier}× scrap payout. Check your next salvage job.`, 5);
    refresh(); save();
  }
  // Parts appear at cumulative salvage milestones; they never occupy cargo space.
  const milestones = [8, 22, 45, 75, 110];
  if (state.parts < 5 && !part && state.sold >= milestones[state.parts]) {
    part = { x: 120 + Math.random() * 760, y: 130 + Math.random() * 270 };
    toast('A part for Rusty! Pull the glowing green component.', 5);
  }
  if (part && active && Math.hypot(magnet.x - part.x, magnet.y - part.y) < radius) {
    part.x += (magnet.x - part.x) * Math.min(1, dt * 4); part.y += (magnet.y - part.y) * Math.min(1, dt * 4);
    if (Math.hypot(magnet.x - part.x, magnet.y - part.y) < 25) {
      burst(part.x, part.y, '#b8dfb5', 30); part = null; state.parts++; tone(1200, .3); refresh(); save();
      if (state.parts === 5) { victoryTime = clock + 5; toast('You did it. Rusty lives! The yard is yours to keep exploring.', 8); }
      else toast(`Rusty restored: ${state.parts}/5 parts. Keep salvaging!`, 4);
    }
  }
  // A yard stays cleared. New piles arrive only when travelling to the next yard.
  if (!state.recovered && state.yardCleared >= yardFor(state).target && active && Math.hypot(magnet.x - 500, magnet.y - 280) < 95) {
    wreckCharge += dt;
    if (wreckCharge >= 2.5 && recoverWreck(state)) {
      burst(500, 280, yardFor(state).color, 65); shake = 6; tone(1000, .4);
      labels.push({ x: 500, y: 250, text: 'RECOVERED! +$' + yardFor(state).reward, life: 3 });
      toast(state.yard === 2 ? 'Expedition complete! Your salvage mech is recovered. Revisit any of the yards by continuing the route.' : 'Wreck recovered! Sell any cargo, then travel to the next yard.', 6);
      refresh(); save();
    }
  } else if (!state.recovered) wreckCharge = Math.max(0, wreckCharge - dt * .5);
  const locker = LOCKERS[state.yard];
  if (!state.lockers[state.yard] && (pulling || keys.has(' ')) && nearbyLockerScrap() === 0 && Math.hypot(magnet.x - locker.x - 85, magnet.y - locker.y) < 42) {
    lockerCharge = Math.min(1.6, lockerCharge + dt);
    if (lockerCharge >= 1.6 && openLocker(state, nearbyLockerScrap())) {
      revealUntil = clock + 5; shake = 5; burst(locker.x, locker.y, locker.color, 40); tone(1100, .35);
      labels.push({ x: locker.x, y: locker.y - 80, text: locker.find.toUpperCase(), life: 3 });
      toast(`FOUND: ${locker.find}! Kept in your collection, plus $${locker.reward} banked.`, 6);
      refresh(); save();
    }
  } else if (!state.lockers[state.yard]) lockerCharge = Math.max(0, lockerCharge - dt * .6);
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
  particles = particles.filter(p => p.life > 0);
  for (const label of labels) { label.y -= dt * 28; label.life -= dt; } labels = labels.filter(l => l.life > 0);
  $('toast').style.opacity = clock < toastUntil ? '1' : '0';
}

function rounded(x, y, w, h, r, fill, stroke) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); } }
function text(value, x, y, size = 12, color = '#8fa2a5', align = 'left') { ctx.font = `600 ${size}px "DM Sans", sans-serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(value, x, y); }
function drawLocker() {
  const locker = LOCKERS[state.yard], opened = state.lockers[state.yard];
  const progress = opened ? 1 : lockerCharge / 1.6, blockers = nearbyLockerScrap();
  ctx.save(); ctx.translate(locker.x, locker.y);
  rounded(-34, -42, 68, 84, 5, '#111c21', '#a07856');
  if (opened) {
    ctx.strokeStyle = locker.color; ctx.lineWidth = 3;
    if (state.yard === 0) { rounded(-22, -13, 44, 30, 4, '#59676b', locker.color); rounded(-15, -20, 14, 7, 1, locker.color); ctx.beginPath(); ctx.arc(4, 2, 10, 0, 7); ctx.stroke(); }
    else if (state.yard === 1) { rounded(-23, -16, 46, 36, 4, '#3c5960', locker.color); ctx.beginPath(); ctx.moveTo(12, -16); ctx.lineTo(22, -32); ctx.stroke(); for (let x = -16; x < 4; x += 6) { ctx.beginPath(); ctx.moveTo(x, -8); ctx.lineTo(x, 10); ctx.stroke(); } }
    else { rounded(-12, -10, 24, 20, 4, '#574369', locker.color); for (const x of [-20, 20]) for (const y of [-20, 20]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.ellipse(x, y, 12, 4, 0, 0, 7); ctx.stroke(); } }
  }
  ctx.save(); ctx.translate(progress * 72, 0); ctx.scale(1 - progress * .75, 1);
  rounded(-31, -39, 62, 78, 4, '#654c3d', '#ba926d');
  rounded(14, -6, 5, 18, 2, '#d8bf92');
  for (let y = -27; y < -9; y += 6) { ctx.fillStyle = '#302d28'; ctx.fillRect(-18, y, 32, 2); }
  ctx.restore();
  if (!opened && blockers === 0) {
    ctx.strokeStyle = locker.color; ctx.lineWidth = 2; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(35 + progress * 50, 0); ctx.lineTo(85, 0); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(85, 0, 25, 0, 7); ctx.stroke(); text('→', 85, 7, 22, locker.color, 'center');
    ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 53, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2); ctx.stroke();
  }
  text(opened ? locker.find.toUpperCase() : blockers ? `SEALED LOCKER · CLEAR ${blockers}` : 'HOLD IN CIRCLE → PULL OPEN', 0, 66, 10, opened ? locker.color : '#dbc7a1', 'center');
  if (clock < revealUntil) { ctx.globalAlpha = Math.max(0, Math.min(1, revealUntil - clock)); text('FIND KEPT  +$' + locker.reward, 0, -62, 15, locker.color, 'center'); }
  ctx.restore();
}
function drawWreck() {
  const yard = yardFor(state), exposed = state.yardCleared >= yard.target;
  ctx.save(); ctx.translate(500, 280); ctx.globalAlpha = state.recovered ? .85 : .16 + Math.min(1, state.yardCleared / yard.target) * .6;
  ctx.lineWidth = 5; ctx.strokeStyle = yard.color;
  if (state.yard === 0) {
    for (const x of [-65, 65]) { ctx.beginPath(); ctx.arc(x, 25, 24, 0, 7); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-65, 25); ctx.lineTo(25, 25); ctx.lineTo(50, -50); ctx.lineTo(30, -50); ctx.moveTo(25, 25); ctx.lineTo(-20, -20); ctx.lineTo(-45, -20); ctx.stroke();
  } else if (state.yard === 1) {
    rounded(-100, -55, 125, 70, 15, '#24323b', yard.color); rounded(25, -85, 70, 100, 6, '#24323b', yard.color); rounded(40, -70, 38, 30, 3, null, yard.color); rounded(-70, -85, 20, 30, 2, yard.color);
    for (const x of [-65, -5, 65]) { ctx.beginPath(); ctx.arc(x, 30, 23, 0, 7); ctx.stroke(); }
  } else {
    rounded(-45, -55, 90, 85, 14, '#302b3a', yard.color); rounded(-25, -95, 50, 35, 8, '#302b3a', yard.color);
    for (const sign of [-1, 1]) { rounded(sign * 70 - 15, -45, 30, 80, 8, '#302b3a', yard.color); rounded(sign * 28 - 12, 35, 24, 55, 5, '#302b3a', yard.color); }
  }
  if (exposed && !state.recovered) { ctx.globalAlpha = 1; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 110, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * wreckCharge / 2.5); ctx.stroke(); }
  ctx.restore();
  text(state.recovered ? 'RECOVERED · NEXT YARD READY' : exposed ? 'HOLD MAGNET HERE · RECOVER WRECK' : yard.title.toUpperCase(), 500, 400, 13, exposed ? yard.color : '#667d80', 'center');
}
function draw() {
  ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#192329'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  if (!paused && !reduceMotion && shake > 0) ctx.translate(Math.sin(clock * 71) * shake, Math.cos(clock * 83) * shake);
  ctx.strokeStyle = '#233138'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // The fence, floodlights, and storage stacks give the yard a sense of place.
  rounded(25, 34, 950, 490, 14, null, '#465148'); ctx.setLineDash([5, 8]); rounded(35, 44, 930, 470, 10, null, '#303c39'); ctx.setLineDash([]);
  for (const x of [50, 950]) { rounded(x - 8, 18, 16, 31, 3, '#596263'); rounded(x - 14, 20, 28, 7, 2, '#d8bd7e'); }
  text('N / 04', 65, 68, 11, '#697873'); text('FERROUS MATERIAL RECOVERY', 935, 68, 10, '#697873', 'right');
  drawWreck();
  drawLocker();
  ctx.fillStyle = '#121c20'; ctx.fillRect(0, 539, W, 131);
  for (let x = 10; x < W; x += 30) { if (x > 320 && x < 680) continue; ctx.fillStyle = '#61553b'; ctx.beginPath(); ctx.moveTo(x, 540); ctx.lineTo(x + 12, 540); ctx.lineTo(x - 4, 550); ctx.lineTo(x - 16, 550); ctx.fill(); }
  rounded(337, 552, 326, 94, 9, '#243b34', '#65836b');
  text('↓  SELL SCRAP  ↓', 500, 588, 19, '#b8dfb5', 'center'); text('MOVE HERE TO UNLOAD', 500, 616, 11, '#8aa994', 'center');
  rounded(70, 574, 140, 60, 5, '#293239', '#475056'); text('SCRAP / KG', 140, 597, 10, '#b5bab2', 'center'); text('STEEL $2 · COPPER $5', 140, 617, 10, '#8f9c98', 'center');
  rounded(790, 567, 135, 70, 4, '#2c3639', '#53615c'); for (let x = 800; x < 920; x += 18) { ctx.fillStyle = '#3a4748'; ctx.fillRect(x, 575, 3, 54); } text('SALVAGE CO.', 857, 608, 11, '#9ba791', 'center');
  for (const item of scrap) {
    const type = TYPES[item.type]; ctx.save(); ctx.translate(item.x, item.y); ctx.rotate(item.angle);
    ctx.shadowColor = '#0007'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 4;
    if (item.type >= 2) { const size = item.type === 4 ? 20 : 15; rounded(-size, -12, size * 2, 24, 4, type.color, '#59644f'); ctx.shadowBlur = 0; ctx.fillStyle = '#344651'; for (let i = -9; i < 12; i += 6) ctx.fillRect(i, -7, 3, 14); if (item.type >= 3) { ctx.strokeStyle = '#eef7ff'; ctx.lineWidth = 2; ctx.strokeRect(-size + 3, -8, size * 2 - 6, 16); } }
    else if (item.type === 1) { ctx.strokeStyle = type.color; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 9, .4, 5.6); ctx.stroke(); }
    else if (item.shape === 0) { rounded(-11, -5, 22, 10, 2, type.color); ctx.fillStyle = '#56666b'; ctx.fillRect(-7, -2, 14, 2); }
    else if (item.shape === 1) { rounded(-8, -8, 16, 16, 3, type.color); ctx.fillStyle = '#34464a'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, 7); ctx.fill(); }
    else { rounded(-4, -12, 8, 24, 2, type.color); rounded(-8, -10, 16, 5, 1, type.color); }
    ctx.restore();
  }
  if (part) {
    ctx.save(); ctx.translate(part.x, part.y); ctx.shadowColor = '#b8dfb5'; ctx.shadowBlur = 20;
    ctx.strokeStyle = '#b8dfb5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 25 + Math.sin(clock * 4) * 3, 0, 7); ctx.stroke();
    rounded(-12, -12, 24, 24, 5, '#b8dfb5'); text('+', 0, 6, 19, '#243b34', 'center'); ctx.restore(); text('RUSTY’S PART', part.x, part.y - 38, 11, '#b8dfb5', 'center');
  }
  const blasting = clock < blastUntil;
  const active = (pulling || keys.has(' ') || blasting) && !paused, radius = fieldRadius() + (blasting ? 130 + state.upgrades.power * 35 : 0);
  ctx.save(); ctx.translate(magnet.x, magnet.y);
  const gradient = ctx.createRadialGradient(0, 0, 10, 0, 0, radius); gradient.addColorStop(0, active ? '#ffad5918' : '#ffad5907'); gradient.addColorStop(1, '#ffad5900');
  ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(0, 0, radius, 0, 7); ctx.fill();
  ctx.strokeStyle = active ? '#ffad5970' : '#ffad5930'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 7]); ctx.lineDashOffset = -clock * 12; ctx.beginPath(); ctx.arc(0, 0, radius, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  if (active) { const ripple = (clock * .8) % 1; ctx.globalAlpha = ripple * .4; ctx.strokeStyle = '#ffad59'; ctx.beginPath(); ctx.arc(0, 0, radius * (1 - ripple), 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
  ctx.shadowColor = '#0008'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 7;
  ctx.strokeStyle = '#ffad59'; ctx.lineWidth = 17; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.arc(0, -4, 18, Math.PI, 0); ctx.lineTo(18, 20); ctx.moveTo(-18, -4); ctx.lineTo(-18, 20); ctx.stroke();
  ctx.strokeStyle = '#e4e8df'; ctx.lineWidth = 17; ctx.beginPath(); ctx.moveTo(-18, 13); ctx.lineTo(-18, 23); ctx.moveTo(18, 13); ctx.lineTo(18, 23); ctx.stroke();
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  if (cargo.length) { rounded(-24, 35, 48, 21, 5, '#10191e', '#4b5e5b'); text(cargoWeight(cargo) + ' kg', 0, 50, 11, '#ffcc92', 'center'); }
  ctx.restore();
  if (clock - lastPickup < .8 && streak >= 3) text(streak + ' PIECE SWEEP!', magnet.x, magnet.y - 55, 18, '#ffcc92', 'center');
  for (const p of particles) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 4, 4); } ctx.globalAlpha = 1;
  for (const l of labels) { ctx.globalAlpha = Math.min(1, l.life * 2); text(l.text, l.x, l.y, l.small ? 14 : 26, l.small ? '#ffcc92' : '#b8dfb5', 'center'); } ctx.globalAlpha = 1;
  if (clock < victoryTime) { text('RUSTY LIVES. NICE WORK, SALVAGER.', 500, 305, 24, '#b8dfb5', 'center'); }
  ctx.restore();
}
function frame(time) { const dt = Math.min(.04, (time - lastTime) / 1000 || 0); lastTime = time; if (!paused) update(dt); draw(); requestAnimationFrame(frame); }
populate(); refresh(); save(); requestAnimationFrame(frame);
