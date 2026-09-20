import { fmtTime } from './race.js';

const ORD = (n) => n + (['th', 'st', 'nd', 'rd'][((n % 100) - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

export class HUD {
  constructor(nPlayers, track, cars, config) {
    this.layer = document.getElementById('hud-layer');
    this.center = document.getElementById('hud-center');
    this.divider = document.getElementById('hud-divider');
    this.track = track; this.cars = cars; this.config = config;
    this.panels = [];
    this.layer.classList.remove('hidden');
    for (let i = 0; i < 2; i++) {
      const el = document.getElementById(`hud-${i}`);
      el.innerHTML = '';
      el.classList.toggle('hidden', i >= nPlayers);
      if (i >= nPlayers) continue;
      el.innerHTML = `
        <div class="top-left">
          <div class="name">${config.players[i].name}</div>
          <div class="pos"><b>-</b>${cars.length > 1 ? `<span class="of">/ ${cars.length}</span>` : ''}</div>
          <div class="lap">${track.open ? 'STAGE <b></b><span></span>' : `LAP <b>0</b><span>/${config.laps}</span>`}</div>
          <div class="time"><span>${track.open ? 'TIME' : 'LAP'}</span> <b>0:00.000</b></div>
          <div class="time"><span>BEST</span> <b>--:--.---</b></div>
        </div>
        <div class="standings"></div>
        <div class="bottom-right">
          <div class="speed"><b>0</b><small>km/h</small></div>
          <div class="gear-bar"><i style="width:0%"></i></div>
        </div>
        <canvas class="minimap" width="220" height="220"></canvas>
        <div class="msg"><span class="main"></span><span class="sub"></span></div>
        <div class="wrong hidden">⚠ WRONG WAY</div>`;
      const q = (sel) => el.querySelector(sel);
      this.panels.push({
        el, pos: q('.pos b'), lap: q('.lap b'), lapSpan: q('.lap span'), lapTime: q('.time:nth-of-type(4) b'), best: q('.time:nth-of-type(5) b'),
        speed: q('.speed b'), bar: q('.gear-bar i'), map: q('.minimap'), msg: q('.msg'), msgMain: q('.msg .main'), msgSub: q('.msg .sub'),
        wrong: q('.wrong'), standings: q('.standings'), msgTimer: 0,
      });
    }
    this.standingsTimer = 0;
    this._prepMinimap();
  }

  layout(n, vertical) {
    const [a, b] = this.panels.map(p => p.el);
    for (const el of [a, b]) if (el) el.className = 'hud';
    if (n === 2) {
      a.classList.add(vertical ? 'half-left' : 'half-top');
      b.classList.add(vertical ? 'half-right' : 'half-bottom');
      this.divider.className = vertical ? 'vertical' : 'horizontal';
    } else this.divider.className = 'hidden';
  }

  _prepMinimap() {
    const b = this.track.bounds;
    const pad = 16;
    const size = 220;
    const w = b.maxX - b.minX, h = b.maxZ - b.minZ;
    const scale = (size - pad * 2) / Math.max(w, h);
    this.mapScale = scale;
    this.mapOff = { x: pad + (size - pad * 2 - w * scale) / 2 - b.minX * scale, z: pad + (size - pad * 2 - h * scale) / 2 - b.minZ * scale };
    this.mapPath = new Path2D();
    this.track.samples.forEach((s, i) => {
      const x = s.p.x * scale + this.mapOff.x, y = s.p.z * scale + this.mapOff.z;
      if (i === 0) this.mapPath.moveTo(x, y); else this.mapPath.lineTo(x, y);
    });
    if (!this.track.open) this.mapPath.closePath();
  }

  _drawMinimap(p, me) {
    const ctx = p.map.getContext('2d');
    ctx.clearRect(0, 0, 220, 220);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 11; ctx.stroke(this.mapPath);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 7; ctx.stroke(this.mapPath);
    const s0 = this.track.samples[this.track.startIdx || 0];
    ctx.fillStyle = '#fff';
    ctx.fillRect(s0.p.x * this.mapScale + this.mapOff.x - 4, s0.p.z * this.mapScale + this.mapOff.z - 4, 8, 8);
    if (this.track.open) { const sf = this.track.samples[this.track.finishIdx]; ctx.fillStyle = '#3ddc84'; ctx.fillRect(sf.p.x * this.mapScale + this.mapOff.x - 4, sf.p.z * this.mapScale + this.mapOff.z - 4, 8, 8); }
    for (const c of this.cars) {
      const x = c.pos.x * this.mapScale + this.mapOff.x, y = c.pos.z * this.mapScale + this.mapOff.z;
      ctx.beginPath();
      ctx.arc(x, y, c === me ? 6 : c.isPlayer ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#' + c.color.toString(16).padStart(6, '0');
      ctx.fill();
      if (c === me) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
    }
  }

  showCountdown(text, go = false) {
    this.center.innerHTML = `<div class="count ${go ? 'go' : ''}">${text}</div>`;
    clearTimeout(this._cdTimer);
    this._cdTimer = setTimeout(() => { this.center.innerHTML = ''; }, go ? 900 : 1000);
  }

  flash(playerIndex, main, sub = '') {
    const p = this.panels[playerIndex];
    if (!p) return;
    p.msgMain.textContent = main; p.msgSub.textContent = sub;
    p.msg.classList.add('show');
    p.msgTimer = 2.2;
  }

  update(race, dt) {
    this.standingsTimer -= dt;
    const doStandings = this.standingsTimer <= 0;
    if (doStandings) this.standingsTimer = 0.3;
    race.players.forEach((car, i) => {
      const p = this.panels[i];
      if (!p) return;
      p.pos.textContent = ORD(car.rank);
      if (race.track.open) {
        const remain = Math.max(0, (race.track.finishIdx - car.trackIdx) * race.track.spacing / 1000);
        p.lap.textContent = car.finished ? 'DONE' : `${remain.toFixed(1)} km`;
        p.lapSpan.textContent = car.finished ? '' : ' to go';
      } else p.lap.textContent = Math.min(race.config.laps, Math.max(0, car.lap));
      p.lapTime.textContent = race.state === 'countdown' ? '0:00.000' : fmtTime(car.finished ? car.finishTime : race.time - car.lapStart);
      p.best.textContent = fmtTime(car.bestLap);
      const kmh = Math.round(car.speed * 3.6);
      p.speed.textContent = kmh;
      p.bar.style.width = `${Math.min(100, (car.speed / car.stats.maxSpeed) * 100)}%`;
      p.wrong.classList.toggle('hidden', !car.wrongWay);
      if (p.msgTimer > 0) { p.msgTimer -= dt; if (p.msgTimer <= 0) p.msg.classList.remove('show'); }
      this._drawMinimap(p, car);
      if (doStandings) {
        const list = race.ranking || race.cars;
        const top = list.slice(0, 5);
        if (!top.includes(car)) top.push(car);
        p.standings.innerHTML = top.map(c => `<div class="${c === car ? 'me' : ''}"><span>${c.rank}</span><span>${c.name}</span>${c.finished ? '<span>🏁</span>' : ''}</div>`).join('');
      }
    });
  }

  dispose() {
    this.layer.classList.add('hidden');
    this.center.innerHTML = '';
    for (const p of this.panels) p.el.innerHTML = '';
  }
}
