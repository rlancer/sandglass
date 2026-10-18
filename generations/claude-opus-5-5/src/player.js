import {
  TW, RUN_SPEED, WALK_SPEED, RUN_JUMP_VX, RUN_JUMP_VY, STAND_JUMP_VX, STAND_JUMP_VY,
  FALL_SAFE, FALL_HURT, PLAYER_H, CROUCH_H, surfaceY,
} from "./config.js";
import { Actor, rowOf, colOf } from "./actor.js";
import { sfx } from "./audio.js";
import { particles } from "./particles.js";
import { ANIMS, sampleKeys } from "./skeleton.js";

const GROUND = new Set(["stand", "run", "walk", "skid", "crouch"]);
const HANG_DROP = 70; // feet below the ledge surface while hanging
const HANG_BACK = 9; // body distance out from the ledge corner while hanging
// Feet relative to the ledge corner [towards ledge, below surface], one key per climb frame.
const CLIMB_PATH = [[-HANG_BACK, HANG_DROP], [-7, 48], [-1, 25], [10, 0], [14, 0]];

export class Player extends Actor {
  constructor(world, x, y, game) {
    super(world, x, y);
    this.game = game;
    this.hp = 3;
    this.maxHp = 3;
    this.armed = false;
    this.hasShard = false;
    this.ledge = null;
    this.alpha = 1;
    this.deadT = 0;
    this.deathCause = "";
    this.god = false;
  }

  get grounded() {
    return GROUND.has(this.state);
  }

  get swordOut() {
    return this.armed && ["fight", "strike", "parry", "recoil", "hurt"].includes(this.state);
  }

  snapshot() {
    return {
      x: this.x, y: this.y, facing: this.facing, anim: this.anim, animT: this.animT,
      sword: this.swordOut, ground: this.onGround && this.grounded, grip: this.gripInfo(),
    };
  }

  // Ledge corner the hands are pinned to, with blend weight (released mid-mantle).
  gripInfo() {
    const l = this.ledge;
    if (!l) return null;
    let w;
    if (this.state === "hang" || this.state === "jumpUp") w = 1;
    else if (this.state === "climb" || this.state === "climbDown") w = Math.max(0, Math.min(1, (0.64 - this.animT) / 0.08));
    else return null;
    return { x: l.X, y: l.surf, w };
  }

  restoreFrom(f) {
    this.x = f.x;
    this.y = f.y;
    this.facing = f.facing;
    this.vx = 0;
    this.vy = 0;
    this.onGround = true;
    this.h = PLAYER_H;
    this.setState("stand");
  }

  isParrying() {
    return this.state === "parry" && this.stateT < 0.32;
  }

  damage(n, cause = "wounds") {
    if (!this.alive || this.god) return;
    this.hp -= n;
    this.flash = 0.4;
    this.game.shake(4);
    this.game.redFlash = 0.35;
    if (this.hp <= 0) this.die(cause);
    else sfx.hurt();
  }

  takeHit(n, dir) {
    if (!this.alive) return;
    this.damage(n, "the sword");
    if (this.alive) {
      this.vx = dir * 110;
      this.setState("hurt");
    }
  }

  hitByDebris() {
    if (!this.alive) return;
    this.damage(1, "falling stone");
    if (this.alive) this.setState("crouch", "land");
  }

  recoil() {
    this.vx = -this.facing * 60;
    this.setState("recoil", "parry");
  }

  die(cause) {
    if (!this.alive) return;
    if (this.god) return;
    this.alive = false;
    this.hp = 0;
    this.deathCause = cause;
    this.vx = 0;
    this.setState("dead");
    sfx.death();
    this.game.onPlayerDeath();
  }

  // ---------- ledges ----------
  findLedgeAbove() {
    const w = this.world;
    const r = this.row();
    const xs = new Set([Math.floor(this.x / TW) * TW, Math.ceil(this.x / TW) * TW]);
    for (const f of [this.facing, -this.facing]) {
      for (const X of xs) {
        const rel = (X - this.x) * f;
        if (rel < -12 || rel > 60) continue;
        const c2 = f > 0 ? X / TW : X / TW - 1;
        const c1 = c2 - f;
        if (w.surfaceAt(c2, r - 1) && !w.isWall(c2, r - 1) && !w.surfaceAt(c1, r - 1) && !w.isWall(c1, r - 1)) {
          return { X, surf: surfaceY(r - 1), facing: f, c: c2, r: r - 1 };
        }
      }
    }
    return null;
  }

