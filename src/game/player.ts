import {
  GRAVITY,
  JUMP_VX,
  JUMP_VY,
  MAX_FALL,
  PLAYER_MAX_HP,
  ROOM_ROWS,
  RUN_SPEED,
  TILE_H,
  TILE_W,
  UP_JUMP_VY,
  WALK_SPEED,
} from "./constants";
import type { AudioBus } from "./audio";
import type { Input } from "./input";
import { ledgeAt, probeFloor, probeWall, type Room, type World } from "./level";
import type { Facing, PlayerAnim } from "./types";

export class Player {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  facing: Facing = 1;
  onGround = false;
  hanging = false;
  climbing = false;
  crouching = false;
  fighting = false;
  hasSword = false;
  hp = PLAYER_MAX_HP;
  maxHp = PLAYER_MAX_HP;
  anim: PlayerAnim = "idle";
  animT = 0;
  invuln = 0;
  strikeT = 0;
  hurtT = 0;
  dead = false;
  landT = 0;
  fallStartY = 0;
  roomSpawnX = 0;
  roomSpawnY = 0;
  reachedExit = false;
  /** 0..1 foot-plant phase for rotoscope run/walk */
  runPhase = 0;
  private runDist = 0;
  private hangFacing: Facing = 1;
  private climbT = 0;
  private pickupT = 0;

  reset(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = true;
    this.hanging = false;
    this.climbing = false;
    this.crouching = false;
    this.fighting = false;
    this.anim = "idle";
    this.animT = 0;
    this.invuln = 0;
    this.strikeT = 0;
    this.hurtT = 0;
    this.dead = false;
    this.landT = 0;
    this.fallStartY = y;
    this.roomSpawnX = x;
    this.roomSpawnY = y;
    this.reachedExit = false;
  }

  respawnInRoom() {
    this.x = this.roomSpawnX;
    this.y = this.roomSpawnY;
    this.vx = 0;
    this.vy = 0;
    this.onGround = true;
    this.hanging = false;
    this.climbing = false;
    this.fighting = false;
    this.dead = false;
    this.anim = "idle";
    this.hurtT = 0;
    this.invuln = 1.2;
  }

  update(input: Input, world: World, audio: AudioBus, dt: number) {
    if (this.dead) {
      this.anim = "die";
      this.animT += dt;
      return;
    }
    if (this.invuln > 0) this.invuln -= dt;
    if (this.strikeT > 0) this.strikeT -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.landT > 0) this.landT -= dt;
    if (this.pickupT > 0) this.pickupT -= dt;

    const room = world.room;
    const axis = input.axis();

    // Climbing sequence
    if (this.climbing) {
      this.climbT += dt;
      this.anim = "climb";
      this.vy = 0;
      this.vx = 0;
      if (this.climbT > 0.45) {
        this.climbing = false;
        this.hanging = false;
        this.y -= 42;
        this.x += this.hangFacing * 18;
        this.onGround = true;
      }
      this.animT += dt;
      return;
    }

    // Hanging
    if (this.hanging) {
      this.vx = 0;
      this.vy = 0;
      this.anim = "hang";
      this.animT += dt;
      if (input.up() || (input.jump() && !input.down())) {
        this.climbing = true;
        this.climbT = 0;
        audio.jump();
      } else if (input.down()) {
        this.hanging = false;
        this.vy = 1.2;
        this.onGround = false;
      }
      return;
    }

    // Fighting stance when near enemies with sword
    if (this.hasSword && this.onGround && this.fighting) {
      this.updateFight(input, audio, dt);
      this.moveIntegrate(room, audio, dt);
      this.checkSpikes(room, audio);
      this.checkExit(room);
      return;
    }

    // Enter fight if enemy close
    if (this.hasSword && this.onGround && !this.crouching) {
      const near = room.guards.some(
        (g) => !g.dead && Math.abs(g.x - this.x) < 90 && Math.abs(g.y - this.y) < 40,
      );
      if (near) this.fighting = true;
    }
    if (this.fighting) {
      const near = room.guards.some(
        (g) => !g.dead && Math.abs(g.x - this.x) < 120 && Math.abs(g.y - this.y) < 50,
      );
      if (!near) this.fighting = false;
    }

    if (this.pickupT > 0) {
      this.anim = "pickup";
      this.vx = 0;
      this.animT += dt;
      this.moveIntegrate(room, audio, dt);
      return;
    }

