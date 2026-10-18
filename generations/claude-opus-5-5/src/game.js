import { TW, TH, DT, ECHO_MAX, ECHO_LINGER, surfaceY, ROOM_W, ROOM_H } from "./config.js";
import { World } from "./world.js";
import { Player } from "./player.js";
import { Guard, Princess } from "./guard.js";
import { rowOf, colOf } from "./actor.js";
import { sfx, playMusic } from "./audio.js";
import { particles } from "./particles.js";

const GROUND = new Set(["stand", "run", "walk", "skid", "crouch"]);

export class Game {
  constructor(level, carry, hooks) {
    this.level = level;
    this.hooks = hooks;
    this.world = new World(level);
    const sp = this.world.spawns.player;
    this.player = new Player(this.world, sp.c * TW + TW / 2, surfaceY(sp.r), this);
    if (carry) {
      this.player.maxHp = carry.maxHp;
      this.player.hp = carry.maxHp;
      this.player.armed = carry.armed;
      this.player.hasShard = carry.hasShard;
    }
    this.guards = this.world.spawns.guards.map((g) => new Guard(this.world, g.c * TW + TW / 2, surfaceY(g.r), g.kind, this));
    const pz = this.world.spawns.princess;
    this.princess = pz ? new Princess(pz.c * TW + TW / 2, surfaceY(pz.r)) : null;
    this.echo = { mode: "idle", frames: [], idx: 0, t: 0, frame: null };
    this.shakeAmt = 0;
    this.redFlash = 0;
    this.whiteFlash = 0;
    this.hint = null;
    this.hintT = 0;
    this.seenHints = new Set();
    this.done = false;
    this.time = 0;
    this.fighting = false;
    particles.clear();
  }

  get actors() {
    return [this.player, ...this.guards];
  }

  shake(n) {
    this.shakeAmt = Math.max(this.shakeAmt, n);
  }

  // ---------- combat ----------
  target(p) {
    if (!p.armed || !p.alive) return null;
    let best = null, bd = Infinity;
    for (const g of this.guards) {
      if (!g.alive) continue;
      const dx = Math.abs(g.x - p.x);
      if (Math.abs(g.y - p.y) < 14 && dx < 120 && dx < bd) {
        best = g;
        bd = dx;
      }
    }
    return best;
  }

  resolveStrike(att, def) {
    if (!def || !def.alive || !att.alive) return;
    const dist = (def.x - att.x) * att.facing;
    if (dist < -4 || dist > 54 || Math.abs(def.y - att.y) > 14) return;
    const mx = (att.x + def.x) / 2, my = att.y - 44;
    const defArmed = def === this.player ? def.armed : true;
    if (defArmed && def.isParrying()) {
      sfx.clang();
      particles.sparks(mx, my, 18, -att.facing);
      this.whiteFlash = 0.12;
      att.recoil();
      return;
    }
    sfx.hit();
    particles.sparks(mx + att.facing * 8, my + 6, 10, att.facing);
    this.shake(3);
    def.takeHit(1, att.facing);
  }

  wraithCount() {
    return this.guards.filter((g) => g.alive && g.cfg.wraith).length;
  }

  summonWraith(boss) {
    const p = this.player;
    const side = p.x < boss.x ? -1 : 1;
    let x = p.x + side * 56;
    const c = colOf(x), r = p.row();
    if (!this.world.surfaceAt(c, r) || this.world.isWall(c, r)) x = boss.x - side * 40;
    const w = new Guard(this.world, x, p.y, "wraith", this);
    w.facing = -side;
    w.cooldown = 1.2;
    this.guards.push(w);
    particles.burst(x, p.y - 32, "rgba(190,110,255,A)", 50);
    this.whiteFlash = 0.15;
  }

  onGuardDeath(g) {
    if (g.cfg.boss) {
      this.world.bossDead = true;
      this.whiteFlash = 0.6;
      this.shake(8);
      for (const o of this.guards) if (o.cfg.wraith && o.alive) o.die();
      this.showHint("Jaffar falls. His stolen hours pour back into the world.", 5);
      sfx.fanfare();
    }
  }

  onPlayerDeath() {
    if (this.echo.mode === "rec") this.echo.mode = "idle";
  }

  // ---------- items / exits ----------
  useItem(p, it) {
    const kind = it.cell.item;
    it.cell.item = null;
    const x = it.c * TW + TW / 2, y = surfaceY(it.r);
    switch (kind) {
      case "red":
        p.hp = Math.min(p.maxHp, p.hp + 1);
        sfx.gulp();
        sfx.potion(true);
        particles.burst(x, y - 30, "rgba(255,80,80,A)", 24);
        break;
      case "life":
        p.maxHp += 1;
        p.hp = p.maxHp;
        sfx.gulp();
        sfx.fanfare();
        particles.burst(x, y - 30, "rgba(120,255,140,A)", 50);
        this.showHint("Your life is extended.", 3);
        break;
      case "poison":
        sfx.gulp();
        sfx.potion(false);
        particles.burst(x, y - 30, "rgba(80,120,255,A)", 24);
        p.damage(1, "poison");
        break;
      case "sword":
        p.armed = true;
        sfx.pickup();
        particles.burst(x, y - 30, "rgba(255,230,160,A)", 40);
        this.showHint("The scimitar is yours. Guards will now face you.", 4);
        break;
      case "shard":
        p.hasShard = true;
        sfx.pickup();
        this.whiteFlash = 0.4;
        particles.burst(x, y - 30, "rgba(90,230,255,A)", 70);
        this.showHint("The Mirror Shard binds your shadow to you.  Press E.", 5);
        break;
    }
  }