  findGrabWhileFalling(prevHand, hand) {
    const w = this.world;
    for (let r = rowOf(prevHand) - 1; r <= rowOf(hand) + 1; r++) {
      const s = surfaceY(r);
      if (!(prevHand <= s && hand > s)) continue;
      const f = this.facing;
      const base = Math.floor(this.x / TW);
      for (let c = base - 1; c <= base + 2; c++) {
        const X = c * TW;
        const rel = (X - this.x) * f;
        if (rel < -14 || rel > 38) continue;
        const c2 = f > 0 ? c : c - 1;
        const c1 = c2 - f;
        if (w.surfaceAt(c2, r) && !w.isWall(c2, r) && !w.surfaceAt(c1, r) && !w.isWall(c1, r) && !w.isWall(c1, r + 1)) {
          return { X, surf: s, facing: f, c: c2, r };
        }
      }
    }
    return null;
  }

  findEdgeBelow() {
    const w = this.world;
    const sc = this.standCell();
    if (!sc) return null;
    const r = sc.r;
    for (const d of [this.facing, -this.facing]) {
      const X = d > 0 ? (sc.c + 1) * TW : sc.c * TW;
      const dist = (X - this.x) * d;
      if (dist > 26) continue;
      const nc = sc.c + d;
      if (!w.surfaceAt(nc, r) && !w.isWall(nc, r)) return { X, surf: surfaceY(r), facing: -d, c: sc.c, r };
    }
    return null;
  }

  hangPos(l) {
    return { x: l.X - l.facing * HANG_BACK, y: l.surf + HANG_DROP };
  }

