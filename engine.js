export const TYPES = [
  { name: 'Steel', value: 2, weight: 1, power: 1, color: '#98acb0' },
  { name: 'Copper', value: 5, weight: 2, power: 1, color: '#d78b58' },
  { name: 'Engine', value: 18, weight: 4, power: 2, color: '#c5cc98' },
];
export const UPGRADES = {
  power: { name: 'Pull power', icon: 'ϟ', text: ['Next: engines + magnetic blast', 'Blast unlocked · next: 2× blast', '2× blast · next: 3× blast', 'Maximum blast power'], costs: [20, 100, 220] },
  range: { name: 'Magnetic reach', icon: '◎', text: ['Next: double your field area', 'Wide field · next: yard sweeper', 'Yard sweeper · next: giant field', 'Full-spectrum field'], costs: [20, 85, 180] },
  capacity: { name: 'Cargo capacity', icon: '▤', text: ['12 kg hold', '24 kg hold', '40 kg hold', '60 kg hold'], costs: [20, 75, 160] },
};
export const CONTRACTS = [
  { name: 'Your first payday', type: null, count: 6, reward: 20 },
  { name: 'Copper rush', type: 1, count: 3, reward: 35 },
  { name: 'Heavy metal', type: 2, count: 2, reward: 60 },
  { name: 'Clean sweep', type: null, count: 15, reward: 80 },
];
export function freshState() { return { credits: 0, parts: 0, sold: 0, contracts: 0, upgrades: { power: 0, range: 0, capacity: 0 } }; }
export function contractFor(state) { return CONTRACTS[Math.min(state.contracts, CONTRACTS.length - 1)]; }
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
export function sell(state, cargo) { const reward = haulRewards(state, cargo); state.credits += reward.total; state.sold += cargo.length; if (reward.bonus) state.contracts++; cargo.length = 0; return reward.total; }
export function buy(state, key) { const cost = UPGRADES[key]?.costs[state.upgrades[key]]; if (cost === undefined || state.credits < cost) return false; state.credits -= cost; state.upgrades[key]++; return true; }
export function restoreState(raw) {
  const s = freshState();
  if (!raw || typeof raw !== 'object') return s;
  for (const k of ['credits', 'parts', 'sold', 'contracts']) if (Number.isSafeInteger(raw[k]) && raw[k] >= 0) s[k] = k === 'parts' ? Math.min(5, raw[k]) : raw[k];
  for (const k of Object.keys(s.upgrades)) if (Number.isInteger(raw.upgrades?.[k])) s.upgrades[k] = Math.max(0, Math.min(3, raw.upgrades[k]));
  return s;
}
