// Track definitions. `points` are 2D control points (x, z) of a closed
// Catmull-Rom spline. The car starts at points[0] heading toward points[1].

export const TRACKS = [
  {
    id: 'sunrise', name: 'Sunrise Speedway', theme: 'grass', difficulty: 1,
    desc: 'A fast, flowing club circuit. Great for learning the ropes.',
    width: 16,
    points: [
      [0, 0], [130, 0], [230, 30], [290, 110], [280, 200], [200, 250],
      [90, 240], [-10, 275], [-140, 265], [-235, 195], [-255, 90],
      [-205, 10], [-100, -12],
    ],
  },
  {
    id: 'coastal', name: 'Azure Coast', theme: 'coastal', difficulty: 2,
    desc: 'Cliff-side esses along the ocean. Watch the late apexes.',
    width: 15,
    points: [
      [0, 0], [150, 0], [265, -40], [345, 45], [335, 155], [245, 205],
      [205, 305], [100, 365], [-40, 335], [-90, 235], [-200, 225],
      [-295, 145], [-265, 30], [-165, -45], [-65, -22],
    ],
  },
  {
    id: 'desert', name: 'Mesa Verde Dash', theme: 'desert', difficulty: 3,
    desc: 'Long straights, brutal hairpins, and a heat haze.',
    width: 17,
    points: [
      [0, 0], [200, 0], [400, 0], [485, 60], [475, 150], [385, 175],
      [300, 120], [200, 140], [150, 235], [200, 325], [350, 345],
      [425, 425], [350, 505], [150, 485], [-50, 465], [-205, 385],
      [-235, 260], [-150, 180], [-185, 80], [-100, 0],
    ],
  },
  {
    id: 'alpine', name: 'Alpine Ring', theme: 'alpine', difficulty: 3,
    desc: 'Snow-lined mountain road with relentless direction changes.',
    width: 14,
    points: [
      [0, 0], [130, 0], [205, 60], [185, 155], [265, 215], [255, 315],
      [155, 345], [60, 285], [-40, 325], [-145, 295], [-165, 190],
      [-90, 130], [-125, 40], [-205, -30], [-125, -95], [-45, -60],
    ],
  },
  {
    id: 'neon', name: 'Neon City Nights', theme: 'city', difficulty: 4,
    desc: 'A night street circuit between towers. Tight, technical, unforgiving.',
    width: 14,
    points: [
      [0, 0], [180, 0], [300, 40], [325, 140], [245, 195], [125, 170],
      [60, 250], [130, 335], [265, 345], [335, 425], [245, 485],
      [80, 465], [-80, 475], [-180, 395], [-150, 280], [-225, 200],
      [-265, 90], [-185, 10], [-90, -20],
    ],
  },
  // ---- Circuits inspired by real-world tracks (approximate layouts) ----
  {
    id: 'silverstone', name: 'Silverstone', theme: 'grass', difficulty: 3, real: true,
    desc: 'Inspired by the British GP circuit: Copse, Maggotts–Becketts, Hangar Straight, Stowe.',
    width: 15,
    points: [
      [0, 0], [130, -105], [250, -200], [310, -270], [380, -290], [440, -250], [445, -180], [500, -130], [570, -160], [575, -240],
      [480, -340], [340, -430], [200, -500], [90, -540], [50, -620], [120, -690], [220, -680], [340, -720], [450, -730], [540, -730],
      [610, -790], [670, -745], [730, -715], [810, -620], [900, -450], [890, -320], [810, -200], [640, -90], [420, 60], [200, 140],
      [-60, 170], [-130, 90],
    ],
  },
  {
    id: 'monza', name: 'Monza', theme: 'forest', difficulty: 2, real: true,
    desc: 'Inspired by the Temple of Speed: long straights, three chicanes, the Lesmos and Parabolica.',
    width: 15,
    points: [
      [0, 0], [200, 0], [400, 0], [470, 22], [535, -35], [620, 40], [660, 170], [660, 280], [625, 335], [660, 390],
      [620, 440], [530, 490], [350, 560], [150, 620], [70, 650], [30, 610], [-40, 640], [-200, 520], [-320, 380],
      [-370, 230], [-330, 90], [-200, 20],
    ],
  },
  {
    id: 'spa', name: 'Spa-Francorchamps', theme: 'forest', difficulty: 4, real: true,
    desc: 'Inspired by the Ardennes classic: La Source, Eau Rouge, Kemmel, Pouhon, Blanchimont, Bus Stop.',
    width: 15,
    points: [
      [0, 0], [80, 0], [130, 20], [135, 80], [90, 120], [40, 200], [60, 270], [200, 300], [450, 330], [650, 350],
      [705, 405], [770, 365], [810, 440], [760, 520], [700, 530], [660, 600], [600, 720], [480, 790], [380, 760],
      [300, 800], [160, 830], [60, 760], [-120, 600], [-260, 450], [-340, 350], [-290, 285], [-335, 225],
      [-260, 120], [-140, 30],
    ],
  },
  {
    id: 'interlagos', name: 'Interlagos', theme: 'grass', difficulty: 3, real: true,
    desc: 'Inspired by the São Paulo circuit: Senna S, Curva do Sol, Reta Oposta and the twisty infield.',
    width: 15,
    points: [
      [0, 0], [180, 0], [280, -30], [300, -100], [245, -150], [230, -235], [295, -315], [420, -345], [620, -365], [780, -330],
      [805, -235], [740, -175], [660, -200], [600, -120], [650, -40], [600, 40], [520, 90], [470, 30], [400, 60], [300, 120],
      [150, 130], [-50, 120], [-150, 80], [-140, -10],
    ],
  },
];

export const THEMES = {
  grass:   { sky: 0x7ec8ff, fog: 0xbfe3ff, ground: 0x4c8a3a, groundAlt: 0x3f7530, sun: 1.15, ambient: 0.55, night: false, trees: 'round', mountains: 0x6f8ba0, water: null, buildings: false, road: 0x3a3a40 },
  coastal: { sky: 0x8fd3ff, fog: 0xcfeaff, ground: 0x6aa04c, groundAlt: 0x5b8f41, sun: 1.2, ambient: 0.6, night: false, trees: 'palm', mountains: 0x7f95a8, water: 0x2277cc, buildings: false, road: 0x3c3c42 },
  desert:  { sky: 0xffcf9a, fog: 0xffe0bf, ground: 0xd8b276, groundAlt: 0xc9a163, sun: 1.3, ambient: 0.5, night: false, trees: 'cactus', mountains: 0xb5713c, water: null, buildings: false, road: 0x45403c },
  forest:  { sky: 0x86c5f5, fog: 0xc9e4f7, ground: 0x3f7a33, groundAlt: 0x35682b, sun: 1.1, ambient: 0.55, night: false, trees: 'pine', mountains: 0x5e7a6a, water: null, buildings: false, road: 0x3a3a40 },
  alpine:  { sky: 0xd9ecff, fog: 0xeef6ff, ground: 0xeef3f8, groundAlt: 0xdde7f0, sun: 1.0, ambient: 0.7, night: false, trees: 'pine', mountains: 0xb9c7d6, water: null, buildings: false, road: 0x33363c },
  city:    { sky: 0x0a0c1c, fog: 0x0e1020, ground: 0x1c1d25, groundAlt: 0x17181f, sun: 0.35, ambient: 0.25, night: true, trees: 'none', mountains: 0x0b0d16, water: null, buildings: true, road: 0x2a2b33 },
};

export function getTrack(id) { return TRACKS.find(t => t.id === id) || TRACKS[0]; }