  exitHere(p) {
    const c = colOf(p.x), r = p.row();
    const cell = this.world.cell(c, r);
    if (cell.t === "exit" && cell.open > 0.85 && Math.abs(p.x - (c * TW + TW / 2)) < 26) return { c, r };
    return null;
  }

  levelComplete() {
    if (this.done) return;
    this.done = true;
    sfx.fanfare();
    this.hooks.levelComplete(this.carry());
  }

  carry() {
    return { maxHp: this.player.maxHp, armed: this.player.armed, hasShard: this.player.hasShard };
  }

  showHint(text, dur = 4) {
    this.hint = text;
    this.hintT = dur;
  }

  // ---------- echo ----------
  echoPressed() {
    const e = this.echo, p = this.player;
    if (!p.hasShard || !p.alive) return;
    if (e.mode === "rec") return this.echoStop();
    if (e.mode === "rewind") return;
    if (!GROUND.has(p.state) || !p.onGround) return;
    if (e.mode === "play" || e.mode === "linger") this.dismissShadow();
    e.mode = "rec";
    e.frames = [p.snapshot()];
    sfx.echoStart();
    particles.shade(p.x, p.y, 20);
  }

  echoStop() {
    const e = this.echo;
    if (e.frames.length < 20) {
      e.mode = "idle";
      return;
    }
    e.mode = "rewind";
    e.idx = e.frames.length - 1;
    e.rate = Math.max(2, e.frames.length / 90);
    this.player.setState("rewind", null);
    sfx.rewind();
  }

  dismissShadow() {
    const f = this.echo.frame;
    if (f) particles.burst(f.x, f.y - 32, "rgba(90,230,255,A)", 30);
    sfx.shadowFade();
    this.echo.mode = "idle";
    this.echo.frame = null;
  }

  updateEcho(dt) {
    const e = this.echo, p = this.player;
    switch (e.mode) {
      case "rec":
        e.frames.push(p.snapshot());
        if (e.frames.length >= ECHO_MAX / DT) this.echoStop();
        break;
      case "rewind": {
        e.idx -= e.rate;
        const f = e.frames[Math.max(0, Math.floor(e.idx))];
        e.rewindFrame = f;
        p.x = f.x;
        p.y = f.y;
        p.facing = f.facing;
        if (Math.random() < 0.8) particles.sand(f.x, f.y, 2);
        if (e.idx <= 0) {
          p.restoreFrom(e.frames[0]);
          e.mode = "play";
          e.idx = 0;
          e.rewindFrame = null;
          this.whiteFlash = 0.2;
        }
        break;
      }
      case "play":
        e.frame = e.frames[e.idx++];
        if (e.idx >= e.frames.length) {
          e.mode = "linger";
          e.t = ECHO_LINGER;
        }
        break;
      case "linger":
        e.t -= dt;
        if (e.t <= 0) this.dismissShadow();
        break;
    }
    if ((e.mode === "play" || e.mode === "linger") && e.frame) {
      const f = e.frame;
      if (f.ground) {
        const c = colOf(f.x), r = rowOf(f.y - 1);
        const cell = this.world.cell(c, r);
        if (this.world.hasFloor(c, r)) this.world.stepOn(c, r);
        else {
          // shadow straddling an edge: weigh the neighbour it is touching
          for (const cc of [colOf(f.x - 7), colOf(f.x + 7)]) if (this.world.hasFloor(cc, r)) this.world.stepOn(cc, r);
        }
        void cell;
      }
      if (Math.random() < 0.35) particles.shade(f.x, f.y, 1);
    }
  }

  // ---------- loop ----------
  update(dt, inp) {
    this.time += dt;
    const p = this.player;
    if (inp.pressed("echo")) this.echoPressed();

    p.update(dt, inp);
    for (const g of this.guards) g.update(dt, p);
    this.updateEcho(dt);
    this.princess?.update(dt);
    const room = this.world.roomOf(p.x, p.y - 30);
    this.world.update(dt, this.actors, room);
    particles.update(dt);

    // hints
    if (p.alive) {
      const c = colOf(p.x), r = p.row();
      for (const h of this.level.hints || []) {
        const key = `${h.c},${h.r}`;
        if (h.c === c && h.r === r && !this.seenHints.has(key)) {
          this.seenHints.add(key);
          this.showHint(h.text, 5);
        }
      }
    }
    this.hintT -= dt;

    // reunion
    if (this.princess && p.alive && !this.done && Math.abs(p.x - this.princess.x) < 28 && Math.abs(p.y - this.princess.y) < 10) {
      this.done = true;
      p.setState("victory", "embrace");
      p.facing = Math.sign(this.princess.x - p.x) || 1;
      this.princess.facing = -p.facing;
      this.princess.anim = "embrace";
      sfx.fanfare();
      particles.burst(p.x, p.y - 40, "rgba(255,200,120,A)", 80);
      setTimeout(() => this.hooks.victory(), 2500);
    }

    // music follows the danger
    const fighting = this.guards.some((g) => g.alive && g.state !== "stand" && Math.abs(g.x - p.x) < 200 && Math.abs(g.y - p.y) < 20);
    if (fighting !== this.fighting) {
      this.fighting = fighting;
      playMusic(fighting ? "fight" : "game");
    }

    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 30);
    this.redFlash = Math.max(0, this.redFlash - dt);
    this.whiteFlash = Math.max(0, this.whiteFlash - dt);
  }

  camera() {
    const p = this.player;
    const f = this.echo.rewindFrame;
    const x = f ? f.x : p.x;
    const y = f ? f.y : p.y;
    const yy = p.state === "hang" || p.state === "climb" ? y - 70 : y - 30;
    return this.world.roomOf(x, yy);
  }
}
