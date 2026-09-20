// Keyboard + gamepad + touch input. Two keyboard schemes so two players can share a keyboard.

export const SCHEMES = {
  wasd: { name: 'WASD', up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], hb: ['ShiftLeft', 'Space'], reset: ['KeyR'] },
  arrows: { name: 'Arrow keys', up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], hb: ['ShiftRight', 'ControlRight', 'Slash'], reset: ['Period'] },
};

/** Fixed control options. Gamepads are added dynamically from `connectedPads()`. */
const BASE_CONTROLS = [
  { id: 'wasd', name: 'Keyboard · WASD', scheme: 'wasd', pad: -1, keys: 'W A S D · Shift' },
  { id: 'arrows', name: 'Keyboard · Arrows', scheme: 'arrows', pad: -1, keys: '↑ ← ↓ → · R-Shift' },
  { id: 'touch', name: 'Touch', scheme: 'none', pad: -1, keys: 'On-screen buttons', touchOnly: true },
];

/** Tidy a gamepad id like "Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)". */
function padLabel(gp) {
  let name = (gp.id || 'Gamepad').replace(/\(.*?\)/g, '').replace(/vendor:.*$/i, '').replace(/\s+/g, ' ').trim();
  if (!name || /^[0-9a-f-]+$/i.test(name)) name = 'Gamepad';
  if (name.length > 28) name = name.slice(0, 26) + '…';
  return name;
}

/** Raw diagnostics for the settings screen. */
export function gamepadDiagnostics() {
  const out = { supported: typeof navigator.getGamepads === 'function', secure: window.isSecureContext, focused: document.hasFocus(), pads: [] };
  if (!out.supported) return out;
  try {
    const pads = navigator.getGamepads() || [];
    for (let i = 0; i < pads.length; i++) {
      const gp = pads[i];
      if (!gp) { out.pads.push(null); continue; }
      out.pads.push({ index: gp.index, id: gp.id, connected: gp.connected, mapping: gp.mapping, axes: Array.from(gp.axes).map(a => +a.toFixed(2)), buttons: Array.from(gp.buttons).map(b => b.pressed ? 1 : (b.value > 0.1 ? +b.value.toFixed(2) : 0)) });
    }
  } catch (e) { out.error = String(e); }
  return out;
}

/** Currently connected gamepads: [{ index, name }]. */
export function connectedPads() {
  const out = [];
  try {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads || []) if (gp && gp.connected !== false) out.push({ index: gp.index, name: padLabel(gp) });
  } catch (e) { /* no gamepad API */ }
  return out;
}

/** All selectable controls right now (keyboard, touch, one entry per connected gamepad). */
export function listControls() {
  const pads = connectedPads().map(p => ({ id: `pad${p.index}`, name: `🎮 ${p.name}`, sub: `#${p.index + 1}`, scheme: 'none', pad: p.index, keys: 'Stick · RT/LT · B' }));
  return [...BASE_CONTROLS.slice(0, 2), ...pads, BASE_CONTROLS[2]];
}

