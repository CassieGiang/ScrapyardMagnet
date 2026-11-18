export const TYPES = [
  { name: 'Steel', value: 2, weight: 1, power: 1, color: '#98acb0' },
  { name: 'Copper', value: 5, weight: 2, power: 1, color: '#d78b58' },
  { name: 'Engine', value: 18, weight: 4, power: 2, color: '#c5cc98' },
  { name: 'Motor', value: 35, weight: 6, power: 3, color: '#8cbfda' },
  { name: 'Reactor core', value: 80, weight: 10, power: 4, color: '#ce9de0' },
];
export const UPGRADES = {
  power: { name: 'Pull power', icon: 'ϟ', text: ['Next: engines + magnetic blast', 'Next: salvage industrial motors', 'Next: extract reactor cores', 'All salvage unlocked'], costs: [20, 350, 1600] },
  range: { name: 'Magnetic reach', icon: '◎', text: ['Next: double your field area', 'Wide field · next: yard sweeper', 'Yard sweeper · next: giant field', 'Full-spectrum field'], costs: [20, 275, 1200] },
  capacity: { name: 'Cargo capacity', icon: '▤', text: ['12 kg hold', '24 kg hold', '40 kg hold', '60 kg hold'], costs: [20, 250, 1000] },
};
export const YARDS = [
  { name: 'North yard', title: 'The buried scooter', count: 90, target: 60, reward: 100, color: '#d8b679', materials: [0, 0, 0, 0, 1, 1, 2] },
  { name: 'Rail depot', title: 'The forgotten locomotive', count: 120, target: 85, reward: 450, color: '#8cbfda', materials: [0, 0, 1, 1, 1, 2, 2, 3] },
  { name: 'Reactor ruins', title: 'The sleeping salvage mech', count: 150, target: 100, reward: 1200, color: '#ce9de0', materials: [0, 1, 1, 2, 2, 3, 3, 4] },
];
export function yardFor(state) { return YARDS[state.yard]; }
export function recoverWreck(state) {
  const yard = yardFor(state);
  if (state.recovered || state.yardCleared < yard.target) return false;
  state.recovered = true; state.credits += yard.reward; return true;
}
export function nextYard(state) {
  if (!state.recovered) return false;
  state.yard = (state.yard + 1) % YARDS.length; state.yardCleared = 0; state.recovered = false; return true;
}
export const CONTRACTS = [
  { name: 'Your first payday', type: null, count: 6, reward: 20 },
  { name: 'Copper rush', type: 1, count: 3, reward: 35 },
  { name: 'Heavy metal', type: 2, count: 2, reward: 60 },
  { name: 'Clean sweep', type: null, count: 15, reward: 80 },
];
export function freshState() { return { credits: 0, parts: 0, sold: 0, contracts: 0, yard: 0, yardCleared: 0, recovered: false, upgrades: { power: 0, range: 0, capacity: 0 } }; }
export function contractFor(state) {
  if (state.contracts < 3) return CONTRACTS[state.contracts];
  const available = [...new Set(yardFor(state).materials)].filter(type => TYPES[type].power <= state.upgrades.power + 1);
  // Every fourth order is a bulk haul; others rotate through collectable local material.
  const type = state.contracts % 4 === 3 ? null : available[state.contracts % available.length];
  const count = type === null ? Math.min(15, capacity(state)) : Math.min(5, Math.floor(capacity(state) / TYPES[type].weight));
  return { name: type === null ? 'Clean sweep' : TYPES[type].name + ' shipment', type, count, reward: type === null ? 40 : TYPES[type].value * count };
}
export function contractProgress(state, cargo) { const job = contractFor(state); return Math.min(job.count, cargo.filter(item => job.type === null || item.type === job.type).length); }
export function haulRewards(state, cargo) {
  const base = cargoValue(cargo), count = cargo.length;
  const multiplier = count >= 10 ? 2 : count >= 6 ? 1.5 : 1;
  const bonus = count && contractProgress(state, cargo) >= contractFor(state).count ? contractFor(state).reward : 0;
  return { base, multiplier, bonus, total: Math.floor(base * multiplier) + bonus };
}
export function capacity(state) { return [12, 24, 40, 60][state.upgrades.capacity]; }
export function cargoWeight(cargo) { return cargo.reduce((n, item) => n + TYPES[item.type].weight, 0); }
export function cargoValue(cargo) { return cargo.reduce((n, item) => n + TYPES[item.type].value, 0); }
export function canCollect(state, cargo, item) { return TYPES[item.type].power <= state.upgrades.power + 1 && cargoWeight(cargo) + TYPES[item.type].weight <= capacity(state); }
export function sell(state, cargo) { const reward = haulRewards(state, cargo); state.credits += reward.total; state.sold += cargo.length; state.yardCleared = Math.min(yardFor(state).count, state.yardCleared + cargo.length); if (reward.bonus) state.contracts++; cargo.length = 0; return reward.total; }
export function buy(state, key) { const cost = UPGRADES[key]?.costs[state.upgrades[key]]; if (cost === undefined || state.credits < cost) return false; state.credits -= cost; state.upgrades[key]++; return true; }
export function restoreState(raw) {
  const s = freshState();
  if (!raw || typeof raw !== 'object') return s;
  for (const k of ['credits', 'parts', 'sold', 'contracts']) if (Number.isSafeInteger(raw[k]) && raw[k] >= 0) s[k] = k === 'parts' ? Math.min(5, raw[k]) : raw[k];
  for (const k of Object.keys(s.upgrades)) if (Number.isInteger(raw.upgrades?.[k])) s.upgrades[k] = Math.max(0, Math.min(3, raw.upgrades[k]));
  if (Number.isInteger(raw.yard)) s.yard = Math.max(0, Math.min(YARDS.length - 1, raw.yard));
  if (Number.isSafeInteger(raw.yardCleared)) s.yardCleared = Math.max(0, Math.min(yardFor(s).count, raw.yardCleared));
  s.recovered = raw.recovered === true && s.yardCleared >= yardFor(s).target;
  return s;
}