  // ---------- main update ----------
  update(dt, inp) {
    this.stateT += dt;
    this.flash = Math.max(0, this.flash - dt);
    const d = (inp.held("right") ? 1 : 0) - (inp.held("left") ? 1 : 0);
    const w = this.world;

    switch (this.state) {
      case "stand": case "run": case "walk": case "skid": case "crouch":
        this.groundUpdate(dt, inp, d);
        break;
      case "jumpPrep": {
        this.vx *= 0.8;
        this.physics(dt);
        if (this.stateT > 0.14) {
          this.vx = this.facing * STAND_JUMP_VX;
          this.vy = STAND_JUMP_VY;
          this.fallStartY = this.y;
          this.setState("jump");
          sfx.jump();
        }
        break;
      }
      case "jump": case "fall": case "hop":
        this.airUpdate(dt, inp);
        break;
      case "jumpUp": {
        const l = this.ledge;
        const t = Math.min(1, this.stateT / 0.32);
        const e = 1 - (1 - t) * (1 - t);
        const hp = this.hangPos(l);
        this.x += (hp.x - this.x) * Math.min(1, dt * 18);
        this.y = this.ledge.startY + (hp.y - this.ledge.startY) * e;
        if (t >= 1) {
          this.x = hp.x;
          this.setState("hang");
          sfx.grab();
        }
        break;
      }
      case "hang": {
        const l = this.ledge;
        const hp = this.hangPos(l);
        this.x = hp.x;
        this.y = hp.y;
        this.onGround = false;
        if (w.cell(l.c, l.r).t === "loose") w.triggerLoose(l.c, l.r);
        if (!w.surfaceAt(l.c, l.r)) {
          this.drop();
          break;
        }
        if (inp.held("up") && this.stateT > 0.18) {
          this.setState("climb");
          this.climbFrom = { x: this.x, y: this.y };
        } else if (inp.pressed("down") || (inp.held("down") && this.stateT > 0.3)) {
          this.drop();
        }
        break;
      }
      case "climb": case "climbDown": {
        const l = this.ledge;
        const dur = this.state === "climb" ? 0.85 : 0.7;
        let p = Math.min(1, this.stateT / dur);
        const end = CLIMB_PATH[CLIMB_PATH.length - 1];
        const top = { x: l.X + l.facing * end[0], y: l.surf + end[1] };
        const q = this.state === "climb" ? p : 1 - p;
        const [ox, oy] = sampleKeys(CLIMB_PATH, q);
        this.x = l.X + l.facing * ox;
        this.y = l.surf + oy;
        this.animT = q;
        this.anim = "climb";
        if (p >= 1) {
          if (this.state === "climb") {
            this.x = top.x;
            this.y = top.y;
            this.vx = this.vy = 0;
            this.onGround = true;
            this.setState("stand");
            this.physics(dt);
          } else {
            this.setState("hang");
          }
        }
        break;
      }
      case "land": {
        this.vx *= Math.pow(0.0005, dt);
        this.physics(dt);
        const dur = this.landDur || 0.25;
        this.animT = this.stateT / dur;
        if (this.stateT > dur) this.setState("stand");
        break;
      }
      case "fight":
        this.fightUpdate(dt, inp, d);
        break;
      case "strike": {
        const prev = this.stateT - dt;
        this.animT = this.stateT / 0.48;
        this.vx = this.stateT > 0.14 && this.stateT < 0.26 ? this.facing * 70 : 0;
        if (prev < 0.15 && this.stateT >= 0.15) this.game.resolveStrike(this, this.game.target(this));
        if (prev < 0.1 && this.stateT >= 0.1) sfx.swish();
        this.physics(dt);
        if (this.stateT > 0.48) this.setState("fight");
        break;
      }
      case "parry":
        this.vx = 0;
        this.physics(dt);
        if (this.stateT > 0.38) this.setState("fight");
        break;
      case "recoil": case "hurt":
        this.vx *= Math.pow(0.002, dt);
        this.physics(dt);
        if (this.stateT > 0.35) this.setState(this.armed ? "fight" : "stand");
        break;
      case "drink": case "pickup": {
        const dur = this.state === "drink" ? 1.3 : 1.1;
        this.animT = this.stateT / dur;
        if (!this.itemUsed && this.stateT > dur * 0.55) {
          this.itemUsed = true;
          this.game.useItem(this, this.itemCell);
        }
        if (this.stateT > dur && this.alive) this.setState("stand");
        break;
      }
      case "exit": {
        this.alpha = Math.max(0, 1 - this.stateT / 1.2);
        this.x += (this.exitX - this.x) * Math.min(1, dt * 4);
        this.animT += dt * 1.5;
        if (this.stateT > 1.4) this.game.levelComplete();
        break;
      }
      case "dead":
        this.deadT += dt;
        this.animT = Math.min(1, this.stateT / 0.7);
        this.vx *= Math.pow(0.01, dt);
        this.physics(dt);
        break;
      case "rewind": case "victory":
        break;
    }

    if (this.alive) this.hazards();
    if (this.state !== "climb" && this.state !== "climbDown" && this.state !== "drink" && this.state !== "pickup" && this.state !== "land" && this.state !== "dead" && this.state !== "strike") {
      const a = this.anim;
      if (a === "run") this.animT += (Math.abs(this.vx) * dt) / 82;
      else if (a === "walk") this.animT += (Math.abs(this.vx) * dt) / 48;
      else if (a === "fightStep") this.animT += dt / 0.4;
      else if (a === "jump") this.animT = Math.min(1, this.animT + dt / 0.5);
      else if (a === "jumpPrep") this.animT = this.stateT / 0.14;
      else this.animT += dt / (ANIMS[a]?.dur || 1.2);
    }
    if (this.onGround && this.alive) {
      const sc = this.standCell();
      if (sc && sc.kind !== "wall") w.stepOn(sc.c, sc.r);
    }
  }

  physics(dt) {
    const res = this.move(dt);
    if (res.head) this.bumpHead(res.head);
    return res;
  }

  bumpHead(s) {
    const w = this.world;
    if (s.kind === "loose") w.triggerLoose(s.c, s.r);
    sfx.land(0);
    particles.dust(this.x, this.y - this.h, 4);
  }

  drop() {
    const l = this.ledge;
    this.x = l.X - l.facing * 10;
    this.vx = 0;
    this.vy = 0;
    this.fallStartY = this.y;
    this.setState("fall");
  }

  itemHere() {
    const c = colOf(this.x), r = this.row();
    const cell = this.world.cell(c, r);
    if (cell.item && Math.abs(this.x - (c * TW + TW / 2)) < 24) return { cell, c, r };
    return null;
  }

