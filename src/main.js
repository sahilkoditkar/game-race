import * as THREE from 'three';
import { Input } from './input.js';
import { AudioSystem } from './audio.js';
import { UI } from './ui.js';
import { Race } from './race.js';
import { getTrack } from './tracks.js';
import { getCar, getSeries, PLAYER_COLORS, effectiveStats } from './data.js';
import {
  loadProfile, saveProfile, resetProfile, seriesState, seriesField, quickField, playerStats,
  applyCareerResult, restartSeries, buyCar, buyUpgrade, recordBestLap,
} from './career.js';

class App {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.input = new Input();
    this.audio = new AudioSystem();
    this.profile = loadProfile();
    this.audio.setVolume(this.profile.settings.volume);
    this.audio.setEnabled(this.profile.settings.sound);
    this.ui = new UI(this);
    this.race = null;
    this.raceCtx = null;
    this.lastRaceConfig = null;
    this.paused = false;
    this.clock = new THREE.Clock();

    window.addEventListener('resize', () => this.onResize());
    // First user gesture unlocks audio
    const unlock = () => { this.audio.init(); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    this._buildIdleScene();
    this.ui.mainMenu();
    document.getElementById('loading').style.opacity = '0';
    setTimeout(() => document.getElementById('loading').remove(), 450);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // A slowly rotating showcase car behind the menus.
  _buildIdleScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0d12);
    scene.fog = new THREE.Fog(0x0b0d12, 20, 60);
    scene.add(new THREE.HemisphereLight(0x8ab4ff, 0x1a1c24, 2.0));
    const key = new THREE.DirectionalLight(0xffffff, 4.0); key.position.set(5, 8, 6); key.castShadow = true; scene.add(key);
    const rim = new THREE.DirectionalLight(0xff5a1f, 3.0); rim.position.set(-6, 3, -6); scene.add(rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.6, metalness: 0.3 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    this.idle = { scene, camera: new THREE.PerspectiveCamera(45, 1, 0.1, 100), cars: [], t: 0 };
    this.idle.camera.position.set(0, 3, 10);
    this._refreshIdleCars();
    this.onResize();
  }

  _refreshIdleCars() {
    if (!this.idle) return;
    for (const c of this.idle.cars) this.idle.scene.remove(c);
    this.idle.cars = [];
    import('./car.js').then(({ buildCarMesh }) => {
      const car = getCar(this.profile.selected);
      const m = buildCarMesh(car.shape, PLAYER_COLORS[this.profile.colorIndex || 0]);
      m.position.x = 4.2;
      this.idle.scene.add(m);
      this.idle.cars.push(m);
    });
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    if (this.idle) { this.idle.camera.aspect = w / h; this.idle.camera.updateProjectionMatrix(); }
    if (this.race) this.race.resize();
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    if (this.race) {
      const pauseKey = this.input.justPressed('Escape') || this.input.read('none', 0).pause || this.input.read('none', 1).pause;
      if (pauseKey && this.race.state !== 'finished') this.togglePause();
      if (!this.paused) this.race.update(dt);
      this.race.render();
    } else if (this.idle) {
      this.idle.t += dt;
      for (const c of this.idle.cars) c.rotation.y = this.idle.t * 0.5;
      this.idle.camera.position.set(Math.sin(this.idle.t * 0.2) * 1.5, 2.4, 9);
      this.idle.camera.lookAt(1.5, 0.6, 0);
      this.renderer.render(this.idle.scene, this.idle.camera);
    }
    this.input.endFrame();
  }

  // ------------------------------------------------------------ Races
  _playerEntry(p, i, stats, shape) {
    return { name: p.name, color: PLAYER_COLORS[p.colorIndex % PLAYER_COLORS.length], stats, shape, scheme: p.scheme, pad: p.pad ?? i };
  }

  startQuickRace(mode) {
    const st = this.setup;
    const track = getTrack(st.trackId);
    const nPlayers = mode === 'split' ? 2 : 1;
    const players = st.players.slice(0, nPlayers).map((p, i) => {
      const car = getCar(p.carId);
      return this._playerEntry(p, i, effectiveStats(car, { engine: 2, tires: 2, brakes: 2, aero: 2 }), car.shape);
    });
    const difficulty = [0.15, 0.45, 0.75, 1.0][st.difficulty] ?? 0.5;
    const ai = mode === 'timetrial' ? [] : quickField(st.aiCount, difficulty, st.players[0].carId);
    this.startRace({ track, laps: st.laps, players, ai, mode, quality: this.profile.settings.quality }, { mode, trackName: track.name, laps: st.laps, trackId: track.id, carId: st.players[0].carId });
  }

  startCareerRace(seriesId) {
    const series = getSeries(seriesId);
    const st = seriesState(this.profile, seriesId);
    const ev = series.events[st.event];
    if (!ev) return;
    const track = getTrack(ev.track);
    const car = getCar(this.profile.selected);
    const players = [this._playerEntry({ name: this.profile.name, colorIndex: this.profile.colorIndex || 0, scheme: this.profile.settings.p1Scheme, pad: 0 }, 0, playerStats(this.profile), car.shape)];
    const ai = seriesField(series);
    this.startRace({ track, laps: ev.laps, players, ai, mode: 'career', quality: this.profile.settings.quality },
      { mode: 'career', seriesId, trackName: track.name, laps: ev.laps, trackId: track.id, carId: car.id });
  }

  startRace(config, ctx) {
    this.disposeRace();
    this.lastRaceConfig = { config, ctx };
    this.raceCtx = ctx;
    this.ui.hide();
    this.audio.init();
    this.race = new Race({ renderer: this.renderer, config, input: this.input, audio: this.audio, onFinish: (results) => this.onRaceFinished(results) });
    this.paused = false;
  }

  onRaceFinished(results) {
    const ctx = { ...this.raceCtx };
    const me = results.find(r => r.isPlayer && r.playerIndex === 0);
    if (me && me.bestLap && ctx.carId && recordBestLap(this.profile, ctx.trackId, ctx.carId, me.bestLap)) ctx.newBest = me.bestLap;
    if (ctx.mode === 'career') {
      ctx.career = applyCareerResult(this.profile, ctx.seriesId, results);
      this._refreshIdleCars();
    }
    document.getElementById('hud-layer').classList.add('hidden');
    this.ui.results(results, ctx);
  }

  restartRace() {
    if (!this.lastRaceConfig) return this.ui.mainMenu();
    const { config, ctx } = this.lastRaceConfig;
    if (ctx.mode === 'career') {
      // Career events can't be replayed once scored; only allow restart mid-race.
      if (this.race && this.race.state !== 'finished') { this.startRace(config, ctx); return; }
      return this.ui.career();
    }
    this.startRace(config, ctx);
  }

  quitRace() {
    this.disposeRace();
    this.paused = false;
    this.ui.mainMenu();
  }

  disposeRace() {
    if (this.race) { this.race.dispose(); this.race = null; }
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  }

  togglePause() {
    if (!this.race) return;
    this.paused = !this.paused;
    this.race.setPaused(this.paused);
    if (this.paused) this.ui.pause(); else this.ui.hide();
  }

  // ------------------------------------------------------------ Profile
  save() { saveProfile(this.profile); }
  resetProfile() { this.profile = resetProfile(); this.setup = null; this._refreshIdleCars(); }
  buyCar(id) { const ok = buyCar(this.profile, id); if (ok) this._refreshIdleCars(); return ok; }
  buyUpgrade(carId, upId) { return buyUpgrade(this.profile, carId, upId); }
  restartSeries(id) { restartSeries(this.profile, id); }

  toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }
}

window.app = new App();
