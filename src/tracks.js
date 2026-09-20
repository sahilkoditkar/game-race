// Track definitions. `points` are 2D control points (x, z) of a closed
// Catmull-Rom spline. The car starts at points[0] heading toward points[1].
//
// `elevation` is an optional list of [t, height] keypoints where t is the
// fraction of the lap (0..1) measured from the start line; heights are in
// metres and are interpolated smoothly around the lap. Tracks without an
// explicit profile get a gentle seeded one scaled by `elevationAmp`.
//
// `kind` is 'real' for layouts inspired by real-world circuits, or 'original'.

export const TRACKS = [
  // ------------------------------------------------------------ Original
  {
    id: 'sunrise', name: 'Sunrise Speedway', theme: 'grass', difficulty: 1, kind: 'original',
    desc: 'A fast, flowing club circuit. Great for learning the ropes.',
    width: 16, elevationAmp: 5,
    points: [
      [0, 0], [130, 0], [230, 30], [290, 110], [280, 200], [200, 250],
      [90, 240], [-10, 275], [-140, 265], [-235, 195], [-255, 90],
      [-205, 10], [-100, -12],
    ],
  },
  {
    id: 'coastal', name: 'Azure Coast', theme: 'coastal', difficulty: 2, kind: 'original',
    desc: 'Cliff-side esses along the ocean. Watch the late apexes.',
    width: 15, elevationAmp: 12,
    points: [
      [0, 0], [150, 0], [265, -40], [345, 45], [335, 155], [245, 205],
      [205, 305], [100, 365], [-40, 335], [-90, 235], [-200, 225],
      [-295, 145], [-265, 30], [-165, -45], [-65, -22],
    ],
  },
  {
    id: 'harbor', name: 'Harbor Sprint', theme: 'coastal', difficulty: 2, kind: 'original',
    desc: 'A short, punchy dockside loop. Lap after lap of close racing.',
    width: 14, elevationAmp: 4,
    points: [
      [0, 0], [140, 0], [200, 60], [150, 140], [220, 220], [120, 290], [-20, 250],
      [-90, 160], [-200, 120], [-240, 30], [-150, -20], [-60, 10],
    ],
  },
  {
    id: 'desert', name: 'Mesa Verde Dash', theme: 'desert', difficulty: 3, kind: 'original',
    desc: 'Long straights, brutal hairpins, and a heat haze.',
    width: 17, elevationAmp: 8,
    points: [
      [0, 0], [200, 0], [400, 0], [485, 60], [475, 150], [385, 175],
      [300, 120], [200, 140], [150, 235], [200, 325], [350, 345],
      [425, 425], [350, 505], [150, 485], [-50, 465], [-205, 385],
      [-235, 260], [-150, 180], [-185, 80], [-100, 0],
    ],
  },
  {
    id: 'canyon', name: 'Canyon Run', theme: 'desert', difficulty: 2, kind: 'original',
    desc: 'Wide, sweeping bends carved through a red-rock canyon. Flat out.',
    width: 17, elevationAmp: 14,
    points: [
      [0, 0], [300, 0], [500, 80], [560, 220], [450, 320], [300, 300], [200, 400],
      [50, 480], [-150, 450], [-300, 360], [-350, 200], [-280, 80], [-150, 40],
    ],
  },
  {
    id: 'alpine', name: 'Alpine Ring', theme: 'alpine', difficulty: 3, kind: 'original',
    desc: 'Snow-lined mountain road with relentless direction changes.',
    width: 14, elevationAmp: 22,
    points: [
      [0, 0], [130, 0], [205, 60], [185, 155], [265, 215], [255, 315],
      [155, 345], [60, 285], [-40, 325], [-145, 295], [-165, 190],
      [-90, 130], [-125, 40], [-205, -30], [-125, -95], [-45, -60],
    ],
  },
  {
    id: 'pinecrest', name: 'Pinecrest Forest', theme: 'forest', difficulty: 2, kind: 'original',
    desc: 'A rolling woodland road with blind crests and a tight final complex.',
    width: 14, elevationAmp: 16,
    points: [
      [0, 0], [150, 0], [250, 70], [240, 180], [150, 240], [30, 200], [-50, 280],
      [-180, 300], [-260, 200], [-230, 90], [-130, 30],
    ],
  },
  {
    id: 'neon', name: 'Neon City Nights', theme: 'city', difficulty: 4, kind: 'original',
    desc: 'A night street circuit between towers. Tight, technical, unforgiving.',
    width: 14, elevationAmp: 3,
    points: [
      [0, 0], [180, 0], [300, 40], [325, 140], [245, 195], [125, 170],
      [60, 250], [130, 335], [265, 345], [335, 425], [245, 485],
      [80, 465], [-80, 475], [-180, 395], [-150, 280], [-225, 200],
      [-265, 90], [-185, 10], [-90, -20],
    ],
  },

  // ------------------------------------------------------------ Real-world inspired
  {
    id: 'silverstone', name: 'Silverstone', theme: 'grass', difficulty: 3, kind: 'real',
    desc: 'Inspired by the British GP circuit: Copse, Maggotts–Becketts, Hangar Straight, Stowe.',
    width: 15,
    elevation: [[0, 0], [0.15, 3], [0.3, -2], [0.45, 4], [0.6, 1], [0.75, -3], [0.9, 2]],
    points: [
      [0, 0], [130, -105], [250, -200], [310, -270], [380, -290], [440, -250], [445, -180], [500, -130], [570, -160], [575, -240],
      [480, -340], [340, -430], [200, -500], [90, -540], [50, -620], [120, -690], [220, -680], [340, -720], [450, -730], [540, -730],
      [610, -790], [670, -745], [730, -715], [810, -620], [900, -450], [890, -320], [810, -200], [640, -90], [420, 60], [200, 140],
      [-60, 170], [-130, 90],
    ],
  },
  {
    id: 'monza', name: 'Monza', theme: 'forest', difficulty: 2, kind: 'real',
    desc: 'Inspired by the Temple of Speed: long straights, three chicanes, the Lesmos and Parabolica.',
    width: 15,
    elevation: [[0, 0], [0.25, 1.5], [0.5, -1], [0.75, 1]],
    points: [
      [0, 0], [200, 0], [400, 0], [470, 22], [535, -35], [620, 40], [660, 170], [660, 280], [625, 335], [660, 390],
      [620, 440], [530, 490], [350, 560], [150, 620], [70, 650], [30, 610], [-40, 640], [-200, 520], [-320, 380],
      [-370, 230], [-330, 90], [-200, 20],
    ],
  },
  {
    id: 'spa', name: 'Spa-Francorchamps', theme: 'forest', difficulty: 4, kind: 'real',
    desc: 'Inspired by the Ardennes classic: La Source, the Eau Rouge climb, Kemmel, Pouhon, Blanchimont, Bus Stop.',
    width: 15,
    elevation: [[0, 0], [0.04, -2], [0.09, -22], [0.13, -4], [0.2, 12], [0.28, 16], [0.36, 8], [0.45, -4], [0.55, -18], [0.63, -30], [0.72, -22], [0.82, -10], [0.92, -2]],
    points: [
      [0, 0], [80, 0], [130, 20], [135, 80], [90, 120], [40, 200], [60, 270], [200, 300], [450, 330], [650, 350],
      [705, 405], [770, 365], [810, 440], [760, 520], [700, 530], [660, 600], [600, 720], [480, 790], [380, 760],
      [300, 800], [160, 830], [60, 760], [-120, 600], [-260, 450], [-340, 350], [-290, 285], [-335, 225],
      [-260, 120], [-140, 30],
    ],
  },
  {
    id: 'interlagos', name: 'Interlagos', theme: 'grass', difficulty: 3, kind: 'real',
    desc: 'Inspired by the São Paulo circuit: the Senna S plunge, Curva do Sol, Reta Oposta and the climb to the pits.',
    width: 15,
    elevation: [[0, 0], [0.08, -6], [0.16, -16], [0.3, -20], [0.42, -14], [0.52, -6], [0.62, -10], [0.72, -16], [0.8, -22], [0.9, -12]],
    points: [
      [0, 0], [180, 0], [280, -30], [300, -100], [245, -150], [230, -235], [295, -315], [420, -345], [620, -365], [780, -330],
      [805, -235], [740, -175], [660, -200], [600, -120], [650, -40], [600, 40], [520, 90], [470, 30], [400, 60], [300, 120],
      [150, 130], [-50, 120], [-150, 80], [-140, -10],
    ],
  },
  {
    id: 'redbull', name: 'Red Bull Ring', theme: 'alpine', difficulty: 2, kind: 'real',
    desc: 'Inspired by the Styrian hillside circuit: a steep climb to the hairpin, then a fast plunge home.',
    width: 14,
    elevation: [[0, 0], [0.12, 8], [0.28, 30], [0.38, 34], [0.5, 22], [0.62, 12], [0.75, 8], [0.88, 2]],
    points: [
      [0, 0], [220, 0], [320, 50], [380, 200], [430, 380], [410, 450], [340, 450], [250, 360], [160, 240], [80, 280],
      [-60, 330], [-200, 280], [-280, 180], [-300, 60], [-220, -20], [-100, -10],
    ],
  },
  {
    id: 'bahrain', name: 'Bahrain', theme: 'desert', difficulty: 3, kind: 'real',
    desc: 'Inspired by the Sakhir desert circuit: heavy braking into T1 and a twisting middle sector.',
    width: 15,
    elevation: [[0, 0], [0.2, 3], [0.35, -2], [0.5, 4], [0.65, 6], [0.8, 2]],
    points: [
      [0, 0], [250, 0], [430, 0], [480, 40], [450, 100], [500, 150], [560, 230], [520, 320], [430, 380], [320, 420],
      [220, 500], [100, 560], [40, 500], [80, 400], [20, 320], [-100, 300], [-220, 360], [-320, 300], [-300, 180],
      [-360, 80], [-260, 10], [-120, 0],
    ],
  },
  {
    id: 'cota', name: 'Circuit of the Americas', theme: 'grass', difficulty: 4, kind: 'real',
    desc: 'Inspired by Austin: the steep climb to Turn 1, the esses, the long back straight and the stadium section.',
    width: 15,
    elevation: [[0, 0], [0.06, 14], [0.1, 12], [0.2, 4], [0.32, 0], [0.45, -2], [0.55, 2], [0.68, 6], [0.8, 2], [0.9, -2]],
    points: [
      [0, 0], [200, 0], [300, -60], [260, -140], [170, -180], [190, -260], [100, -320], [130, -400], [40, -470], [90, -560],
      [220, -620], [420, -650], [600, -640], [640, -560], [560, -500], [560, -380], [640, -330], [600, -240], [520, -220],
      [560, -120], [480, -40], [340, 60], [180, 100], [20, 125], [-140, 85], [-155, -20],
    ],
  },
  {
    id: 'zandvoort', name: 'Zandvoort', theme: 'coastal', difficulty: 3, kind: 'real',
    desc: 'Inspired by the Dutch dunes circuit: Tarzan, the flowing dune section and the banked final corner.',
    width: 14,
    elevation: [[0, 0], [0.12, -4], [0.25, 6], [0.4, 2], [0.55, 9], [0.7, 4], [0.85, -3]],
    points: [
      [0, 0], [200, 0], [300, 40], [280, 120], [200, 160], [140, 240], [180, 330], [120, 400], [20, 380], [-40, 300],
      [-140, 330], [-200, 430], [-300, 450], [-360, 360], [-300, 250], [-360, 150], [-300, 50], [-160, 0],
    ],
  },
];