  groundUpdate(dt, inp, d) {
    const w = this.world;
    this.h = this.state === "crouch" ? CROUCH_H : PLAYER_H;

    if (this.armed && this.game.target(this)) {
      this.setState("fight");
      return;
    }

    const speed = Math.abs(this.vx);
    const upP = inp.pressed("up");
    const upH = inp.held("up");

    if (this.state === "crouch") {
      this.vx = 0;
      this.physics(dt);
      if (!this.onGround) return this.startFall();
      if (!inp.held("down") && this.stateT > 0.15) {
        this.setState("stand");
        this.h = PLAYER_H;
      }
      return;
    }

    // jumps
    if ((upP || upH) && d !== 0 && d === Math.sign(this.vx) && speed > RUN_SPEED * 0.6) {
      this.facing = d;
      this.vx = d * RUN_JUMP_VX;
      this.vy = RUN_JUMP_VY;
      this.fallStartY = this.y;
      this.setState("jump");
      sfx.jump();
      return;
    }
    if ((upP || (upH && this.stateT > 0.2)) && d !== 0 && speed <= RUN_SPEED * 0.6) {
      this.facing = d;
      this.setState("jumpPrep");
      return;
    }
    if (upP && d === 0) {
      const ex = this.game.exitHere(this);
      if (ex) {
        this.exitX = ex.c * TW + TW / 2;
        this.setState("exit", "walk");
        return;
      }
      const l = this.findLedgeAbove();
      if (l) {
        this.facing = l.facing;
        this.ledge = { ...l, startY: this.y };
        this.setState("jumpUp");
        sfx.jump();
        return;
      }
      this.vy = -300;
      this.vx = 0;
      this.fallStartY = this.y;
      this.setState("hop", "jumpUp");
      sfx.jump();
      return;
    }

    if (inp.pressed("down")) {
      const it = this.itemHere();
      if (it && speed < 80) {
        this.itemCell = it;
        this.itemUsed = false;
        this.vx = 0;
        this.setState(it.cell.item === "sword" || it.cell.item === "shard" ? "pickup" : "drink");
        return;
      }
      const e = this.findEdgeBelow();
      if (e && speed < 80) {
        this.ledge = e;
        this.facing = e.facing;
        this.vx = 0;
        this.setState("climbDown");
        return;
      }
      this.setState("crouch");
      return;
    }

    if (d !== 0) {
      if (d !== this.facing) {
        if (speed > 120 && this.state === "run") {
          this.state = "skid";
        } else {
          this.facing = d;
          this.vx *= 0.2;
        }
      }
      if (this.state === "skid") {
        this.vx -= Math.sign(this.vx) * 900 * dt;
        this.setAnim("skid");
        if (Math.abs(this.vx) < 30) {
          this.facing = d;
          this.vx = 0;
          this.state = "run";
        }
      } else {
        const careful = inp.held("shift");
        const target = careful ? WALK_SPEED : RUN_SPEED;
        const acc = careful ? 900 : 1300;
        this.vx += Math.sign(d * target - this.vx) * acc * dt;
        if (Math.abs(this.vx) > target && Math.sign(this.vx) === d) this.vx = d * target;
        this.state = careful ? "walk" : "run";
        this.setAnim(careful ? "walk" : "run");
        if (careful) this.carefulEdge(dt, d);
        if (Math.random() < dt * (careful ? 3 : 7)) sfx.step();
      }
    } else {
      const s = Math.abs(this.vx);
      if (s > 0) {
        const dec = (s > 140 ? 700 : 1400) * dt;
        this.vx = s <= dec ? 0 : this.vx - Math.sign(this.vx) * dec;
      }
      if (this.state === "run" && s > 140) {
        this.state = "skid";
        this.setAnim("skid");
      } else if (this.vx === 0 || this.state !== "skid") {
        this.state = "stand";
        this.setAnim("stand");
      }
    }

    const res = this.physics(dt);
    if (res.wall && this.state === "run" && Math.abs(res.wall) > 0 && speed > 150) {
      sfx.land(0);
      this.game.shake(2);
      particles.dust(this.x + this.facing * 8, this.y - 30, 3);
    }
    if (!this.onGround) this.startFall();
  }

