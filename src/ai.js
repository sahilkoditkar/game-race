import * as THREE from 'three';

const clamp = THREE.MathUtils.clamp;
function wrapAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

/**
 * Drive an AI-controlled car for one frame.
 * ctx: { cars, track, live, bestPlayerProgress, time }
 */
export function driveAI(car, ctx, dt) {
  const { track, cars } = ctx;
  const inp = car.input;
  if (!ctx.live) { inp.throttle = 0; inp.brake = 0; inp.steer = 0; return; }

  // Un-stick routine: reverse briefly while steering the other way.
  if (car.reverseTimer > 0) {
    car.reverseTimer -= dt;
    inp.throttle = 0; inp.brake = 1; inp.steer = -(car.lastSteer || 0.5); inp.handbrake = false;
    return;
  }
  if (car.stuckTimer > 1.6) { car.reverseTimer = 1.1; car.stuckTimer = 0; }

  const speed = car.speed;
  const lookM = clamp(7 + speed * 0.42, 9, 42);
  const k = Math.round(lookM / track.spacing);
  const idx = car.trackIdx;
  const ahead = track.sample(idx + k);
  const hw = ahead.hw;
  const farCurv = track.sample(idx + k * 2).curv;

  // Racing line: hug the inside of upcoming corners, plus a personal lane bias.
  let lane = (car.laneBase || 0) * 0.5 + Math.sign(farCurv) * Math.min(1, Math.abs(farCurv) * 45) * hw * 0.35;

  // Simple avoidance: look at nearby cars in our frame.
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  const rx = -fz, rz = fx;
  let slowFor = 0;
  for (const o of cars) {
    if (o === car) continue;
    const dx = o.pos.x - car.pos.x, dz = o.pos.z - car.pos.z;
    const fwd = dx * fx + dz * fz, side = dx * rx + dz * rz;
    if (fwd > 0 && fwd < 16 && Math.abs(side) < 3.2) {
      // `side` is right-positive; `lane` is track-left-positive. Car on our right → move left (lane up).
      const dir = side >= 0 ? 1 : -1;
      lane += dir * 3.2 * (1 - fwd / 16);
      const closing = speed - o.speed;
      if (fwd < 8 && closing > 0) slowFor = Math.max(slowFor, closing);
    }
  }
  lane = clamp(lane, -hw * 0.75, hw * 0.75);

  const tx = ahead.p.x + ahead.n.x * lane, tz = ahead.p.z + ahead.n.z * lane;
  const desired = Math.atan2(tx - car.pos.x, tz - car.pos.z);
  const diff = wrapAngle(desired - car.heading);
  let steer = clamp(-diff * 2.6, -1, 1);
  // tiny human-like wobble
  car.aiPhase = (car.aiPhase || Math.random() * 100) + dt;
  steer += Math.sin(car.aiPhase * 1.7) * 0.03;
  inp.steer = clamp(steer, -1, 1);
  car.lastSteer = inp.steer;

  // Target speed from curvature ahead
  const braking = 18 + speed * 1.4;
  const curv = Math.max(track.maxCurvatureAhead(idx, braking), 0.0004);
  const latAcc = car.stats.grip * 2.6 * (0.6 + 0.3 * car.aiSkill);
  let cornerSpeed = Math.sqrt(latAcc / curv);
  let target = Math.min(car.stats.maxSpeed * (0.82 + 0.2 * car.aiSkill), cornerSpeed);
  // Dynamic mode: a per-car pace multiplier calibrated against the player's lap times
  if (car.paceScale !== undefined) target *= car.paceScale;

  // Rubber banding relative to best human (keeps races close but never blatant)
  if (ctx.bestPlayerProgress !== null && ctx.bestPlayerProgress !== undefined) {
    const gap = car.progress - ctx.bestPlayerProgress; // samples
    if (ctx.dynamic) { /* handled by the per-car pace scale */ }
    else if (gap > 120) target *= 0.94;
    else if (gap < -140) target *= 1.06;
  }

  if (speed > target + 1.5 || slowFor > 2) {
    inp.throttle = 0;
    inp.brake = clamp((speed - target) / 12 + slowFor * 0.05, 0.35, 1);
  } else {
    inp.throttle = 1;
    inp.brake = 0;
  }
  inp.handbrake = false;
}
