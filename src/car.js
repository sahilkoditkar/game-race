import * as THREE from 'three';

const WHEEL_R = 0.36;

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
    this.steer = 0;          // smoothed steering [-1,1]
    this.input = { throttle: 0, brake: 0, steer: 0, handbrake: false };
    this.offroad = false;
    this.drifting = false;
    this.wallHit = 0;        // impulse magnitude this frame (for fx/audio)
    this.carHit = 0;

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

    // Smooth steering (fast return to centre)
    const target = THREE.MathUtils.clamp(inp.steer, -1, 1);
    const rate = Math.abs(target) > Math.abs(this.steer) ? 5.5 : 9;
    this.steer += THREE.MathUtils.clamp(target - this.steer, -rate * dt, rate * dt);

    // Track relation
    this.trackIdx = track.nearestIndex(this.pos, this.trackIdx);
    const lat = track.lateral(this.pos, this.trackIdx);
    this.offroad = Math.abs(lat) > track.halfWidth + 0.6;

    // Longitudinal
    const maxS = s.maxSpeed * (this.offroad ? 0.6 : 1);
    if (inp.throttle > 0) {
      const room = Math.max(0, 1 - this.vf / maxS);
      this.vf += s.accel * inp.throttle * (0.25 + 0.95 * room) * dt;
    }
    if (inp.brake > 0) {
      if (this.vf > 0.3) this.vf = Math.max(0, this.vf - s.brake * inp.brake * dt);
      else this.vf = Math.max(-14, this.vf - s.accel * 0.5 * inp.brake * dt);
    }
    // passive drag & rolling resistance
    const drag = this.offroad ? 0.9 : 0.045;
    this.vf -= this.vf * drag * dt + Math.sign(this.vf) * Math.min(Math.abs(this.vf), 1.4 * dt);
    if (this.vf > maxS) this.vf -= (this.vf - maxS) * 2.5 * dt;
    if (inp.handbrake) this.vf -= Math.sign(this.vf) * Math.min(Math.abs(this.vf), 10 * dt);

    // Lateral grip (decay of sideways velocity)
    let grip = s.grip * (this.offroad ? 0.45 : 1);
    if (inp.handbrake) grip *= 0.22;
    const slipRatio = Math.abs(this.vr) / (Math.abs(this.vf) + 1);
    if (slipRatio > 0.28) grip *= 0.6; // once sliding, keep sliding a bit
    this.vr *= Math.exp(-grip * dt);
    this.drifting = Math.abs(this.vr) > 5 && this.speed > 8;

    // Yaw
    const sf = Math.min(1, Math.abs(this.vf) / 5);
    const hs = 1 / (1 + Math.abs(this.vf) / 52);
    let yaw = this.steer * 2.35 * s.turn * sf * hs;
    if (inp.handbrake) yaw *= 1.45;
    if (this.drifting) yaw *= 1.15;
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

    // Barrier collision
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
        // rebuild forward/lateral from world velocity
        this.vf = this.vel.x * fx + this.vel.z * fz;
        this.vr = this.vel.x * rx + this.vel.z * rz;
        this.vf *= 0.82;
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
    if (!this.isPlayer) {
      if (this.speed < 1.5 && env.live) this.stuckTimer += dt; else this.stuckTimer = 0;
    }

    // Visual bits
    this.wheelSpin += (this.vf / WHEEL_R) * dt;
    this.updateMesh(dt);
  }

  updateMesh(dt = 0.016) {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    const roll = THREE.MathUtils.clamp(-this.yawRate * Math.abs(this.vf) * 0.0045 + this.vr * 0.01, -0.14, 0.14);
    const pitch = THREE.MathUtils.clamp((this.input.brake > 0 && this.vf > 2 ? -0.03 : 0) + (this.input.throttle > 0 ? 0.02 : 0), -0.05, 0.05);
    this.body.rotation.z += (roll - this.body.rotation.z) * Math.min(1, dt * 10);
    this.body.rotation.x += (pitch - this.body.rotation.x) * Math.min(1, dt * 8);
    for (const w of this.wheels) w.rotation.x = this.wheelSpin;
    for (const w of this.frontWheels) w.rotation.y = -this.steer * 0.45;
    const braking = this.input.brake > 0 || this.input.handbrake;
    for (const l of this.brakeLights) l.material.emissiveIntensity = braking ? 3 : 0.7;
  }
}

/* ----------------------------------------------------------------- Meshes */

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.35, ...extra });
}

