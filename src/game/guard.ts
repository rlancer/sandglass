import { WALK_SPEED } from "./constants";
import type { AudioBus } from "./audio";
import type { Room } from "./level";
import type { Player } from "./player";

export function updateGuards(room: Room, player: Player, audio: AudioBus, dt: number) {
  for (const g of room.guards) {
    if (g.dead) {
      g.anim = "die";
      g.animT += dt;
      continue;
    }
    g.animT += dt;
    if (g.hurtT > 0) g.hurtT -= dt;
    if (g.strikeT > 0) g.strikeT -= dt;

    const dx = player.x - g.x;
    const dist = Math.abs(dx);
    const sameLevel = Math.abs(player.y - g.y) < 48;

    g.engage = sameLevel && dist < 160 && !player.dead;

    if (g.hurtT > 0) {
      g.anim = "hurt";
      g.vx = 0;
      continue;
    }

    if (!g.engage || !player.hasSword) {
      g.anim = "idle";
      g.vx = 0;
      // Pace slowly if player visible without sword — still hostile at close range
      if (g.engage && !player.hasSword && dist < 50 && g.strikeT <= 0) {
        g.facing = dx > 0 ? 1 : -1;
        g.strikeT = 0.4;
        g.anim = "strike";
        audio.swing();
        if (dist < 40 && player.invuln <= 0) {
          player.damage(1, audio);
          audio.hit();
        }
      }
      continue;
    }

    g.facing = dx > 0 ? 1 : -1;

    // Sword range combat
    if (dist > 48) {
      g.vx = g.facing * WALK_SPEED * 0.85;
      g.anim = "advance";
    } else if (dist < 32) {
      g.vx = -g.facing * WALK_SPEED * 0.7;
      g.anim = "retreat";
    } else {
      g.vx = 0;
      g.anim = "idle";
    }

    if (g.strikeT <= 0 && dist < 52 && Math.random() < 0.02) {
      g.strikeT = 0.35;
      g.anim = "strike";
      g.vx = 0;
      audio.swing();
    }

    if (g.strikeT > 0.15 && g.strikeT < 0.28 && dist < 44) {
      // Player can "parry" by striking at the same time
      const playerStriking = player.strikeT > 0;
      if (playerStriking) {
        // clash — cancel
        g.strikeT = 0;
        player.strikeT = 0;
        audio.hit();
      } else if (player.invuln <= 0) {
        player.damage(1, audio);
        audio.hit();
        g.strikeT = 0.05;
      }
    }

    g.x += g.vx;
    // Keep on roughly same floor band
    g.y = player.y; // stick to fight line when engaged — simplified
  }

  // Player hits guards
  const box = player.strikeBox();
  if (!box) return;
  for (const g of room.guards) {
    if (g.dead || g.hurtT > 0) continue;
    if (Math.abs(g.x - box.x) < box.w && Math.abs(g.y - 30 - box.y) < box.h) {
      g.hp -= 1;
      g.hurtT = 0.35;
      g.anim = "hurt";
      audio.hit();
      // knockback
      g.x += player.facing * 10;
      if (g.hp <= 0) {
        g.dead = true;
        g.anim = "die";
        audio.die();
      }
    }
  }
}
