const DOWN = Math.PI / 2;

function bone(ctx, len, thick, color) {
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(20, 10, 6, 0.55)";
  ctx.lineWidth = thick + 2.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len, 0);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = thick;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len, 0);
  ctx.stroke();
  ctx.translate(len, 0);
}

function sword(ctx, angle) {
  ctx.save();
  ctx.rotate(angle);
  ctx.fillStyle = "#e7eef8";
  ctx.beginPath();
  ctx.moveTo(2, 1.5);
  ctx.quadraticCurveTo(26, -14, 54, -1);
  ctx.quadraticCurveTo(28, -5, 2, -3);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(12, -3);
  ctx.quadraticCurveTo(30, -10, 48, -2);
  ctx.stroke();
  ctx.fillStyle = "#e6b34a";
  ctx.fillRect(-7, -5, 12, 10);
  ctx.fillStyle = "#24160f";
  ctx.fillRect(-12, -2.5, 6, 5);
  ctx.restore();
}

function angles(ent, time) {
  const pose = {
    bob: Math.sin(time * 2.1 + (ent.x || 0) * 0.01) * 1.2,
    sway: 0.02,
    thighL: DOWN + 0.08,
    kneeL: 0.22,
    thighR: DOWN - 0.02,
    kneeR: 0.16,
    armB: DOWN + 0.28,
    elbowB: 0.35,
    armF: DOWN + 0.08,
    elbowF: 0.28,
    sword: 0.05,
    drawn: !!(ent.swordOut || ent.kind === "guard" || ent.forceSword),
    lean: 0,
  };

  if (ent.mode === "dead" || ent.mode === "corpse") {
    const u = Math.min(1, ent.deathT ?? 1);
    pose.bob = 10 * u;
    pose.lean = 1.15 * u;
    pose.thighL = DOWN + 0.9 * u;
    pose.kneeL = 0.2;
    pose.thighR = DOWN + 0.4 * u;
    pose.kneeR = 0.3;
    pose.armB = DOWN + 0.8;
    pose.armF = 0.4;
    pose.elbowF = 0.6;
    return pose;
  }

  if (ent.mode === "hang") {
    pose.bob = 0;
    pose.armB = -1.25;
    pose.elbowB = 0.15;
    pose.armF = -1.45;
    pose.elbowF = 0.12;
    pose.thighL = DOWN + 0.15;
    pose.kneeL = 0.55;
    pose.thighR = DOWN - 0.25;
    pose.kneeR = 0.7;
    return pose;
  }

  if (ent.mode === "climb") {
    const u = (ent.climb?.t || 0) / (ent.climb?.dur || 1);
    pose.armB = -1.2 + u * 1.3;
    pose.armF = -1.4 + u * 1.5;
    pose.elbowF = 0.2;
    pose.thighL = DOWN - 0.3 * (1 - u);
    pose.kneeL = 0.6 * (1 - u);
    pose.thighR = DOWN + 0.2;
    pose.kneeR = 0.4 * (1 - u);
    return pose;
  }

  const strikeU =
    ent.act?.type === "strike"
      ? ent.act.t / ent.act.dur
      : ent.swing
        ? swingVisual(ent.swing)
        : null;

  if (strikeU != null) {
    pose.drawn = true;
    if (strikeU < 0.32) {
      const k = strikeU / 0.32;
      pose.armF = -0.4 - k * 1.15;
      pose.elbowF = -0.35;
      pose.sword = -0.35;
      pose.sway = -0.14;
      pose.thighR = DOWN - 0.25;
    } else if (strikeU < 0.55) {
      const k = (strikeU - 0.32) / 0.23;
      pose.armF = -1.55 + k * 1.85;
      pose.elbowF = -0.1;
      pose.sword = -0.15 + k * 0.15;
      pose.sway = -0.14 + k * 0.32;
      pose.thighR = DOWN - 0.35;
      pose.kneeR = 0.15;
    } else {
      const k = (strikeU - 0.55) / 0.45;
      pose.armF = 0.3 + k * 0.15;
      pose.elbowF = 0.25 * k;
      pose.sword = 0.05;
      pose.sway = 0.18 * (1 - k);
    }
    return pose;
  }

  if (ent.act?.type === "parry" || ent.blocking > 0) {
    pose.drawn = true;
    pose.armF = -1.05;
    pose.elbowF = 0.95;
    pose.sword = -1.15;
    pose.sway = -0.06;
    pose.thighR = DOWN - 0.2;
    return pose;
  }

  if (ent.act?.type === "drink") {
    pose.armF = -0.7;
    pose.elbowF = 1.15;
    pose.drawn = false;
    pose.sway = 0.12;
    return pose;
  }

  if (ent.hurtT > 0) {
    pose.sway = -0.28;
    pose.armF = DOWN + 0.45;
    pose.elbowF = 0.5;
    pose.thighL = DOWN + 0.35;
    pose.kneeL = 0.15;
    return pose;
  }

  if (ent.mode === "air") {
    const up = (ent.vy || 0) < 0;
    pose.bob = up ? -4 : 2;
    pose.thighL = up ? DOWN - 0.55 : DOWN + 0.15;
    pose.kneeL = up ? 1.15 : 0.45;
    pose.thighR = up ? DOWN + 0.15 : DOWN - 0.45;
    pose.kneeR = up ? 0.7 : 0.9;
    pose.armB = up ? -0.8 : DOWN - 0.2;
    pose.elbowB = 0.3;
    pose.armF = up ? -1.1 : -0.4;
    pose.elbowF = 0.25;
    pose.sword = -0.4;
    return pose;
  }

  if (Math.abs(ent.vx || 0) > 40) {
    const a = (ent.runPhase || 0) * Math.PI * 2;
    const s = Math.sin(a);
    pose.bob = -Math.abs(Math.sin(a * 2)) * 3.2;
    pose.sway = 0.12;
    pose.thighL = DOWN + s * 0.62;
    pose.kneeL = Math.max(0.08, -s) * 1.2;
    pose.thighR = DOWN - s * 0.62;
    pose.kneeR = Math.max(0.08, s) * 1.2;
    pose.armB = DOWN - s * 0.5;
    pose.elbowB = 0.45 + Math.max(0, s) * 0.2;
    pose.armF = DOWN + s * 0.5;
    pose.elbowF = 0.4;
    if (!pose.drawn) pose.sword = 0.2;
    return pose;
  }

  if (pose.drawn && ent.kind !== "laleh") {
    pose.armF = -0.55;
    pose.elbowF = 0.55;
    pose.sword = -0.55;
  }
  return pose;
}

