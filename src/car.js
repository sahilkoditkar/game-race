import * as THREE from 'three';

const WHEEL_R = 0.36;
const WHEELBASE = 2.6;
const clamp = THREE.MathUtils.clamp;

export class Car {
  /**
   * @param {object} o
   * @param {string} o.name
   * @param {number} o.color
   * @param {object} o.stats   effective stats {maxSpeed, accel, grip, turn, brake}
   * @param {string} o.shape   'hatch' | 'gt' | 'proto' | 'formula'
   * @param {boolean} o.isPlayer
   * @param {number} o.playerIndex
   */
  constructor(o) {
    this.name = o.name;
    this.color = o.color;
    this.stats = o.stats;
    this.shape = o.shape || 'hatch';
    this.isPlayer = !!o.isPlayer;
    this.playerIndex = o.playerIndex ?? -1;
    this.aiSkill = o.aiSkill ?? 1;

    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.vel = new THREE.Vector3();
    this.vf = 0; // forward speed
    this.vr = 0; // lateral speed (positive = sliding right)
    this.yawRate = 0;
    this.latAccel = 0;      // smoothed lateral acceleration (for body roll)
    this.longAccel = 0;     // smoothed longitudinal acceleration (for pitch)
    this.steer = 0;          // smoothed steering [-1,1]
    this.input = { throttle: 0, brake: 0, steer: 0, handbrake: false };
    this.offroad = false;
    this.drifting = false;
    this.wallHit = 0;        // impulse magnitude this frame (for fx/audio)
    this.carHit = 0;
    this.autopilot = false;  // finished players cruise under AI control

    // race bookkeeping
    this.trackIdx = 0;
    this.progress = 0;       // continuous, in samples, grows with laps
    this.lap = 0;
    this.nextSector = 1;
    this.lapStart = 0;
    this.lapTimes = [];
    this.bestLap = Infinity;
    this.finished = false;
    this.finishTime = 0;
    this.wrongWay = false;
    this.stuckTimer = 0;
    this.reverseTimer = 0;
    this.rank = 1;

    this.wheelSpin = 0;
    this.mesh = buildCarMesh(this.shape, this.color);
    this.wheels = this.mesh.userData.wheels;
    this.frontWheels = this.mesh.userData.frontWheels;
    this.body = this.mesh.userData.body;
    this.brakeLights = this.mesh.userData.brakeLights;
    this.mesh.userData.car = this;
  }

  place(x, z, heading) {
    this.pos.set(x, 0.12, z);
    this.heading = heading;
    this.vf = this.vr = 0;
    this.yawRate = 0; this.latAccel = 0; this.longAccel = 0;
    this.vel.set(0, 0, 0);
    this.updateMesh();
  }