    // Crouch / careful
    this.crouching = this.onGround && input.down();

    if (this.onGround) {
      if (this.landT > 0) {
        this.anim = "land";
        this.vx *= 0.7;
      } else if (this.crouching) {
        this.anim = "crouch";
        this.vx = 0;
        if (axis !== 0) this.facing = axis > 0 ? 1 : -1;
        // Careful step
        if (input.careful() && axis !== 0) {
          this.vx = axis * WALK_SPEED * 0.6;
          this.anim = "walk";
        }
      } else if (axis !== 0) {
        this.facing = axis > 0 ? 1 : -1;
        if (input.careful()) {
          this.vx = axis * WALK_SPEED;
          this.anim = "walk";
          this.runPhase = (this.runPhase + Math.abs(this.vx) * 0.028) % 1;
          this.runDist += Math.abs(this.vx);
          if (this.runDist > 22) {
            audio.step();
            this.runDist = 0;
          }
        } else {
          this.vx = axis * RUN_SPEED;
          this.anim = "run";
          this.runPhase = (this.runPhase + Math.abs(this.vx) * 0.034) % 1;
          this.runDist += Math.abs(this.vx);
          if (this.runDist > 16) {
            audio.step();
            this.runDist = 0;
          }
        }
      } else {
        this.vx *= 0.6;
        if (Math.abs(this.vx) < 0.1) this.vx = 0;
        this.anim = "idle";
        this.runDist = 0;
      }

      // Jump
      if (input.jump() && !this.crouching) {
        const running = Math.abs(this.vx) > RUN_SPEED * 0.6;
        if (input.up() && axis === 0) {
          this.vy = UP_JUMP_VY;
          this.vx = 0;
        } else {
          this.vy = JUMP_VY;
          if (running) this.vx = this.facing * JUMP_VX;
          else if (axis !== 0) this.vx = this.facing * JUMP_VX * 0.75;
        }
        this.onGround = false;
        this.fallStartY = this.y;
        this.anim = "jump";
        audio.jump();
      }
    } else {
      // Air
      if (axis !== 0) {
        this.facing = axis > 0 ? 1 : -1;
        this.vx += axis * 0.12;
        this.vx = Math.max(-JUMP_VX, Math.min(JUMP_VX, this.vx));
      }
      if (this.vy < 0) this.anim = "jump";
      else this.anim = "fall";

      // Grab ledge near apex or while falling
      if (this.vy > -2 && input.jumpHold()) {
        const ledge = ledgeAt(room, this.x, this.y, this.facing);
        if (ledge) {
          this.hanging = true;
          this.hangFacing = this.facing;
          this.x = ledge.x;
          this.y = ledge.y;
          this.vx = 0;
          this.vy = 0;
          this.anim = "hang";
          audio.land();
        }
      }
    }

