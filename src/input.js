// Keyboard + gamepad + touch input. Two keyboard schemes so two players can share a keyboard.

export const SCHEMES = {
  wasd: { name: 'WASD', up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], hb: ['ShiftLeft', 'Space'], reset: ['KeyR'] },
  arrows: { name: 'Arrow keys', up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], hb: ['ShiftRight', 'ControlRight', 'Slash'], reset: ['Period'] },
};

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
    const s = SCHEMES[schemeId] || SCHEMES.wasd;
    const out = { throttle: 0, brake: 0, steer: 0, handbrake: false, reset: false, pause: false };
    if (this.anyDown(s.up)) out.throttle = 1;
    if (this.anyDown(s.down)) out.brake = 1;
    if (this.anyDown(s.left)) out.steer -= 1;
    if (this.anyDown(s.right)) out.steer += 1;
    out.handbrake = this.anyDown(s.hb);
    out.reset = s.reset.some(c => this.pressed.has(c));

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
