// Static game data: cars, upgrades, career series, AI drivers.

export const CARS = [
  {
    id: 'hatch', name: 'Vento Hatch', price: 0,
    desc: 'Nimble front-wheel-drive hatch. Forgiving and cheap to upgrade.',
    stats: { maxSpeed: 58, accel: 16, grip: 6.8, turn: 1.0, brake: 36 },
    shape: 'hatch',
  },
  {
    id: 'gt', name: 'Strada GT', price: 14000,
    desc: 'Rear-drive grand tourer. Big power, needs a steady hand.',
    stats: { maxSpeed: 70, accel: 20, grip: 7.6, turn: 1.04, brake: 40 },
    shape: 'gt',
  },
  {
    id: 'proto', name: 'Nightfall LMP', price: 32000,
    desc: 'Endurance prototype with massive downforce and a giant rear wing.',
    stats: { maxSpeed: 78, accel: 23, grip: 8.8, turn: 1.1, brake: 46 },
    shape: 'proto',
  },
  {
    id: 'formula', name: 'Apex F1', price: 60000,
    desc: 'Open-wheel single seater. The fastest thing on four wheels.',
    stats: { maxSpeed: 90, accel: 27, grip: 9.8, turn: 1.18, brake: 52 },
    shape: 'formula',
  },
];

export const UPGRADES = [
  { id: 'engine', name: 'Engine', desc: '+top speed, +acceleration', maxLevel: 5 },
  { id: 'tires', name: 'Tires', desc: '+cornering grip', maxLevel: 5 },
  { id: 'brakes', name: 'Brakes', desc: '+braking power', maxLevel: 5 },
  { id: 'aero', name: 'Aero kit', desc: '+turn-in response, +high-speed stability', maxLevel: 5 },
];

export function upgradeCost(car, upgradeId, currentLevel) {
  const base = 900 + car.price * 0.045;
  return Math.round((base * Math.pow(currentLevel + 1, 1.45)) / 50) * 50;
}

/** Apply upgrade levels to a car's base stats. */
export function effectiveStats(car, levels = {}) {
  const e = levels.engine || 0, t = levels.tires || 0, b = levels.brakes || 0, a = levels.aero || 0;
  const s = car.stats;
  return {
    maxSpeed: s.maxSpeed * (1 + 0.045 * e),
    accel: s.accel * (1 + 0.07 * e),
    grip: s.grip * (1 + 0.06 * t + 0.02 * a),
    turn: s.turn * (1 + 0.035 * a),
    brake: s.brake * (1 + 0.08 * b),
  };
}

export const PLAYER_COLORS = [
  0xff5a1f, 0x2f7bff, 0x3ddc84, 0xffd23f, 0xb04cff, 0xff4d9d, 0x00d4ff, 0xffffff,
];

export const AI_COLORS = [
  0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x8e44ad, 0x16a085, 0xd35400, 0x7f8c8d,
  0x2c3e50, 0xe91e63, 0x00bcd4, 0x9e9d24,
];

export const AI_DRIVERS = [
  { name: 'M. Vettore', skill: 1.00 },
  { name: 'K. Raiko', skill: 0.97 },
  { name: 'L. Hamil', skill: 0.99 },
  { name: 'S. Perez-Ortiz', skill: 0.94 },
  { name: 'A. Nakamura', skill: 0.95 },
  { name: 'J. Kowalski', skill: 0.91 },
  { name: 'D. Okafor', skill: 0.93 },
  { name: 'E. Lindqvist', skill: 0.90 },
  { name: 'R. Da Silva', skill: 0.92 },
  { name: 'T. Brennan', skill: 0.88 },
  { name: 'Y. Petrova', skill: 0.89 },
  { name: 'F. Moreau', skill: 0.87 },
];

export const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

export const SERIES = [
  {
    id: 'rookie', name: 'Rookie Cup', tier: 1,
    desc: 'Three short races against club drivers. Win it to earn your Pro licence.',
    aiCount: 5, aiSkill: 0.72, requires: null, requireRank: 3,
    prize: [3000, 2200, 1600, 1100, 800, 500],
    bonus: 6000,
    events: [
      { track: 'sunrise', laps: 2 },
      { track: 'coastal', laps: 2 },
      { track: 'alpine', laps: 2 },
    ],
  },
  {
    id: 'pro', name: 'Pro Series', tier: 2,
    desc: 'Longer races, sharper opponents, real prize money.',
    aiCount: 7, aiSkill: 0.9, requires: 'rookie', requireRank: 3,
    prize: [6000, 4400, 3200, 2400, 1800, 1200, 800, 500],
    bonus: 15000,
    events: [
      { track: 'desert', laps: 3 },
      { track: 'monza', laps: 2 },
      { track: 'neon', laps: 3 },
      { track: 'interlagos', laps: 2 },
      { track: 'coastal', laps: 3 },
    ],
  },
  {
    id: 'gp', name: 'Grand Prix Championship', tier: 3,
    desc: 'The world championship. Nine elite drivers, six circuits, no mercy.',
    aiCount: 9, aiSkill: 1.0, requires: 'pro', requireRank: 2,
    prize: [14000, 10000, 7500, 5500, 4000, 3000, 2200, 1500, 1000, 600],
    bonus: 40000,
    events: [
      { track: 'silverstone', laps: 3 },
      { track: 'alpine', laps: 4 },
      { track: 'monza', laps: 3 },
      { track: 'spa', laps: 3 },
      { track: 'interlagos', laps: 3 },
      { track: 'neon', laps: 4 },
    ],
  },
  {
    id: 'legends', name: 'Legends Endurance', tier: 4,
    desc: 'Long-distance showdown for champions only. Everything you own, on the line.',
    aiCount: 11, aiSkill: 1.06, requires: 'gp', requireRank: 1,
    prize: [30000, 20000, 14000, 10000, 8000, 6000, 4500, 3500, 2500, 2000, 1500, 1000],
    bonus: 100000,
    events: [
      { track: 'spa', laps: 5 },
      { track: 'silverstone', laps: 5 },
      { track: 'monza', laps: 6 },
      { track: 'neon', laps: 6 },
    ],
  },
];

export function getCar(id) { return CARS.find(c => c.id === id) || CARS[0]; }
export function getSeries(id) { return SERIES.find(s => s.id === id); }