    this.moveIntegrate(room, audio, dt);
    this.checkSpikes(room, audio);
    this.checkExit(room);
    this.animT += dt;
  }

  private updateFight(input: Input, audio: AudioBus, dt: number) {
    const axis = input.axis();
    if (axis !== 0) this.facing = axis > 0 ? 1 : -1;

    if (this.strikeT > 0) {
      this.anim = "strike";
      this.vx = 0;
    } else if (this.hurtT > 0) {
      this.anim = "hurt";
      this.vx = 0;
    } else {
      this.anim = "fight";
      if (axis !== 0) {
        this.vx = axis * WALK_SPEED * 0.9;
      } else {
        this.vx = 0;
      }
      if (input.strike()) {
        this.strikeT = 0.28;
        this.anim = "strike";
        audio.swing();
      }
    }
    // Escape fight with down+away or just leave
    if (input.down()) this.fighting = false;
    this.animT += dt;
  }

  private moveIntegrate(room: Room, audio: AudioBus, _dt: number) {
    const steps = 1;
    for (let s = 0; s < steps; s++) {
      if (!this.onGround && !this.hanging) {
        this.vy = Math.min(MAX_FALL, this.vy + GRAVITY);
      }

      this.x += this.vx;
      // Walls
      const wall = probeWall(room, this.x, this.y, 10, 46);
      if (wall) {
        if (this.vx > 0) this.x = wall.left - 11;
        else if (this.vx < 0) this.x = wall.right + 11;
        else {
          // push out
          const mid = (wall.left + wall.right) / 2;
          this.x = this.x < mid ? wall.left - 11 : wall.right + 11;
        }
        this.vx = 0;
      }

      const prevY = this.y;
      this.y += this.vy;

      // Sweep for floors between prev and current Y (prevents tunneling)
      let floor = probeFloor(room, this.x, this.y, 20);
      if (!floor && this.vy > 0) {
        floor = probeFloor(room, this.x, prevY + 2, 20);
        if (floor && prevY <= floor.top + 4 && this.y >= floor.top) {
          // crossed the surface this frame
        } else {
          floor = null;
        }
      }
      // Also scan tile row directly under previous position
      if (!floor && this.vy >= 0) {
        const crossed = probeFloor(room, this.x, Math.min(prevY, this.y) + 8, 20);
        if (
          crossed &&
          prevY <= crossed.top + 6 &&
          this.y >= crossed.top - 2
        ) {
          floor = crossed;
        }
      }

      if (floor && this.vy >= 0 && this.y >= floor.top - 4) {
        const fallDist = this.y - this.fallStartY;
        this.y = floor.top;
        this.vy = 0;
        if (!this.onGround) {
          this.onGround = true;
          audio.land();
          if (fallDist > 110) {
            this.damage(fallDist > 180 ? 2 : 1, audio);
            this.landT = 0.35;
          } else if (fallDist > 40) {
            this.landT = 0.15;
          }
        }
        // Loose floor — cracks, then drops after a short stand
        if (floor.kind === "loose") {
          const t = room.tileAt(floor.col, floor.row);
          if (t) {
              t.state += 0.012;
              if (t.state > 1) {
              t.kind = "empty";
              t.solid = false;
              this.onGround = false;
              this.vy = 1;
              this.fallStartY = this.y;
            }
          }
        }
        if (this.onGround) this.fallStartY = this.y;
      } else if (!this.hanging) {
        if (this.onGround) {
          this.onGround = false;
          this.fallStartY = this.y;
        }
      }

      // Ceiling-ish clamp
      if (this.y < 20) {
        this.y = 20;
        if (this.vy < 0) this.vy = 0;
      }
      // Kill pit
      if (this.y > ROOM_ROWS * TILE_H + 40) {
        this.damage(99, audio);
      }
    }
  }

  private checkSpikes(room: Room, audio: AudioBus) {
    if (!this.onGround || this.invuln > 0) return;
    const col = Math.floor(this.x / TILE_W);
    const row = Math.floor(this.y / TILE_H);
    const t = room.tileAt(col, row);
    if (t?.kind === "spikes") {
      this.damage(1, audio);
      this.vy = -4;
      this.onGround = false;
      this.fallStartY = this.y;
    }
  }

  private checkExit(room: Room) {
    const col = Math.floor(this.x / TILE_W);
    const row = Math.floor((this.y - 20) / TILE_H);
    const t = room.tileAt(col, row) ?? room.tileAt(col, Math.floor(this.y / TILE_H));
    if (t?.kind === "exit" && this.onGround) {
      this.reachedExit = true;
    }
  }

  damage(amount: number, audio: AudioBus) {
    if (this.dead || this.invuln > 0) return;
    this.hp -= amount;
    this.hurtT = 0.35;
    this.invuln = 0.9;
    this.fighting = false;
    audio.hurt();
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.anim = "die";
      audio.die();
    }
  }

  tryPickup(room: Room, audio: AudioBus): string | null {
    for (const p of room.pickups) {
      if (p.taken) continue;
      if (Math.abs(p.x - this.x) < 22 && Math.abs(p.y - this.y) < 30) {
        p.taken = true;
        this.pickupT = 0.4;
        audio.pickup();
        if (p.type === "sword") {
          this.hasSword = true;
          return "The stolen blade is yours.";
        }
        if (p.type === "heal") {
          this.hp = Math.min(this.maxHp, this.hp + 1);
          return "A healing draught.";
        }
        if (p.type === "life") {
          this.maxHp += 1;
          this.hp = this.maxHp;
          return "Your life force grows.";
        }
      }
    }
    return null;
  }

  /** Sword tip during strike for hit tests */
  strikeBox(): { x: number; y: number; w: number; h: number } | null {
    if (this.strikeT <= 0 || this.strikeT > 0.2) return null;
    return {
      x: this.x + this.facing * 28,
      y: this.y - 36,
      w: 26,
      h: 20,
    };
  }
}
