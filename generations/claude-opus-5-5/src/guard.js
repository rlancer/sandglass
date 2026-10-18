import { TW, FALL_HURT, surfaceY } from "./config.js";
import { Actor, colOf } from "./actor.js";
import { ANIMS } from "./skeleton.js";
import { sfx } from "./audio.js";
import { particles } from "./particles.js";

export const GUARD_KINDS = {
  jailer: { hp: 3, skill: 0.2, aggression: 0.7, speed: 50, style: "jailer" },
  shade: { hp: 3, skill: 0.35, aggression: 0.9, speed: 55, style: "shade" },
  palace: { hp: 4, skill: 0.45, aggression: 1.0, speed: 60, style: "palace" },
  jaffar: { hp: 7, skill: 0.6, aggression: 1.25, speed: 65, style: "jaffar", boss: true },
  wraith: { hp: 1, skill: 0.1, aggression: 1.3, speed: 70, style: "prince", wraith: true },
};

const rand = (a, b) => a + Math.random() * (b - a);

export class Guard extends Actor {
  constructor(world, x, y, kind, game) {
    super(world, x, y);
    this.game = game;
    this.kind = kind;
    this.cfg = GUARD_KINDS[kind];
    this.hp = this.maxHp = this.cfg.hp;
    this.facing = -1;
    this.cooldown = rand(0.8, 1.5);
    this.reactedTo = null;
    this.summonT = 6;
    this.alpha = 1;
    this.deadT = 0;
    this.home = x;
    this.reach = 50;
  }

  isParrying() {
    return this.state === "parry" && this.stateT < 0.32;
  }

  takeHit(n, dir) {
    if (!this.alive) return;
    this.hp -= n;
    this.flash = 0.3;
    this.vx = dir * 130;
    if (this.hp <= 0) return this.die();
    this.setState("hurt");
    sfx.hurt();
  }

  hitByDebris() {
    this.hp -= 1;
    if (this.hp <= 0) this.die();
  }

  recoil() {
    this.vx = -this.facing * 60;
    this.setState("recoil", "parry");
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    this.setState("dead");
    if (this.cfg.wraith) {
      particles.burst(this.x, this.y - 32, "rgba(190,110,255,A)", 40);
      sfx.shadowFade();
    }
    this.game.onGuardDeath(this);
  }

  engaged(p) {
    return p.alive && p.state !== "rewind" && Math.abs(p.y - this.y) < 14 && Math.abs(p.x - this.x) < 170;
  }

  safeAhead(dir) {
    const w = this.world;
    const sc = this.standCell();
    if (!sc) return true;
    const edge = dir > 0 ? (sc.c + 1) * TW : sc.c * TW;
    if (Math.abs(edge - this.x) > 22) return true;
    const nc = sc.c + dir;
    return w.surfaceAt(nc, sc.r) && !w.isWall(nc, sc.r) && w.cell(nc, sc.r).t !== "spikes";
  }