export const THEMES = {
  grass:   { sky: 0x7ec8ff, fog: 0xbfe3ff, ground: 0x4c8a3a, groundAlt: 0x3f7530, sun: 1.15, ambient: 0.55, night: false, trees: 'round', mountains: 0x6f8ba0, water: null, buildings: false, road: 0x3a3a40, hills: 10 },
  coastal: { sky: 0x8fd3ff, fog: 0xcfeaff, ground: 0x6aa04c, groundAlt: 0x5b8f41, sun: 1.2, ambient: 0.6, night: false, trees: 'palm', mountains: 0x7f95a8, water: 0x2277cc, buildings: false, road: 0x3c3c42, hills: 12 },
  desert:  { sky: 0xffcf9a, fog: 0xffe0bf, ground: 0xd8b276, groundAlt: 0xc9a163, sun: 1.3, ambient: 0.5, night: false, trees: 'cactus', mountains: 0xb5713c, water: null, buildings: false, road: 0x45403c, hills: 14 },
  forest:  { sky: 0x86c5f5, fog: 0xc9e4f7, ground: 0x3f7a33, groundAlt: 0x35682b, sun: 1.1, ambient: 0.55, night: false, trees: 'pine', mountains: 0x5e7a6a, water: null, buildings: false, road: 0x3a3a40, hills: 16 },
  alpine:  { sky: 0xd9ecff, fog: 0xeef6ff, ground: 0xeef3f8, groundAlt: 0xdde7f0, sun: 1.0, ambient: 0.7, night: false, trees: 'pine', mountains: 0xb9c7d6, water: null, buildings: false, road: 0x33363c, hills: 24 },
  city:    { sky: 0x0a0c1c, fog: 0x0e1020, ground: 0x1c1d25, groundAlt: 0x17181f, sun: 0.35, ambient: 0.25, night: true, trees: 'none', mountains: 0x0b0d16, water: null, buildings: true, road: 0x2a2b33, hills: 2 },
};

export function getTrack(id) { return TRACKS.find(t => t.id === id) || TRACKS[0]; }