export function buildCarMesh(shape, color) {
  const g = new THREE.Group();
  const body = new THREE.Group(); // roll/pitch pivot
  g.add(body);
  const paint = mat(color, { roughness: 0.28, metalness: 0.45 });
  const dark = mat(0x15161a, { roughness: 0.6, metalness: 0.2 });
  const glass = mat(0x0f2a3f, { roughness: 0.1, metalness: 0.8 });
  const chrome = mat(0xc9ccd3, { roughness: 0.2, metalness: 0.9 });
  const wheels = [], frontWheels = [], brakeLights = [];

  const addBox = (w, h, d, x, y, z, m, parent = body) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const addWheel = (x, z, r = WHEEL_R, w = 0.32, front = false) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, r, z);
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 18), [dark, chrome, chrome]);
    tyre.rotation.z = Math.PI / 2;
    tyre.castShadow = true;
    const spin = new THREE.Group();
    spin.add(tyre);
    pivot.add(spin);
    body.add(pivot);
    wheels.push(spin);
    if (front) frontWheels.push(pivot);
    return pivot;
  };

  const addLights = (z, y, w, emissiveColor, isBrake) => {
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), new THREE.MeshStandardMaterial({ color: emissiveColor, emissive: emissiveColor, emissiveIntensity: isBrake ? 0.7 : 1.4 }));
      m.position.set(sx * w, y, z);
      body.add(m);
      if (isBrake) brakeLights.push(m);
    }
  };

  if (shape === 'formula') {
    addBox(0.9, 0.42, 3.2, 0, 0.48, 0.2, paint);                 // monocoque
    addBox(0.7, 0.34, 1.2, 0, 0.42, 2.1, paint);                 // nose
    addBox(0.6, 0.35, 0.9, 0, 0.82, 0.1, paint);                 // engine cover
    addBox(0.5, 0.3, 0.7, 0, 0.78, 0.55, glass);                 // cockpit
    addBox(3.0, 0.06, 0.5, 0, 0.24, 2.55, dark);                 // front wing
    addBox(2.4, 0.06, 0.5, 0, 1.0, -2.0, dark);                  // rear wing
    addBox(0.06, 0.5, 0.5, -1.2, 0.75, -2.0, paint); addBox(0.06, 0.5, 0.5, 1.2, 0.75, -2.0, paint);
    addBox(0.8, 0.3, 1.6, -0.85, 0.5, -0.4, paint); addBox(0.8, 0.3, 1.6, 0.85, 0.5, -0.4, paint); // sidepods
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 16, Math.PI), dark);
    halo.position.set(0, 0.95, 0.6); halo.rotation.x = Math.PI / 2; body.add(halo);
    addWheel(-0.95, 1.55, 0.36, 0.34, true); addWheel(0.95, 1.55, 0.36, 0.34, true);
    addWheel(-0.98, -1.35, 0.40, 0.42); addWheel(0.98, -1.35, 0.40, 0.42);
    addLights(-2.27, 0.9, 0.0, 0xff2020, true);
  } else if (shape === 'proto') {
    addBox(2.0, 0.42, 4.6, 0, 0.5, 0, paint);                    // low body
    addBox(1.6, 0.3, 1.6, 0, 0.86, 1.2, paint);                  // front bulge
    addBox(0.9, 0.5, 1.5, 0, 0.95, -0.2, glass);                 // canopy
    addBox(0.3, 0.55, 1.9, 0, 0.95, -1.2, paint);                // shark fin
    addBox(2.2, 0.06, 0.55, 0, 1.35, -2.3, dark);                // rear wing
    addBox(0.06, 0.5, 0.5, -0.9, 1.1, -2.3, paint); addBox(0.06, 0.5, 0.5, 0.9, 1.1, -2.3, paint);
    addBox(2.2, 0.08, 0.5, 0, 0.2, 2.35, dark);                  // splitter
    addWheel(-0.95, 1.5, 0.36, 0.34, true); addWheel(0.95, 1.5, 0.36, 0.34, true);
    addWheel(-0.95, -1.5, 0.38, 0.38); addWheel(0.95, -1.5, 0.38, 0.38);
    addLights(2.31, 0.62, 0.7, 0xffffff, false);
    addLights(-2.31, 0.6, 0.75, 0xff2020, true);
  } else if (shape === 'gt') {
    addBox(1.9, 0.5, 4.4, 0, 0.55, 0, paint);
    addBox(1.5, 0.42, 1.9, 0, 1.0, -0.25, glass);
    addBox(1.55, 0.08, 1.95, 0, 1.24, -0.25, paint);             // roof
    addBox(1.9, 0.06, 0.4, 0, 1.05, -2.1, dark);                 // spoiler
    addBox(0.06, 0.25, 0.3, -0.8, 0.9, -2.1, paint); addBox(0.06, 0.25, 0.3, 0.8, 0.9, -2.1, paint);
    addBox(2.0, 0.14, 0.5, 0, 0.32, 2.2, dark);                  // bumper
    addWheel(-0.9, 1.4, WHEEL_R, 0.32, true); addWheel(0.9, 1.4, WHEEL_R, 0.32, true);
    addWheel(-0.9, -1.45, WHEEL_R, 0.36); addWheel(0.9, -1.45, WHEEL_R, 0.36);
    addLights(2.21, 0.66, 0.65, 0xffffff, false);
    addLights(-2.21, 0.66, 0.65, 0xff2020, true);
  } else {
    // hatch
    addBox(1.8, 0.55, 3.8, 0, 0.58, 0, paint);
    addBox(1.6, 0.5, 2.1, 0, 1.1, -0.4, glass);
    addBox(1.64, 0.08, 2.15, 0, 1.38, -0.4, paint);
    addBox(1.8, 0.14, 0.4, 0, 0.36, 1.95, dark);
    addBox(1.8, 0.14, 0.4, 0, 0.36, -1.95, dark);
    addWheel(-0.85, 1.25, WHEEL_R, 0.3, true); addWheel(0.85, 1.25, WHEEL_R, 0.3, true);
    addWheel(-0.85, -1.25, WHEEL_R, 0.3); addWheel(0.85, -1.25, WHEEL_R, 0.3);
    addLights(1.91, 0.7, 0.6, 0xffffff, false);
    addLights(-1.91, 0.7, 0.6, 0xff2020, true);
  }

  g.userData = { wheels, frontWheels, body, brakeLights };
  return g;
}