function swingVisual(sw) {
  if (sw.t < sw.wind) return (sw.t / sw.wind) * 0.32;
  if (sw.t < sw.wind + sw.active) return 0.32 + ((sw.t - sw.wind) / sw.active) * 0.23;
  return Math.min(1, 0.55 + ((sw.t - sw.wind - sw.active) / sw.recover) * 0.45);
}

function arm(ctx, shoulder, elbow, kit, drawn, swordAngle) {
  ctx.save();
  ctx.rotate(shoulder);
  bone(ctx, 20, 7.5, kit.skin);
  ctx.rotate(elbow);
  bone(ctx, 18, 6, kit.skin);
  if (drawn) sword(ctx, swordAngle);
  ctx.restore();
}

function leg(ctx, thigh, knee, kit, gown) {
  if (gown) return;
  ctx.save();
  ctx.rotate(thigh);
  bone(ctx, 26, 11, kit.cloth);
  ctx.rotate(knee);
  bone(ctx, 14, 8.5, kit.cloth);
  bone(ctx, 12, 8, kit.boot);
  ctx.restore();
}

export function drawFigure(ctx, ent, _phase, time, alpha = 1) {
  if (!ent || ent.mode === "gone") return;
  const prince = ent.kind !== "guard" && ent.kind !== "laleh";
  const nightGuard = ent.kind === "guard" && ent.phase === "night";
  const kit = ent.kind === "laleh"
    ? { skin: "#c4814d", hair: "#16110e", scarf: "#f3e2c0", vest: "#2c4f9a", inner: "#e6b34a", gold: "#e6b34a", cloth: "#2c4f9a", boot: "#1c2748", gown: true }
    : ent.kind === "guard"
      ? {
          skin: "#a86b42",
          hair: "#1a120e",
          scarf: "#5c1a28",
          vest: nightGuard ? "#6d7c98" : "#8a6234",
          inner: nightGuard ? "#2c3858" : "#4a3018",
          gold: nightGuard ? "#d5deef" : "#e6c98a",
          cloth: "#6b2432",
          boot: "#1a120e",
          helm: true,
          plume: nightGuard ? "#d5deef" : "#e6b34a",
        }
      : {
          skin: "#c4814d",
          hair: "#16110e",
          scarf: "#f7f1e6",
          vest: "#8f1d32",
          inner: "#243e86",
          gold: "#e6b34a",
          cloth: "#f4efe4",
          boot: "#24180f",
        };

  const pose = angles(ent, time);
  const facing = ent.facing || 1;
  const scale = (ent.boss ? 1.12 : 1) * 1.18;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(ent.x, ent.y + (pose.bob || 0));
  ctx.scale(facing * scale, scale);
  if (pose.lean) ctx.rotate(pose.lean);

  if (ent.mode === "ground" || ent.mode === "hang" || ent.mode === "corpse" || !ent.mode) {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(2, 4, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const hipY = -51;
  const shoulder = { x: 2 + pose.sway * 18, y: hipY - 30 };
  const hip = { x: pose.sway * 8, y: hipY };

  ctx.save();
  ctx.translate(hip.x, hip.y);
  leg(ctx, pose.thighL, pose.kneeL, kit, kit.gown);
  ctx.restore();

  ctx.save();
  ctx.translate(shoulder.x - 2, shoulder.y);
  arm(ctx, pose.armB, pose.elbowB, kit, false, 0);
  ctx.restore();

  ctx.fillStyle = kit.skin;
  ctx.beginPath();
  ctx.moveTo(hip.x - 9, hip.y + 2);
  ctx.quadraticCurveTo(shoulder.x - 14, shoulder.y + 16, shoulder.x - 12, shoulder.y + 4);
  ctx.lineTo(shoulder.x + 12, shoulder.y + 2);
  ctx.quadraticCurveTo(shoulder.x + 14, shoulder.y + 18, hip.x + 9, hip.y + 2);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.stroke();

  if (kit.gown) {
    ctx.fillStyle = kit.vest;
    ctx.beginPath();
    ctx.moveTo(shoulder.x - 14, shoulder.y + 8);
    ctx.lineTo(shoulder.x + 14, shoulder.y + 6);
    ctx.lineTo(18, 2);
    ctx.lineTo(-16, 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = kit.gold;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  } else {
    ctx.fillStyle = kit.vest;
    ctx.beginPath();
    ctx.moveTo(hip.x - 10, hip.y);
    ctx.lineTo(shoulder.x - 14, shoulder.y + 8);
    ctx.lineTo(shoulder.x + 14, shoulder.y + 6);
    ctx.lineTo(hip.x + 10, hip.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = kit.inner;
    ctx.beginPath();
    ctx.moveTo(hip.x - 3, hip.y - 2);
    ctx.lineTo(shoulder.x - 3, shoulder.y + 10);
    ctx.lineTo(shoulder.x + 4, shoulder.y + 10);
    ctx.lineTo(hip.x + 3, hip.y - 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = kit.gold;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(shoulder.x - 13, shoulder.y + 8);
    ctx.lineTo(hip.x - 9, hip.y);
    ctx.moveTo(shoulder.x + 13, shoulder.y + 7);
    ctx.lineTo(hip.x + 9, hip.y);
    ctx.stroke();
  }

  if (prince) {
    ctx.fillStyle = kit.scarf;
    ctx.beginPath();
    ctx.ellipse(shoulder.x, shoulder.y + 8, 11, 6.5, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(shoulder.x - 4, shoulder.y + 10);
    ctx.quadraticCurveTo(shoulder.x - 10, shoulder.y + 28, shoulder.x - 2, shoulder.y + 26);
    ctx.quadraticCurveTo(shoulder.x + 2, shoulder.y + 16, shoulder.x + 2, shoulder.y + 8);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(hip.x, hip.y);
  leg(ctx, pose.thighR, pose.kneeR, kit, kit.gown);
  ctx.restore();

  const head = { x: shoulder.x + 1, y: shoulder.y - 16 };
  ctx.fillStyle = kit.hair;
  ctx.beginPath();
  ctx.ellipse(head.x - 1, head.y, 13, 14.5, -0.1, 0, Math.PI * 2);
  ctx.fill();
  if (!kit.helm && !kit.gown) {
    ctx.strokeStyle = kit.hair;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(head.x - 8, head.y + 2);
    ctx.quadraticCurveTo(head.x - 22, head.y + 18, head.x - 12, head.y + 32);
    ctx.stroke();
  }
  if (kit.gown) {
    ctx.strokeStyle = kit.hair;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(head.x - 4, head.y + 8);
    ctx.quadraticCurveTo(head.x - 8, head.y + 36, head.x + 2, head.y + 48);
    ctx.stroke();
    ctx.fillStyle = kit.gold;
    ctx.beginPath();
    ctx.arc(head.x - 2, head.y + 28, 1.4, 0, Math.PI * 2);
    ctx.arc(head.x + 1, head.y + 36, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = kit.skin;
  ctx.beginPath();
  ctx.arc(head.x + 2, head.y, 11.2, 0, Math.PI * 2);
  ctx.fill();

  if (kit.helm) {
    ctx.fillStyle = kit.vest;
    ctx.beginPath();
    ctx.arc(head.x + 1, head.y - 1, 12, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();
    ctx.fillRect(head.x - 12, head.y - 3, 26, 9);
    ctx.fillStyle = kit.plume;
    ctx.beginPath();
    ctx.moveTo(head.x, head.y - 12);
    ctx.quadraticCurveTo(head.x - 16, head.y - 30, head.x - 8, head.y - 38);
    ctx.quadraticCurveTo(head.x - 4, head.y - 22, head.x + 3, head.y - 11);
    ctx.fill();
  } else {
    ctx.strokeStyle = kit.gold;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.arc(head.x + 2, head.y - 1, 11, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
    ctx.fillStyle = kit.gold;
    ctx.beginPath();
    ctx.arc(head.x + 2, head.y - 12.5, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#1a120e";
  ctx.beginPath();
  ctx.ellipse(head.x + 7, head.y - 1, 1.6, 1.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(shoulder.x + 3, shoulder.y);
  arm(ctx, pose.armF, pose.elbowF, kit, pose.drawn && !kit.gown, pose.sword);
  ctx.restore();

  if (prince && ent.sheathed) {
    ctx.save();
    ctx.translate(hip.x - 4, hip.y + 2);
    ctx.rotate(-1.15);
    sword(ctx, 0);
    ctx.restore();
  }

  ctx.restore();
}
