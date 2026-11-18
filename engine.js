export const TYPES = [
  { name: 'Steel', value: 2, weight: 1, power: 1, color: '#98acb0' },
  { name: 'Copper', value: 5, weight: 2, power: 1, color: '#d78b58' },
  { name: 'Engine', value: 18, weight: 4, power: 2, color: '#c5cc98' },
];
export const UPGRADES = {
  power: { name: 'Pull power', icon: 'ϟ', text: ['Steel & copper', 'Engines unlocked', 'Heavy-duty pulling', 'Maximum pulling force'], costs: [30, 100, 220] },
  range: { name: 'Magnetic reach', icon: '◎', text: ['Compact field', 'Wider field', 'Yard sweeper', 'Full-spectrum field'], costs: [25, 85, 180] },
  capacity: { name: 'Cargo capacity', icon: '▤', text: ['12 kg hold', '24 kg hold', '40 kg hold', '60 kg hold'], costs: [20, 75, 160] },
};
export function freshState() { return { credits: 0, parts: 0, sold: 0, upgrades: { power: 0, range: 0, capacity: 0 } }; }
export function capacity(state) { return [12, 24, 40, 60][state.upgrades.capacity]; }
export function cargoWeight(cargo) { return cargo.reduce((n, item) => n + TYPES[item.type].weight, 0); }
export function cargoValue(cargo) { return cargo.reduce((n, item) => n + TYPES[item.type].value, 0); }
export function canCollect(state, cargo, item) { return TYPES[item.type].power <= state.upgrades.power + 1 && cargoWeight(cargo) + TYPES[item.type].weight <= capacity(state); }
export function sell(state, cargo) { const value = cargoValue(cargo); state.credits += value; state.sold += cargo.length; cargo.length = 0; return value; }
export function buy(state, key) { const cost = UPGRADES[key]?.costs[state.upgrades[key]]; if (cost === undefined || state.credits < cost) return false; state.credits -= cost; state.upgrades[key]++; return true; }
export function restoreState(raw) {
  const s = freshState();
  if (!raw || typeof raw !== 'object') return s;
  for (const k of ['credits', 'parts', 'sold']) if (Number.isSafeInteger(raw[k]) && raw[k] >= 0) s[k] = k === 'parts' ? Math.min(5, raw[k]) : raw[k];
  for (const k of Object.keys(s.upgrades)) if (Number.isInteger(raw.upgrades?.[k])) s.upgrades[k] = Math.max(0, Math.min(3, raw.upgrades[k]));
  return s;
}