  carefulEdge(dt, d) {
    const w = this.world;
    const sc = this.standCell();
    if (!sc) return;
    const nc = sc.c + d;
    const r = sc.r;
    if (!w.surfaceAt(nc, r) && !w.isWall(nc, r)) {
      const X = d > 0 ? (sc.c + 1) * TW : sc.c * TW;
      const limit = X + d * 2;
      if ((this.x + this.vx * dt - limit) * d > 0) {
        this.x = limit - this.vx * dt;
        if ((this.x - limit) * d > 0) this.x = limit;
        this.vx = 0;
        this.state = "stand";
        this.setAnim("stand");
      }
    }
  }

  startFall() {
    this.fallStartY = this.y;
    this.vx *= 0.55;
    this.setState("fall");
  }

  airUpdate(dt, inp) {
    const prevHand = this.y - this.h - 6;
    const res = this.physics(dt);
    if (this.state === "jump" && this.vy > 120) this.setAnim("jump");
    if (this.state !== "fall" && this.vy > 380) this.setState("fall");
    if (this.state === "fall") this.setAnim("fall");

    if (res.landed) return this.land(res.impact);

    const hand = this.y - this.h - 6;
    if ((inp.held("up") || inp.held("shift")) && this.vy > 0) {
      const l = this.findGrabWhileFalling(prevHand, hand);
      if (l) {
        this.ledge = l;
        this.facing = l.facing;
        this.vx = this.vy = 0;
        this.setState("hang");
        sfx.grab();
        return;
      }
    }
    if (this.y > this.world.rows * 128 + 200) this.die("the abyss");
  }

  land(impact) {
    const dist = this.y - this.fallStartY;
    const sc = this.standCell();
    const cell = sc ? this.world.cell(sc.c, sc.r) : null;
    if (cell && cell.t === "spikes" && dist > 30) {
      cell.ext = 1;
      cell.stay = 1;
      return this.die("spikes");
    }
    if (dist > FALL_HURT) {
      sfx.land(1);
      this.game.shake(10);
      particles.dust(this.x, this.y, 16);
      return this.die("the fall");
    }
    if (dist > FALL_SAFE) {
      sfx.land(0.7);
      this.game.shake(6);
      particles.dust(this.x, this.y, 12);
      this.damage(1, "the fall");
      this.vx = 0;
      this.landDur = 0.9;
      this.setState("land");
      return;
    }
    sfx.land(dist > 60 ? 0.3 : 0);
    if (dist > 60) particles.dust(this.x, this.y, 6);
    if (Math.abs(this.vx) > 120) {
      this.vx = Math.sign(this.vx) * RUN_SPEED * 0.85;
      this.setState("run");
      return;
    }
    this.vx = 0;
    this.landDur = dist > 60 ? 0.32 : 0.12;
    this.setState("land");
  }

  fightUpdate(dt, inp, d) {
    const t = this.game.target(this);
    if (!t) {
      this.setState("stand");
      return;
    }
    this.facing = Math.sign(t.x - this.x) || this.facing;
    this.vx = d * 75;
    if (inp.pressed("strike")) {
      this.strikeId = (this.strikeId || 0) + 1;
      this.setState("strike");
      this.vx = 0;
      return;
    }
    if (inp.pressed("up")) {
      this.setState("parry");
      return;
    }
    this.setAnim(d ? "fightStep" : "fight");
    const res = this.physics(dt);
    if (!this.onGround) this.startFall();
  }

  hazards() {
    const w = this.world;
    const sc = this.onGround ? this.standCell() : null;
    if (sc) {
      const cell = w.cell(sc.c, sc.r);
      if (cell.t === "spikes" && cell.ext > 0.6 && Math.abs(this.vx) > 100 && Math.abs(this.x - (sc.c * TW + TW / 2)) < 26) {
        return this.die("spikes");
      }
    }
    for (const k of w.chompers) {
      if (k.cell.jaw < 0.6) continue;
      const bx = k.c * TW + 40;
      const sy = surfaceY(k.r);
      if (Math.abs(this.x - bx) < this.hw + 3 && this.y > sy - 90 && this.y - this.h < sy - 10) {
        sfx.slice();
        particles.sparks(bx, sy - 34, 20);
        return this.die("the blades");
      }
    }
  }
}