  get speed() { return Math.abs(this.vf); }
  get forward() { return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)); }

  /** Advance physics by dt seconds. `env` = { track, live } */
  update(dt, env) {
    const { track } = env;
    const s = this.stats;
    const inp = this.input;
    if (!env.live) { inp.throttle = 0; inp.brake = 0; inp.steer = 0; inp.handbrake = false; }

    // Smooth steering: quick to apply, quicker to release, and gentler at speed
    const target = clamp(inp.steer, -1, 1);
    const rate = Math.abs(target) > Math.abs(this.steer) ? 6 : 10;
    this.steer += clamp(target - this.steer, -rate * dt, rate * dt);

    // Track relation
    this.trackIdx = track.nearestIndex(this.pos, this.trackIdx);
    const lat = track.lateral(this.pos, this.trackIdx);
    this.offroad = Math.abs(lat) > track.halfWidth + 0.6;

    const prevVf = this.vf;

    // ---- Longitudinal ----------------------------------------------------
    const maxS = s.maxSpeed * (this.offroad ? 0.6 : 1);
    if (inp.throttle > 0) {
      const room = Math.max(0, 1 - this.vf / maxS);
      // strong low-end, tapering toward top speed
      this.vf += s.accel * inp.throttle * (0.3 + 0.9 * Math.pow(room, 0.8)) * dt;
    }
    if (inp.brake > 0) {
      if (this.vf > 0.3) this.vf = Math.max(0, this.vf - s.brake * inp.brake * dt);
      else this.vf = Math.max(-14, this.vf - s.accel * 0.5 * inp.brake * dt);
    }
    // passive drag & rolling resistance
    const drag = this.offroad ? 0.9 : 0.035;
    this.vf -= this.vf * drag * dt + Math.sign(this.vf) * Math.min(Math.abs(this.vf), 1.2 * dt);
    if (this.vf > maxS) this.vf -= (this.vf - maxS) * 2.5 * dt;
    if (inp.handbrake) this.vf -= Math.sign(this.vf) * Math.min(Math.abs(this.vf), 11 * dt);

    // ---- Lateral grip ------------------------------------------------------
    // Lateral velocity decays toward zero; the rate is the tyre grip.
    let grip = s.grip * (this.offroad ? 0.45 : 1);
    if (inp.handbrake) grip *= 0.2;
    const slipRatio = Math.abs(this.vr) / (Math.abs(this.vf) + 1);
    if (slipRatio > 0.3) grip *= 0.6; // once sliding, keep sliding a bit
    this.vr *= Math.exp(-grip * dt);
    this.drifting = Math.abs(this.vr) > 5 && this.speed > 8;

    // ---- Yaw (bicycle model with a grip-limited lateral acceleration) ------
    const v = Math.abs(this.vf);
    const maxSteer = (0.62 * s.turn) / (1 + v / 22);          // steering lock shrinks with speed
    const delta = this.steer * maxSteer;
    let yaw = (v * Math.tan(delta)) / WHEELBASE;               // kinematic yaw rate
    const maxLat = s.grip * 2.6 * (this.offroad ? 0.5 : 1);    // m/s^2 the tyres can hold
    let latLimit = inp.handbrake || this.drifting ? Infinity : maxLat;
    if (v > 1 && Math.abs(yaw) * v > latLimit) {
      // understeer: scrub a little speed and cap the turn rate
      const excess = Math.abs(yaw) * v - latLimit;
      yaw = Math.sign(yaw) * (latLimit / v);
      this.vf -= Math.sign(this.vf) * Math.min(Math.abs(this.vf), excess * 0.15 * dt);
    }
    if (inp.handbrake) yaw *= 1.35;
    if (this.drifting) yaw *= 1.1;
    if (this.vf < 0) yaw = -yaw;
    this.yawRate = yaw;
    const prevHeading = this.heading;
    this.heading -= yaw * dt;

    // Rotating the frame converts some forward motion into lateral (this is what makes drifts happen)
    const dH = this.heading - prevHeading;
    const cos = Math.cos(dH), sin = Math.sin(dH);
    const nvf = this.vf * cos + this.vr * sin;
    const nvr = -this.vf * sin + this.vr * cos;
    this.vf = nvf; this.vr = nvr;

    // Integrate
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const rx = -fz, rz = fx;
    this.vel.set(fx * this.vf + rx * this.vr, 0, fz * this.vf + rz * this.vr);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    // ---- Barrier collision ---------------------------------------------
    this.wallHit = 0;
    this.trackIdx = track.nearestIndex(this.pos, this.trackIdx);
    const samp = track.samples[this.trackIdx];
    const lat2 = track.lateral(this.pos, this.trackIdx);
    const limit = track.wallOffset - 1.0;
    if (Math.abs(lat2) > limit) {
      const side = Math.sign(lat2);
      const pen = Math.abs(lat2) - limit;
      this.pos.x -= samp.n.x * side * pen;
      this.pos.z -= samp.n.z * side * pen;
      const vn = this.vel.x * samp.n.x + this.vel.z * samp.n.z;
      if (vn * side > 0) {
        this.vel.x -= samp.n.x * vn * 1.4;
        this.vel.z -= samp.n.z * vn * 1.4;
        this.wallHit = Math.abs(vn);
        this.vf = this.vel.x * fx + this.vel.z * fz;
        this.vr = this.vel.x * rx + this.vel.z * rz;
        this.vf *= 0.85;
        // nudge heading toward track direction so cars don't grind along walls
        let d = samp.heading - this.heading;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.heading += d * Math.min(0.5, this.wallHit * 0.03);
      }
    }

    // Wrong way detection
    const dot = fx * samp.t.x + fz * samp.t.z;
    this.wrongWay = this.vf > 3 && dot < -0.3;

    // Stuck detection for AI
    if (!this.isPlayer || this.autopilot) {
      if (this.speed < 1.5 && env.live) this.stuckTimer += dt; else this.stuckTimer = 0;
    }

    // Smoothed accelerations for body animation
    const la = this.yawRate * this.vf;            // centripetal (m/s^2)
    const lo = (this.vf - prevVf) / Math.max(dt, 1e-4);
    this.latAccel += (la - this.latAccel) * Math.min(1, dt * 6);
    this.longAccel += (clamp(lo, -30, 30) - this.longAccel) * Math.min(1, dt * 5);

    this.wheelSpin += (this.vf / WHEEL_R) * dt;
    this.updateMesh(dt);
  }

  updateMesh(dt = 0.016) {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    // Body roll/pitch: only the painted shell moves, wheels stay planted.
    // Positive latAccel = turning left (heading increases) -> body leans right.
    const roll = clamp(this.latAccel * 0.0028, -0.06, 0.06);
    const pitch = clamp(-this.longAccel * 0.0025, -0.035, 0.035);
    this.body.rotation.z = roll;
    this.body.rotation.x = pitch;
    for (const w of this.wheels) w.rotation.x = this.wheelSpin;
    for (const w of this.frontWheels) w.rotation.y = -this.steer * 0.42;
    const braking = this.input.brake > 0 || this.input.handbrake;
    for (const l of this.brakeLights) l.material.emissiveIntensity = braking ? 3.5 : 0.8;
  }
}

