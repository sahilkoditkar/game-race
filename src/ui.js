import { TRACKS, getTrack } from './tracks.js';
import { CARS, SERIES, UPGRADES, PLAYER_COLORS, getCar, getSeries, upgradeCost, effectiveStats } from './data.js';
import { SCHEMES } from './input.js';
import { seriesState, isSeriesUnlocked, standings, canBuyUpgrade } from './career.js';
import { fmtTime } from './race.js';

const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const money = (n) => `${Math.round(n).toLocaleString()} cr`;
const ORD = (n) => n + (['th', 'st', 'nd', 'rd'][((n % 100) - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

export class UI {
  constructor(app) {
    this.app = app;
    this.el = document.getElementById('screen');
  }

  hide() { this.el.innerHTML = ''; this.el.classList.add('empty'); }

  show(html, { transparent = false } = {}) {
    this.el.classList.remove('empty');
    this.el.classList.toggle('transparent', transparent);
    this.el.innerHTML = html;
    this.el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => this.app.audio.click()));
  }

  on(selector, event, fn) {
    this.el.querySelectorAll(selector).forEach(el => el.addEventListener(event, (e) => fn(e, el)));
  }

  toast(msg, ms = 2200) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  // ------------------------------------------------------------ Main menu
  mainMenu() {
    const p = this.app.profile;
    this.show(`
      <div class="panel narrow">
        <div class="logo">APEX <span>RUSH</span></div>
        <div class="tagline">3D arcade racing · split screen · career</div>
        <div class="menu">
          <button class="primary" data-go="career">Career <span class="hint" style="color:#fff;opacity:.85">${money(p.money)}</span></button>
          <button data-go="quick">Quick Race <span class="hint">Single player vs AI</span></button>
          <button data-go="split">Split Screen <span class="hint">2 players, one screen</span></button>
          <button data-go="timetrial">Time Trial <span class="hint">Beat your best laps</span></button>
          <button data-go="settings">Settings &amp; Controls</button>
        </div>
        <div class="footer-note">P1: <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> + <kbd>Shift</kbd> handbrake · P2: <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd> + <kbd>R-Shift</kbd> · Gamepads supported · <kbd>Esc</kbd> pause</div>
      </div>`);
    this.on('[data-go]', 'click', (e, el) => {
      const go = el.dataset.go;
      if (go === 'career') this.career();
      else if (go === 'settings') this.settings();
      else this.raceSetup(go);
    });
  }

  // ------------------------------------------------------------ Race setup
  raceSetup(mode) {
    const app = this.app;
    const p = app.profile;
    const st = app.setup = app.setup || {
      trackId: 'sunrise', laps: 3, aiCount: 5, difficulty: 1,
      players: [
        { name: 'Player 1', carId: 'hatch', colorIndex: 0, scheme: p.settings.p1Scheme, pad: 0 },
        { name: 'Player 2', carId: 'gt', colorIndex: 1, scheme: p.settings.p2Scheme, pad: 1 },
      ],
    };
    st.mode = mode;
    const nPlayers = mode === 'split' ? 2 : 1;
    const title = { quick: 'Quick Race', split: 'Split Screen', timetrial: 'Time Trial' }[mode];
    const render = () => {
      const tr = getTrack(st.trackId);
      this.show(`
        <div class="panel">
          <div class="row between"><h2>${title}</h2><button class="small ghost" data-back>← Back</button></div>
          <h3>Track</h3>
          <div class="grid-3">
            ${TRACKS.map(t => `<div class="card ${t.id === st.trackId ? 'selected' : ''}" data-track="${t.id}" style="cursor:pointer">
              <h4>${t.name}</h4><div class="meta">${t.desc}</div>
              <div class="meta" style="margin-top:6px">${'★'.repeat(t.difficulty)}${'☆'.repeat(4 - t.difficulty)} · ${t.theme}</div></div>`).join('')}
          </div>
          <div class="grid-2" style="margin-top:16px">
            <div class="field"><label>Laps: <b id="lapsv">${st.laps}</b></label><input type="range" min="1" max="10" value="${st.laps}" data-field="laps"></div>
            ${mode !== 'timetrial' ? `
            <div class="field"><label>AI opponents: <b id="aiv">${st.aiCount}</b></label><input type="range" min="0" max="11" value="${st.aiCount}" data-field="aiCount"></div>
            <div class="field"><label>AI difficulty</label><div class="chips">
              ${['Easy', 'Medium', 'Hard', 'Insane'].map((d, i) => `<div class="chip ${st.difficulty === i ? 'active' : ''}" data-diff="${i}">${d}</div>`).join('')}
            </div></div>` : `<div class="field"><label>Best lap here</label><div>${this._bestLapLine(tr.id)}</div></div>`}
          </div>
          <div class="grid-2">
            ${st.players.slice(0, nPlayers).map((pl, i) => `
              <div class="card">
                <h4>${nPlayers > 1 ? `Player ${i + 1}` : 'Your car'} <span class="badge">${SCHEMES[pl.scheme].name}${pl.pad >= 0 ? ' / Gamepad ' + (pl.pad + 1) : ''}</span></h4>
                <div class="field"><label>Name</label><input type="text" maxlength="14" value="${pl.name}" data-name="${i}"></div>
                <div class="field"><label>Car</label><select data-car="${i}">${CARS.map(c => `<option value="${c.id}" ${c.id === pl.carId ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div>
                ${this._statBars(effectiveStats(getCar(pl.carId), { engine: 2, tires: 2, brakes: 2, aero: 2 }))}
                <div class="field"><label>Colour</label><div class="chips">${PLAYER_COLORS.map((c, ci) => `<div class="swatch ${pl.colorIndex === ci ? 'active' : ''}" data-color="${i}:${ci}" style="background:${hex(c)}"></div>`).join('')}</div></div>
              </div>`).join('')}
          </div>
          <div class="row end" style="margin-top:18px"><button class="primary" data-start style="min-width:220px">Start Race</button></div>
        </div>`);
      this.on('[data-back]', 'click', () => this.mainMenu());
      this.on('[data-track]', 'click', (e, el) => { st.trackId = el.dataset.track; render(); });
      this.on('[data-field]', 'input', (e, el) => { st[el.dataset.field] = parseInt(el.value, 10); const v = document.getElementById(el.dataset.field === 'laps' ? 'lapsv' : 'aiv'); if (v) v.textContent = el.value; });
      this.on('[data-diff]', 'click', (e, el) => { st.difficulty = parseInt(el.dataset.diff, 10); render(); });
      this.on('[data-name]', 'input', (e, el) => { st.players[+el.dataset.name].name = el.value.trim() || `Player ${+el.dataset.name + 1}`; });
      this.on('[data-car]', 'change', (e, el) => { st.players[+el.dataset.car].carId = el.value; render(); });
      this.on('[data-color]', 'click', (e, el) => { const [i, ci] = el.dataset.color.split(':').map(Number); st.players[i].colorIndex = ci; render(); });
      this.on('[data-start]', 'click', () => app.startQuickRace(mode));
    };
    render();
  }

  _bestLapLine(trackId) {
    const bl = this.app.profile.bestLaps;
    const entries = Object.entries(bl).filter(([k]) => k.startsWith(trackId + ':'));
    if (!entries.length) return '<span class="meta">No time set yet</span>';
    return entries.map(([k, t]) => `<div>${getCar(k.split(':')[1]).name}: <b>${fmtTime(t)}</b></div>`).join('');
  }

  _statBars(s) {
    const rows = [['Top speed', s.maxSpeed / 95], ['Acceleration', s.accel / 32], ['Grip', s.grip / 12.5], ['Braking', s.brake / 62]];
    return rows.map(([n, v]) => `<div class="stat-row"><span>${n}</span><span>${Math.round(v * 100)}</span></div><div class="stat-bar"><i style="width:${Math.min(100, v * 100)}%"></i></div>`).join('');
  }

  // ------------------------------------------------------------ Career hub
  career() {
    const app = this.app, p = app.profile;
    const car = getCar(p.selected);
    const current = SERIES.find(s => isSeriesUnlocked(p, s) && !seriesState(p, s.id).complete) || null;
    this.show(`
      <div class="panel">
        <div class="row between">
          <div><h2 style="margin:0">Career</h2><div class="meta" style="color:var(--muted)">${p.stats.races} races · ${p.stats.wins} wins · ${p.stats.podiums} podiums</div></div>
          <div style="text-align:right"><div class="money" style="font-size:26px">${money(p.money)}</div><div class="meta" style="color:var(--muted)">Driving: ${car.name}</div></div>
        </div>
        <div class="row" style="margin:14px 0">
          <button data-garage>🔧 Garage <span class="hint">Buy cars &amp; upgrades</span></button>
          <button data-back class="ghost">← Main menu</button>
        </div>
        <h3>Championships</h3>
        <div class="menu">
          ${SERIES.map(s => {
            const st = seriesState(p, s.id);
            const unlocked = isSeriesUnlocked(p, s);
            const rows = standings(p, s.id);
            const myRank = rows.findIndex(r => r.isPlayer) + 1;
            const badge = !unlocked ? `<span class="badge locked">Locked · finish ${ORD(s.requireRank)} or better in ${getSeries(s.requires).name}</span>`
              : st.complete ? `<span class="badge ${st.finalRank === 1 ? 'gold' : 'done'}">${st.finalRank === 1 ? '🏆 Champion' : 'Finished ' + ORD(st.finalRank)}</span>`
              : st.event > 0 ? `<span class="badge">Round ${st.event + 1}/${s.events.length} · ${myRank ? ORD(myRank) + ' in standings' : ''}</span>` : `<span class="badge">Not started</span>`;
            const next = !st.complete && unlocked ? s.events[st.event] : null;
            return `<div class="card ${current && current.id === s.id ? 'selected' : ''}">
              <div class="row between">
                <div><h4>${s.name} ${badge}</h4><div class="meta">${s.desc}</div>
                  <div class="meta" style="margin-top:6px">${s.aiCount} opponents · ${s.events.length} rounds · prize up to ${money(s.prize[0])}/race · title bonus ${money(s.bonus)}</div>
                  <div class="progress" style="margin-top:8px;max-width:320px"><i style="width:${(st.event / s.events.length) * 100}%"></i></div>
                </div>
                <div class="menu" style="min-width:200px">
                  ${next ? `<button class="primary" data-race="${s.id}">Race: ${getTrack(next.track).name}<br><small style="opacity:.8;font-weight:400">${next.laps} laps</small></button>` : ''}
                  ${unlocked && st.event > 0 ? `<button class="small" data-standings="${s.id}">Standings</button>` : ''}
                  ${st.complete ? `<button class="small" data-restart="${s.id}">Replay series</button>` : ''}
                </div>
              </div>
              <div class="standings-box" id="stand-${s.id}"></div>
            </div>`;
          }).join('')}
        </div>
      </div>`);
    this.on('[data-back]', 'click', () => this.mainMenu());
    this.on('[data-garage]', 'click', () => this.garage());
    this.on('[data-race]', 'click', (e, el) => app.startCareerRace(el.dataset.race));
    this.on('[data-restart]', 'click', (e, el) => { if (confirm('Replay this series from round 1? Standings will be reset (your credits and cars are kept).')) { app.restartSeries(el.dataset.restart); this.career(); } });
    this.on('[data-standings]', 'click', (e, el) => {
      const box = document.getElementById(`stand-${el.dataset.standings}`);
      box.innerHTML = box.innerHTML ? '' : this._standingsTable(el.dataset.standings);
    });
  }

  _standingsTable(seriesId, limit = 12) {
    const rows = standings(this.app.profile, seriesId).slice(0, limit);
    return `<table style="margin-top:12px"><tr><th>#</th><th>Driver</th><th class="num">Points</th></tr>
      ${rows.map((r, i) => `<tr class="${r.isPlayer ? 'you' : ''}"><td>${i + 1}</td><td>${r.name}</td><td class="num">${r.points}</td></tr>`).join('')}</table>`;
  }

  // ------------------------------------------------------------ Garage
  garage() {
    const app = this.app, p = app.profile;
    const sel = getCar(p.selected);
    const lv = p.upgrades[sel.id] || {};
    this.show(`
      <div class="panel">
        <div class="row between"><h2>Garage</h2><div class="money" style="font-size:24px">${money(p.money)}</div></div>
        <h3>Cars</h3>
        <div class="grid-2">
          ${CARS.map(c => {
            const owned = p.cars.includes(c.id);
            return `<div class="card ${c.id === p.selected ? 'selected' : ''}">
              <div class="row between"><h4>${c.name}</h4>${owned ? (c.id === p.selected ? '<span class="badge gold">Selected</span>' : '<span class="badge done">Owned</span>') : `<span class="badge">${money(c.price)}</span>`}</div>
              <div class="meta" style="margin-bottom:8px">${c.desc}</div>
              ${this._statBars(effectiveStats(c, p.upgrades[c.id] || {}))}
              <div class="row end" style="margin-top:8px">
                ${owned && c.id !== p.selected ? `<button class="small" data-select="${c.id}">Select</button>` : ''}
                ${!owned ? `<button class="small primary" data-buy="${c.id}" ${p.money < c.price ? 'disabled' : ''}>Buy · ${money(c.price)}</button>` : ''}
              </div></div>`;
          }).join('')}
        </div>
        <h3>Upgrades — ${sel.name}</h3>
        <div class="grid-2">
          ${UPGRADES.map(u => {
            const lvl = lv[u.id] || 0;
            const r = canBuyUpgrade(p, sel.id, u.id);
            return `<div class="card"><div class="row between"><h4>${u.name} <span class="badge">Lv ${lvl}/${u.maxLevel}</span></h4>
              ${r.reason === 'MAX' ? '<span class="badge gold">MAX</span>' : `<button class="small primary" data-up="${u.id}" ${r.ok ? '' : 'disabled'}>Upgrade · ${money(r.cost)}</button>`}</div>
              <div class="meta">${u.desc}</div>
              <div class="stat-bar" style="margin-top:8px"><i style="width:${(lvl / u.maxLevel) * 100}%"></i></div></div>`;
          }).join('')}
        </div>
        <div class="row end" style="margin-top:16px"><button data-back>← Back to career</button></div>
      </div>`);
    this.on('[data-back]', 'click', () => this.career());
    this.on('[data-select]', 'click', (e, el) => { p.selected = el.dataset.select; app.save(); this.garage(); });
    this.on('[data-buy]', 'click', (e, el) => { if (app.buyCar(el.dataset.buy)) { this.toast(`Bought ${getCar(el.dataset.buy).name}!`); } this.garage(); });
    this.on('[data-up]', 'click', (e, el) => { if (app.buyUpgrade(sel.id, el.dataset.up)) this.toast('Upgrade installed'); this.garage(); });
  }

  // ------------------------------------------------------------ Settings
  settings() {
    const app = this.app, s = app.profile.settings;
    const keyRow = (label, keys) => `<tr><td>${label}</td><td>${keys.map(k => `<kbd>${k}</kbd>`).join(' ')}</td></tr>`;
    this.show(`
      <div class="panel">
        <div class="row between"><h2>Settings</h2><button class="small ghost" data-back>← Back</button></div>
        <div class="grid-2">
          <div>
            <div class="field"><label>Graphics quality</label><div class="chips">
              <div class="chip ${s.quality === 'high' ? 'active' : ''}" data-q="high">High (shadows)</div>
              <div class="chip ${s.quality === 'low' ? 'active' : ''}" data-q="low">Low (fast)</div></div></div>
            <div class="field"><label>Sound: ${s.sound ? 'on' : 'off'}</label><div class="chips">
              <div class="chip ${s.sound ? 'active' : ''}" data-sound="1">On</div><div class="chip ${!s.sound ? 'active' : ''}" data-sound="0">Off</div></div></div>
            <div class="field"><label>Volume</label><input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-vol></div>
            <div class="field"><label>Player 1 keys</label><select data-scheme="p1Scheme">${Object.entries(SCHEMES).map(([k, v]) => `<option value="${k}" ${s.p1Scheme === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select></div>
            <div class="field"><label>Player 2 keys</label><select data-scheme="p2Scheme">${Object.entries(SCHEMES).map(([k, v]) => `<option value="${k}" ${s.p2Scheme === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select></div>
            <button class="small" data-fullscreen>Toggle fullscreen</button>
          </div>
          <div>
            <h3>Controls</h3>
            <table class="controls-table">
              ${keyRow('Accelerate', ['W', '↑', 'Pad: RT / A'])}
              ${keyRow('Brake / reverse', ['S', '↓', 'Pad: LT / X'])}
              ${keyRow('Steer', ['A', 'D', '←', '→', 'Pad: left stick'])}
              ${keyRow('Handbrake (drift)', ['Shift', 'Space', 'R-Shift', 'R-Ctrl', 'Pad: B / RB'])}
              ${keyRow('Reset to track', ['R', '.', 'Pad: Y'])}
              ${keyRow('Pause', ['Esc', 'Pad: Start'])}
            </table>
            <p>Gamepad 1 drives Player 1, gamepad 2 drives Player 2. Keyboard always works too.</p>
            <h3>Save data</h3>
            <button class="small" data-reset style="border-color:var(--bad);color:var(--bad)">Reset career progress</button>
          </div>
        </div>
      </div>`);
    this.on('[data-back]', 'click', () => this.mainMenu());
    this.on('[data-q]', 'click', (e, el) => { s.quality = el.dataset.q; app.save(); this.settings(); });
    this.on('[data-sound]', 'click', (e, el) => { s.sound = el.dataset.sound === '1'; app.audio.setEnabled(s.sound); app.save(); this.settings(); });
    this.on('[data-vol]', 'input', (e, el) => { s.volume = parseFloat(el.value); app.audio.setVolume(s.volume); app.save(); });
    this.on('[data-scheme]', 'change', (e, el) => { s[el.dataset.scheme] = el.value; if (app.setup) { app.setup.players[0].scheme = s.p1Scheme; app.setup.players[1].scheme = s.p2Scheme; } app.save(); });
    this.on('[data-fullscreen]', 'click', () => app.toggleFullscreen());
    this.on('[data-reset]', 'click', () => { if (confirm('Delete all career progress, cars and best laps?')) { app.resetProfile(); this.toast('Progress reset'); this.settings(); } });
  }

  // ------------------------------------------------------------ Pause
  pause() {
    this.show(`
      <div class="panel narrow">
        <h2>Paused</h2>
        <div class="menu">
          <button class="primary" data-resume>Resume</button>
          <button data-restart>Restart race</button>
          <button data-quit>Quit to menu</button>
        </div>
      </div>`);
    this.on('[data-resume]', 'click', () => this.app.togglePause());
    this.on('[data-restart]', 'click', () => this.app.restartRace());
    this.on('[data-quit]', 'click', () => this.app.quitRace());
  }

  // ------------------------------------------------------------ Results
  results(results, ctx) {
    const app = this.app;
    const winner = results[0];
    const top3 = results.slice(0, 3);
    const players = results.filter(r => r.isPlayer);
    const heading = ctx.mode === 'timetrial' ? 'Time Trial Complete'
      : players.length === 1 ? `${ORD(players[0].rank)} place`
      : `${players.sort((a, b) => a.rank - b.rank)[0].name} wins the duel!`;
    const bestOverall = Math.min(...results.filter(r => r.bestLap).map(r => r.bestLap));
    let careerHtml = '';
    if (ctx.career) {
      const c = ctx.career;
      careerHtml = `<div class="card" style="margin-top:14px">
        <h4>Championship update</h4>
        <div class="row" style="gap:24px">
          <div><div class="meta">Points earned</div><div style="font-size:24px;font-weight:800">+${c.pointsEarned}</div></div>
          <div><div class="meta">Prize money</div><div class="money" style="font-size:24px">+${money(c.money)}</div></div>
          ${c.championBonus ? `<div><div class="meta">Title bonus</div><div class="money" style="font-size:24px">+${money(c.championBonus)}</div></div>` : ''}
        </div>
        ${c.seriesComplete ? `<div class="notice" style="margin-top:10px">Series complete — you finished <b>${ORD(c.finalRank)}</b> overall.${c.unlocked ? ` <b>${c.unlocked.name}</b> unlocked!` : ''}</div>` : ''}
        ${this._standingsTable(ctx.seriesId, 6)}
      </div>`;
    }
    this.show(`
      <div class="panel">
        <h1>${heading}</h1>
        <div class="tagline">${ctx.trackName} · ${ctx.laps} lap${ctx.laps === 1 ? '' : 's'}</div>
        ${ctx.mode !== 'timetrial' ? `<div class="podium">${top3.map(r => `<div class="step p${r.rank}"><div class="n">${r.rank}</div><div class="who"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${hex(r.color)};margin-right:5px"></span>${r.name}</div></div>`).join('')}</div>` : ''}
        <table>
          <tr><th>#</th><th>Driver</th><th class="num">Time</th><th class="num">Best lap</th></tr>
          ${results.map(r => `<tr class="${r.isPlayer ? 'you' : ''}"><td>${r.rank}</td><td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${hex(r.color)};margin-right:8px"></span>${r.name}</td>
            <td class="num">${r.finished ? (r.rank === 1 || !winner.finished ? fmtTime(r.time) : '+' + (r.time - winner.time).toFixed(3)) : `${r.laps}/${ctx.laps} laps`}</td>
            <td class="num" style="${r.bestLap === bestOverall ? 'color:var(--accent-2);font-weight:700' : ''}">${fmtTime(r.bestLap)}</td></tr>`).join('')}
        </table>
        ${ctx.newBest ? `<div class="notice" style="margin-top:12px">🏁 New personal best lap: <b>${fmtTime(ctx.newBest)}</b></div>` : ''}
        ${careerHtml}
        <div class="row end" style="margin-top:18px">
          ${ctx.mode !== 'career' ? '<button data-retry>Race again</button>' : ''}
          <button class="primary" data-continue>${ctx.mode === 'career' ? 'Continue' : 'Main menu'}</button>
        </div>
      </div>`);
    this.on('[data-retry]', 'click', () => app.restartRace());
    this.on('[data-continue]', 'click', () => ctx.mode === 'career' ? this.career() : this.mainMenu());
  }
}
