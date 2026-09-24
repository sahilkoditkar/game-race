import * as THREE from 'three';
import { buildCarMesh } from './carmodels.js';

const WHEEL_R = 0.36;
const WHEELBASE = 2.6;
const clamp = THREE.MathUtils.clamp;

export class Car {
  /**
   * @param {object} o
   * @param {string} o.name
   * @param {number} o.color
   * @param {object} o.stats   effective stats {maxSpeed, accel, grip, turn, brake}
   * @param {string} o.shape   model id from carmodels.js (e.g. 'hatch', 'super', 'formula')
   * @param {boolean} o.isPlayer
   * @param {number} o.playerIndex
   * @param {string} [o.quality] 'high' | 'low' mesh detail
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
    this.pitch = 0;         // road pitch under the car (radians, nose-up positive)
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
    this.mesh = buildCarMesh(this.shape, this.color, o.quality);
    this.wheels = this.mesh.userData.wheels;
    this.frontWheels = this.mesh.userData.frontWheels;
    this.body = this.mesh.userData.body;
    this.brakeLights = this.mesh.userData.brakeLights;
    this.mesh.userData.car = this;
  }

  place(x, z, heading, y = 0) {
    this.pos.set(x, y + 0.12, z);
    this.heading = heading;
    this.pitch = 0;
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
    this.offroad = Math.abs(lat) > track.samples[this.trackIdx].hw + 0.6;

    const prevVf = this.vf;

    // ---- Longitudinal ----------------------------------------------------
    const offroadK = s.offroad ?? 0.6;
    const maxS = s.maxSpeed * (this.offroad ? offroadK : 1);
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
    const drag = this.offroad ? 0.9 * (0.6 / offroadK) : 0.035;
    this.vf -= this.vf * drag * dt + Math.sign(this.vf) * Math.min(Math.abs(this.vf), 1.2 * dt);
    if (this.vf > maxS) this.vf -= (this.vf - maxS) * 2.5 * dt;
    if (inp.handbrake) this.vf -= Math.sign(this.vf) * Math.min(Math.abs(this.vf), 11 * dt);

    // ---- Lateral grip ------------------------------------------------------
    // Lateral velocity decays toward zero; the rate is the tyre grip.
    let grip = s.grip * (this.offroad ? 0.45 * (offroadK / 0.6) : 1);
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
    const limit = samp.wall - 1.0;
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

    // Point-to-point stages: solid barriers across both ends of the road
    if (track.open) {
      const N = track.samples.length;
      const f = track._param(this.pos, this.trackIdx);
      if ((this.trackIdx >= N - 1 && f > 0.2) || (this.trackIdx <= 0 && f < -0.2)) {
        const along = this.trackIdx >= N - 1 ? 0.4 : -0.4; // metres from the end sample
        const latC = Math.max(-samp.wall + 1, Math.min(samp.wall - 1, lat2));
        this.pos.x = samp.p.x + samp.t.x * along + samp.n.x * latC;
        this.pos.z = samp.p.z + samp.t.z * along + samp.n.z * latC;
        this.wallHit = Math.max(this.wallHit, Math.abs(this.vf));
        this.vf *= -0.2; this.vr = 0;
        this.vel.set(fx * this.vf, 0, fz * this.vf);
      }
    }

    // Elevation: sit on the road surface, pitch with it, and feel gravity on climbs
    const dot = fx * samp.t.x + fz * samp.t.z;
    const grade = track.slopeAtPos(this.pos, this.trackIdx) * dot; // positive = climbing in the direction we face
    this.pos.y = track.heightAtPos(this.pos, this.trackIdx) + 0.12;
    this.pitch += (-Math.atan(grade) - this.pitch) * Math.min(1, dt * 12);
    this.vf -= 9.81 * grade * 0.6 * dt;

    // Wrong way detection
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
    this.mesh.rotation.set(this.pitch, this.heading, 0, 'YXZ');
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

export { buildCarMesh };

/** Make a translucent copy of a car mesh for ghost replays. */
export function makeGhost(shape, color, quality) {
  const m = buildCarMesh(shape, color, quality);
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