/* ----------------------------------------------------------------- Meshes */

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.35, ...extra });
}

/**
 * Extrude a side profile (points as [z, y] in car space, z forward) across the car's
 * width with bevelled edges. Returns a geometry centred on x = 0.
 */
function profileGeometry(profile, width, bevel = 0.1) {
  const shape = new THREE.Shape();
  profile.forEach(([z, y], i) => (i === 0 ? shape.moveTo(z, y) : shape.lineTo(z, y)));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.05, width - bevel * 2), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6,
  });
  // Shape lies in XY extruded along +Z. Rotate so shape-x -> car z and extrusion -> car x.
  g.rotateY(-Math.PI / 2);
  g.translate(width / 2 - bevel, 0, 0);
  g.computeVertexNormals();
  return g;
}

export function buildCarMesh(shape, color) {
  const g = new THREE.Group();
  const body = new THREE.Group(); // roll/pitch pivot for the painted shell only
  body.position.y = WHEEL_R;      // pivot at axle height so the shell leans, not lifts
  g.add(body);
  const B = (y) => y - WHEEL_R;   // convert absolute height to body-local height

  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.22, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.0 });
  const dark = mat(0x15161a, { roughness: 0.65, metalness: 0.2 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x2a4d66, roughness: 0.08, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.4 });
  const chrome = mat(0xd4d7dd, { roughness: 0.15, metalness: 1.0 });
  const carbon = mat(0x24262c, { roughness: 0.45, metalness: 0.6 });
  const wheels = [], frontWheels = [], brakeLights = [];

  const addMesh = (geo, m, x, y, z, parent = body) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const addBox = (w, h, d, x, y, z, m, parent = body) => addMesh(new THREE.BoxGeometry(w, h, d), m, x, B(y), z, parent);
  const addProfile = (profile, width, x, m, bevel) => addMesh(profileGeometry(profile, width, bevel), m, x, B(0), 0);

  const addWheel = (x, z, r = WHEEL_R, w = 0.32, front = false) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, r, z);
    const spin = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 24), mat(0x101114, { roughness: 0.9, metalness: 0.0 }));
    tyre.rotation.z = Math.PI / 2; tyre.castShadow = true;
    spin.add(tyre);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, w + 0.02, 16), chrome);
    rim.rotation.z = Math.PI / 2;
    spin.add(rim);
    for (let i = 0; i < 5; i++) {
      const holder = new THREE.Group();
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, r * 0.5, 0.06), dark);
      spoke.position.y = r * 0.32;
      holder.add(spoke);
      holder.rotation.x = (i / 5) * Math.PI * 2;
      spin.add(holder);
    }
    pivot.add(spin);
    g.add(pivot); // wheels are attached to the chassis, not the leaning shell
    wheels.push(spin);
    if (front) frontWheels.push(pivot);
    return pivot;
  };

  const addLights = (z, y, w, emissiveColor, isBrake, size = [0.34, 0.14, 0.08]) => {
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color: emissiveColor, emissive: emissiveColor, emissiveIntensity: isBrake ? 0.8 : 1.6 }));
      m.position.set(sx * w, B(y), z);
      body.add(m);
      if (isBrake) brakeLights.push(m);
    }
  };
  const addMirrors = (z, y, w) => {
    for (const sx of [-1, 1]) { addBox(0.22, 0.1, 0.14, sx * w, y, z, paint); addBox(0.05, 0.06, 0.16, sx * (w - 0.12), y - 0.02, z, dark); }
  };
  const addExhaust = (z, y, xs) => { for (const x of xs) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 10), chrome); p.rotation.x = Math.PI / 2; p.position.set(x, B(y), z); body.add(p); } };

  if (shape === 'formula') {
    // Slim monocoque with raised nose, sidepods, wings and halo.
    addProfile([[-2.1, 0.32], [-1.9, 0.28], [-0.6, 0.28], [0.3, 0.3], [1.3, 0.34], [2.3, 0.45], [2.4, 0.62], [1.4, 0.72], [0.4, 0.78], [-0.2, 0.95], [-0.9, 0.95], [-1.9, 0.62], [-2.1, 0.5]], 0.85, 0, paint, 0.06);
    addProfile([[-1.0, 0.75], [0.2, 0.75], [0.35, 0.95], [-0.4, 1.02], [-1.0, 0.9]], 0.6, 0, glass, 0.04); // cockpit
    addProfile([[-1.6, 0.3], [0.6, 0.3], [0.9, 0.45], [0.4, 0.75], [-1.5, 0.75], [-1.7, 0.55]], 0.85, -0.82, paint, 0.06); // sidepods
    addProfile([[-1.6, 0.3], [0.6, 0.3], [0.9, 0.45], [0.4, 0.75], [-1.5, 0.75], [-1.7, 0.55]], 0.85, 0.82, paint, 0.06);
    addBox(3.0, 0.05, 0.55, 0, 0.28, 2.5, carbon);                                  // front wing
    addBox(0.06, 0.2, 0.55, -1.5, 0.38, 2.5, paint); addBox(0.06, 0.2, 0.55, 1.5, 0.38, 2.5, paint);
    addBox(2.3, 0.05, 0.5, 0, 1.05, -2.05, carbon);                                  // rear wing
    addBox(0.05, 0.55, 0.5, -1.15, 0.8, -2.05, paint); addBox(0.05, 0.55, 0.5, 1.15, 0.8, -2.05, paint);
    addBox(0.25, 0.4, 0.9, 0, 1.05, -0.7, paint);                                    // airbox / engine cover
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 18, Math.PI), carbon);
    halo.position.set(0, B(0.95), 0.6); halo.rotation.x = Math.PI / 2; body.add(halo);
    addBox(0.06, 0.4, 0.06, 0, 0.9, 0.95, carbon);
    addWheel(-0.95, 1.55, 0.36, 0.34, true); addWheel(0.95, 1.55, 0.36, 0.34, true);
    addWheel(-0.98, -1.35, 0.40, 0.44); addWheel(0.98, -1.35, 0.40, 0.44);
    addLights(-2.3, 0.88, 0.0, 0xff2020, true, [0.25, 0.25, 0.06]);
  } else if (shape === 'proto') {
    // Low, wide endurance prototype with canopy, fin and big wing.
    addProfile([[-2.3, 0.25], [-2.35, 0.55], [-1.6, 0.7], [-0.6, 0.72], [0.3, 0.75], [1.3, 0.72], [2.25, 0.6], [2.35, 0.4], [2.2, 0.25]], 2.0, 0, paint, 0.1);
    addProfile([[-1.4, 0.7], [-0.9, 0.7], [-0.7, 1.2], [0.2, 1.22], [0.9, 0.95], [1.2, 0.72]], 1.0, 0, glass, 0.06); // canopy
    addProfile([[-2.2, 0.7], [-1.3, 0.7], [-1.1, 1.05], [-1.3, 1.25], [-2.1, 1.25], [-2.25, 0.9]], 0.08, 0, paint, 0.02); // fin
    addBox(2.2, 0.05, 0.55, 0, 1.35, -2.25, carbon);                                  // rear wing
    addBox(0.05, 0.6, 0.5, -0.95, 1.05, -2.25, paint); addBox(0.05, 0.6, 0.5, 0.95, 1.05, -2.25, paint);
    addBox(2.2, 0.06, 0.5, 0, 0.22, 2.4, carbon);                                     // splitter
    addBox(0.5, 0.35, 1.3, -0.75, 0.9, 1.4, paint); addBox(0.5, 0.35, 1.3, 0.75, 0.9, 1.4, paint); // front fenders
    addBox(0.55, 0.4, 1.5, -0.75, 0.9, -1.3, paint); addBox(0.55, 0.4, 1.5, 0.75, 0.9, -1.3, paint); // rear fenders
    addMirrors(0.6, 0.95, 1.05);
    addExhaust(-2.4, 0.42, [-0.5, 0.5]);
    addWheel(-0.95, 1.5, 0.36, 0.34, true); addWheel(0.95, 1.5, 0.36, 0.34, true);
    addWheel(-0.95, -1.5, 0.38, 0.4); addWheel(0.95, -1.5, 0.38, 0.4);
    addLights(2.33, 0.62, 0.72, 0xffffff, false, [0.3, 0.12, 0.08]);
    addLights(-2.36, 0.58, 0.78, 0xff2020, true);
  } else if (shape === 'gt') {
    // Long-bonnet grand tourer.
    addProfile([[-2.2, 0.28], [-2.25, 0.62], [-2.1, 0.86], [-1.5, 0.9], [-0.3, 0.92], [1.0, 0.9], [2.1, 0.74], [2.25, 0.5], [2.15, 0.28]], 1.9, 0, paint, 0.1);
    addProfile([[-1.55, 0.88], [-1.1, 1.3], [0.1, 1.32], [0.9, 0.9]], 1.55, 0, glass, 0.05); // greenhouse
    addBox(1.2, 0.05, 1.05, 0, 1.33, -0.55, paint);                                    // roof panel
    addBox(1.9, 0.05, 0.4, 0, 1.08, -2.05, carbon);                                     // spoiler
    addBox(0.05, 0.22, 0.32, -0.75, 0.96, -2.05, paint); addBox(0.05, 0.22, 0.32, 0.75, 0.96, -2.05, paint);
    addBox(1.95, 0.14, 0.4, 0, 0.32, 2.2, dark);                                        // front bumper / splitter
    addBox(1.9, 0.12, 0.35, 0, 0.32, -2.2, dark);
    addBox(0.9, 0.08, 0.02, 0, 0.62, 2.26, dark);                                       // grille
    addMirrors(0.7, 1.02, 1.0);
    addExhaust(-2.3, 0.4, [-0.55, 0.55]);
    addWheel(-0.9, 1.4, WHEEL_R, 0.32, true); addWheel(0.9, 1.4, WHEEL_R, 0.32, true);
    addWheel(-0.9, -1.45, WHEEL_R, 0.36); addWheel(0.9, -1.45, WHEEL_R, 0.36);
    addLights(2.24, 0.68, 0.65, 0xffffff, false, [0.36, 0.1, 0.08]);
    addLights(-2.28, 0.72, 0.65, 0xff2020, true);
  } else {
    // Hatchback: tall cabin, short overhangs.
    addProfile([[-1.9, 0.28], [-1.95, 0.65], [-1.85, 0.9], [-1.0, 0.95], [0.4, 0.95], [1.5, 0.85], [1.95, 0.62], [1.95, 0.4], [1.85, 0.28]], 1.8, 0, paint, 0.1);
    addProfile([[-1.75, 0.9], [-1.45, 1.42], [0.1, 1.45], [0.9, 1.0]], 1.5, 0, glass, 0.05);   // greenhouse
    addBox(1.25, 0.05, 1.4, 0, 1.46, -0.65, paint);                                     // roof panel
    addBox(1.85, 0.14, 0.4, 0, 0.32, 1.95, dark);
    addBox(1.85, 0.14, 0.4, 0, 0.32, -1.95, dark);
    addBox(0.8, 0.08, 0.02, 0, 0.6, 1.96, dark);
    addMirrors(0.75, 1.05, 0.95);
    addExhaust(-2.0, 0.38, [0.5]);
    addWheel(-0.85, 1.25, WHEEL_R, 0.3, true); addWheel(0.85, 1.25, WHEEL_R, 0.3, true);
    addWheel(-0.85, -1.25, WHEEL_R, 0.3); addWheel(0.85, -1.25, WHEEL_R, 0.3);
    addLights(1.96, 0.72, 0.62, 0xffffff, false, [0.3, 0.12, 0.08]);
    addLights(-1.97, 0.78, 0.62, 0xff2020, true);
  }

  g.userData = { wheels, frontWheels, body, brakeLights };
  return g;
}

/** Make a translucent copy of a car mesh for ghost replays. */
export function makeGhost(shape, color) {
  const m = buildCarMesh(shape, color);
  m.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      o.material = ms.map((mm) => { const c = mm.clone(); c.transparent = true; c.opacity = 0.35; c.depthWrite = false; return c; });
      if (o.material.length === 1) o.material = o.material[0];
      o.castShadow = false; o.receiveShadow = false;
    }
  });
  return m;
}