export function getControl(id) {
  const m = /^pad(\d+)$/.exec(id || '');
  if (m) return { id, name: `Gamepad ${+m[1] + 1}`, scheme: 'none', pad: +m[1], keys: 'Stick · RT/LT · B' };
  return BASE_CONTROLS.find(c => c.id === id) || BASE_CONTROLS[0];
}
export function padConnected(i) { return connectedPads().some(p => p.index === i); }

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    this.padPressed = new Map();
    const announce = () => window.dispatchEvent(new CustomEvent('controls-changed', { detail: connectedPads() }));
    window.addEventListener('gamepadconnected', (e) => { console.info('[gamepad] connected:', e.gamepad && e.gamepad.id, 'index', e.gamepad && e.gamepad.index); announce(); });
    window.addEventListener('gamepaddisconnected', (e) => { console.info('[gamepad] disconnected:', e.gamepad && e.gamepad.id); announce(); });
    // Some browsers only surface a pad after its first button press; poll lightly as a fallback.
    this._padSig = '';
    setInterval(() => {
      const sig = connectedPads().map(p => p.index + ':' + p.name).join('|');
      if (sig !== this._padSig) { this._padSig = sig; announce(); }
    }, 1500);
    this.touch = { throttle: 0, brake: 0, steer: 0, handbrake: false, reset: false, pause: false };
    this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    this._buildTouch();
  }

  /** Call once per frame after consuming. */
  endFrame() { this.pressed.clear(); this.touch.reset = false; this.touch.pause = false; }

  justPressed(code) { return this.pressed.has(code); }
  down(code) { return this.keys.has(code); }
  anyDown(codes) { return codes.some(c => this.keys.has(c)); }

  gamepad(i) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    return pads && pads[i] ? pads[i] : null;
  }

  /** Read a player's controls. Touch controls are merged into player 0. */
  read(schemeId, padIndex, playerIndex = 0) {
    const s = SCHEMES[schemeId] || null;
    const out = { throttle: 0, brake: 0, steer: 0, handbrake: false, reset: false, pause: false };
    if (s) {
      if (this.anyDown(s.up)) out.throttle = 1;
      if (this.anyDown(s.down)) out.brake = 1;
      if (this.anyDown(s.left)) out.steer -= 1;
      if (this.anyDown(s.right)) out.steer += 1;
      out.handbrake = this.anyDown(s.hb);
      out.reset = s.reset.some(c => this.pressed.has(c));
    }

    const pad = padIndex >= 0 ? this.gamepad(padIndex) : null;
    if (pad) {
      const ax = pad.axes[0] || 0;
      if (Math.abs(ax) > 0.12) out.steer = Math.abs(ax) > Math.abs(out.steer) ? ax : out.steer;
      const rt = pad.buttons[7] ? pad.buttons[7].value : 0;
      const lt = pad.buttons[6] ? pad.buttons[6].value : 0;
      out.throttle = Math.max(out.throttle, rt, pad.buttons[0]?.pressed ? 1 : 0);
      out.brake = Math.max(out.brake, lt, pad.buttons[2]?.pressed ? 1 : 0);
      out.handbrake = out.handbrake || !!pad.buttons[1]?.pressed || !!pad.buttons[5]?.pressed;
      const start = !!pad.buttons[9]?.pressed;
      const key = `${padIndex}:start`;
      if (start && !this.padPressed.get(key)) out.pause = true;
      this.padPressed.set(key, start);
      const y = !!pad.buttons[3]?.pressed;
      const keyY = `${padIndex}:y`;
      if (y && !this.padPressed.get(keyY)) out.reset = true;
      this.padPressed.set(keyY, y);
    }

    if (playerIndex === 0 && this.touchVisible) {
      const t = this.touch;
      out.throttle = Math.max(out.throttle, t.throttle);
      out.brake = Math.max(out.brake, t.brake);
      if (t.steer !== 0) out.steer = t.steer;
      out.handbrake = out.handbrake || t.handbrake;
      out.reset = out.reset || t.reset;
      out.pause = out.pause || t.pause;
    }
    return out;
  }

  // ---------------------------------------------------------------- Touch
  _buildTouch() {
    const el = document.createElement('div');
    el.id = 'touch-controls';
    el.className = 'hidden';
    el.innerHTML = `
      <div class="tc-group left">
        <button class="tc" data-tc="left">◀</button>
        <button class="tc" data-tc="right">▶</button>
      </div>
      <div class="tc-group right">
        <button class="tc small" data-tc="handbrake">DRIFT</button>
        <button class="tc" data-tc="brake">BRAKE</button>
        <button class="tc gas" data-tc="throttle">GAS</button>
      </div>
      <div class="tc-group top">
        <button class="tc tiny" data-tc="reset">↺</button>
        <button class="tc tiny" data-tc="pause">❚❚</button>
      </div>`;
    document.body.appendChild(el);
    this.touchEl = el;
    this.touchVisible = false;
    const held = new Set();
    const apply = () => {
      const t = this.touch;
      t.throttle = held.has('throttle') ? 1 : 0;
      t.brake = held.has('brake') ? 1 : 0;
      t.steer = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
      t.handbrake = held.has('handbrake');
    };
    el.querySelectorAll('[data-tc]').forEach((b) => {
      const id = b.dataset.tc;
      const down = (e) => { e.preventDefault(); if (id === 'reset') this.touch.reset = true; else if (id === 'pause') this.touch.pause = true; else { held.add(id); b.classList.add('on'); apply(); } };
      const up = (e) => { e.preventDefault(); held.delete(id); b.classList.remove('on'); apply(); };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  setTouchVisible(on) {
    this.touchVisible = on && this.isTouchDevice;
    this.touchEl.classList.toggle('hidden', !this.touchVisible);
    if (!on) { this.touch.throttle = 0; this.touch.brake = 0; this.touch.steer = 0; this.touch.handbrake = false; }
  }
}
