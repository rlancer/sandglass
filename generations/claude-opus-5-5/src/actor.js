import { TW, TH, GRAVITY, MAX_FALL, HALF_W, PLAYER_H, surfaceY } from "./config.js";

const buf = [];
export const rowOf = (y) => Math.floor(y / TH);
export const colOf = (x) => Math.floor(x / TW);

export class Actor {
  constructor(world, x, y) {
    this.world = world;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.hw = HALF_W;
    this.h = PLAYER_H;
    this.onGround = true;
    this.support = [];
    this.alive = true;
    this.state = "stand";
    this.stateT = 0;
    this.anim = "stand";
    this.animT = 0;
    this.fallStartY = y;
    this.hp = 3;
    this.maxHp = 3;
    this.flash = 0;
  }

  setState(s, anim = s) {
    this.state = s;
    this.stateT = 0;
    if (anim) this.setAnim(anim);
  }

  setAnim(a) {
    if (this.anim !== a) {
      this.anim = a;
      this.animT = 0;
    }
  }

  overlaps(s) {
    return this.x + this.hw > s.x0 && this.x - this.hw < s.x1 && this.y > s.y0 && this.y - this.h < s.y1;
  }

  move(dt, gravity = true) {
    const w = this.world;
    const res = { wall: 0, head: null, landed: false, impact: 0 };

    this.x += this.vx * dt;
    w.solidsIn(this.x - this.hw, this.y - this.h, this.x + this.hw, this.y, buf);
    for (const s of buf) {
      if (!this.overlaps(s)) continue;
      const fromLeft = this.vx > 0 || (this.vx === 0 && this.x < (s.x0 + s.x1) / 2);
      // standing on top of / just under a slab is not a horizontal hit
      if (this.y - s.y0 < 3 && this.y - s.y0 > 0) {
        this.y = s.y0;
        continue;
      }
      this.x = fromLeft ? s.x0 - this.hw - 0.01 : s.x1 + this.hw + 0.01;
      res.wall = fromLeft ? 1 : -1;
      res.wallKind = s.kind;
      this.vx = 0;
    }

    const prevY = this.y;
    const was = this.onGround;
    if (gravity) this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
    const impact = this.vy;
    this.y += this.vy * dt;
    this.onGround = false;
    this.support.length = 0;
    w.solidsIn(this.x - this.hw, this.y - this.h, this.x + this.hw, this.y + 1, buf);
    for (const s of buf) {
      if (!this.overlaps(s)) continue;
      if (this.vy >= 0 && prevY <= s.y0 + 0.5) {
        this.y = s.y0;
        this.vy = 0;
        this.onGround = true;
      } else if (this.vy < 0 && prevY - this.h >= s.y1 - 0.5) {
        this.y = s.y1 + this.h;
        this.vy = 0;
        res.head = s;
      }
    }
    if (this.onGround) {
      for (const s of buf) {
        if (Math.abs(s.y0 - this.y) < 0.5 && this.x + this.hw > s.x0 && this.x - this.hw < s.x1 && s.kind !== "gatebar") this.support.push(s);
      }
      if (!was) {
        res.landed = true;
        res.impact = impact;
      }
    }
    return res;
  }

  // The floor cell beneath the actor's center (or the nearest supporting one).
  standCell() {
    if (!this.support.length) return null;
    const c = colOf(this.x);
    const score = (s) => (s.c === c ? 2 : 0) + (s.kind !== "wall" ? 1 : 0);
    let best = this.support[0];
    for (const s of this.support) if (score(s) > score(best)) best = s;
    if (best.kind === "wall") return { c: best.c, r: best.r - 1, kind: "wall" };
    return best;
  }

  row() {
    return rowOf(this.y - 1);
  }

  surface() {
    return surfaceY(this.row());
  }
}