  update(dt, player) {
    this.stateT += dt;
    this.flash = Math.max(0, this.flash - dt);
    const a = this.anim;

    if (!this.alive) {
      this.deadT += dt;
      this.animT = Math.min(1, this.stateT / 0.7);
      this.vx *= Math.pow(0.01, dt);
      this.move(dt);
      if (this.cfg.wraith) this.alpha = Math.max(0, 1 - this.deadT * 2);
      return;
    }

    const dx = player.x - this.x;
    const eng = this.engaged(player);

    switch (this.state) {
      case "stand": {
        this.vx = 0;
        this.setAnim(eng ? "fight" : "stand");
        if (eng) {
          this.facing = Math.sign(dx) || this.facing;
          this.setState("fight");
        }
        break;
      }
      case "fight": {
        if (!eng) {
          this.setState("stand");
          break;
        }
        this.facing = Math.sign(dx) || this.facing;
        const dist = Math.abs(dx);
        let mv = 0;
        if (dist > 44) mv = 1;
        else if (dist < 28) mv = -1;
        if (mv && !this.safeAhead(this.facing * mv)) mv = 0;
        this.vx = this.facing * mv * this.cfg.speed;
        this.setAnim(mv ? "fightStep" : "fight");

        // react to the prince's swing
        if (player.state === "strike" && player.stateT < 0.12 && this.reactedTo !== player.strikeId) {
          this.reactedTo = player.strikeId;
          if (Math.random() < this.cfg.skill && dist < 70) {
            this.setState("parry");
            break;
          }
        }
        this.cooldown -= dt * this.cfg.aggression;
        if (this.cooldown <= 0 && dist < 56) {
          this.cooldown = rand(0.7, 1.6);
          this.vx = 0;
          this.setState("strike");
          break;
        }
        if (this.cfg.boss && this.hp <= 5) {
          this.summonT -= dt;
          if (this.summonT <= 0 && this.game.wraithCount() === 0) {
            this.summonT = 9;
            this.setState("cast");
            sfx.summon();
          }
        }
        break;
      }
      case "strike": {
        const prev = this.stateT - dt;
        this.animT = this.stateT / 0.55;
        this.vx = this.stateT > 0.18 && this.stateT < 0.3 ? this.facing * 60 : 0;
        if (prev < 0.12 && this.stateT >= 0.12) sfx.swish();
        if (prev < 0.2 && this.stateT >= 0.2) this.game.resolveStrike(this, player);
        if (this.stateT > 0.55) this.setState("fight");
        break;
      }
      case "parry":
        this.vx = 0;
        if (this.stateT > 0.4) {
          this.setState("fight");
          // riposte
          if (Math.random() < this.cfg.skill) this.cooldown = 0.05;
        }
        break;
      case "recoil": case "hurt":
        this.vx *= Math.pow(0.002, dt);
        if (this.stateT > 0.4) this.setState("fight");
        break;
      case "cast":
        this.vx = 0;
        particles.burst(this.x + this.facing * 10, this.y - 50, "rgba(200,120,255,A)", 2);
        if (this.stateT > 1.0) {
          this.game.summonWraith(this);
          this.setState("fight");
        }
        break;
      case "fall":
        this.setAnim("fall");
        break;
    }

    const res = this.move(dt);
    if (!this.onGround && this.state !== "fall" && this.vy > 60) {
      this.fallStartY = this.y - this.vy * dt;
      this.setState("fall");
    }
    if (this.state === "fall" && res.landed) {
      const dist = this.y - this.fallStartY;
      const sc = this.standCell();
      const cell = sc && this.world.cell(sc.c, sc.r);
      if ((cell && cell.t === "spikes") || dist > FALL_HURT) {
        sfx.land(1);
        this.die();
      } else {
        sfx.land(0.4);
        if (dist > 150) this.takeHit(1, 0);
        if (this.alive) this.setState("stand");
      }
    }
    if (this.y > this.world.rows * 128 + 200) this.die();

    if (this.onGround) {
      const sc = this.standCell();
      if (sc && sc.kind !== "wall") this.world.stepOn(sc.c, sc.r);
    }
    for (const k of this.world.chompers) {
      if (k.cell.jaw > 0.6 && Math.abs(this.x - (k.c * TW + 40)) < 11 && Math.abs(this.y - surfaceY(k.r)) < 20) this.die();
    }

    if (a === this.anim) {
      if (this.anim === "fightStep") this.animT += dt / 0.4;
      else if (this.state !== "strike") this.animT += dt / (ANIMS[this.anim]?.dur || 1.2);
    }
    if (this.cfg.wraith && Math.random() < 0.5) particles.shade(this.x, this.y);
  }
}

export class Princess {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.facing = -1;
    this.anim = "stand";
    this.animT = 0;
  }
  update(dt) {
    this.animT += dt / 3;
  }
}
