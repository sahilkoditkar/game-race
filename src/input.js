// Keyboard + gamepad input. Two keyboard schemes so two players can share a keyboard.

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
  }

  /** Call once per frame after consuming. */
  endFrame() { this.pressed.clear(); }

  justPressed(code) { return this.pressed.has(code); }
  down(code) { return this.keys.has(code); }

  anyDown(codes) { return codes.some(c => this.keys.has(c)); }

  gamepad(i) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    return pads && pads[i] ? pads[i] : null;
  }

  /** Read a player's controls. */
  read(schemeId, padIndex) {
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
    return out;
  }
}
