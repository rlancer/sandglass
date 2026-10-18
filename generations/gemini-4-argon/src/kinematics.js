// Jordan Mechner 1989 Rotoscoped Kinematic Skeleton & Cloth Renderer
// Renders the Prince, Shadow Twin, Palace Guards, Vizier Jaffar, and the Princess
// with multi-jointed limbs, baggy Persian trousers, sash physics, and scimitar arcs.

export function renderCharacter(ctx, actor, options = {}) {
  const {
    visualMode = 'illuminated',
    time = 0,
    isShadowTwin = false,
    isDarkMirror = false
  } = options;

  ctx.save();
  ctx.translate(actor.x, actor.y);
  ctx.scale(actor.facing, 1);

  const st = actor.state || 'idle';
  const t = actor.animTime || 0;

  // Compute kinematic pose angles & offsets in local character space (feet at y = 0, standing height ~ 78px)
  let hipY = -36;
  let hipX = 0;
  let torsoTilt = 0.05;
  let headNod = 0;

  let lThigh = 0.12;
  let lShin = 0.1;
  let rThigh = -0.15;
  let rShin = 0.18;

  let lUpperArm = 0.25;
  let lForeArm = -0.5;
  let rUpperArm = -0.2;
  let rForeArm = -0.45;
  let swordAngle = -0.6;
  let showSword = actor.swordDrawn || actor.hasSwordOut;
  let swordSlashArc = 0;

  if (st === 'idle') {
    const breath = Math.sin(time * 3.5) * 1.5;
    hipY = -37 + breath * 0.4;
    torsoTilt = 0.04 + Math.sin(time * 1.8) * 0.02;
    lThigh = 0.14;
    lShin = 0.06;
    rThigh = -0.16;
    rShin = 0.12;
    lUpperArm = 0.22;
    lForeArm = -0.45;
    rUpperArm = -0.18;
    rForeArm = -0.35;
  } else if (st === 'careful_step') {
    // Classic 1989 cautious tiptoe probe forward
    const phase = Math.sin(t * 10);
    hipY = -34 + Math.abs(phase) * 2;
    torsoTilt = 0.24; // Leaning forward examining floor
    headNod = 0.22;
    rThigh = -0.45 - phase * 0.25;
    rShin = 0.45 + phase * 0.2;
    lThigh = 0.25 + phase * 0.18;
    lShin = 0.25;
    lUpperArm = 0.55;
    lForeArm = -0.8;
    rUpperArm = -0.45;
    rForeArm = -0.65;
  } else if (st === 'run') {
    // Full rotoscoped 8-phase run stride
    const cycle = t * 13.5;
    const s = Math.sin(cycle);
    const c = Math.cos(cycle);
    hipY = -36 + Math.abs(s) * 4.5;
    torsoTilt = 0.28 + c * 0.05;
    lThigh = s * 0.78;
    lShin = Math.max(0.08, -c * 0.85 + 0.35);
    rThigh = -s * 0.78;
    rShin = Math.max(0.08, c * 0.85 + 0.35);
    lUpperArm = -s * 0.7;
    lForeArm = -1.05 + s * 0.25;
    rUpperArm = s * 0.7;
    rForeArm = -1.05 - s * 0.25;
  } else if (st === 'skid_turn') {
    hipY = -32;
    torsoTilt = -0.32;
    lThigh = -0.55;
    lShin = 0.3;
    rThigh = 0.42;
    rShin = 0.65;
    lUpperArm = -0.6;
    rUpperArm = 0.65;
  } else if (st === 'crouch') {
    hipY = -20;
    torsoTilt = 0.38;
    lThigh = -0.95;
    lShin = 1.65;
    rThigh = -0.78;
    rShin = 1.55;
    lUpperArm = 0.35;
    lForeArm = -0.9;
    rUpperArm = -0.25;
    rForeArm = -0.85;
  } else if (st === 'drink') {
    hipY = -23;
    torsoTilt = -0.15;
    headNod = -0.38;
    lThigh = -0.85;
    lShin = 1.55;
    rThigh = 0.2;
    rShin = 1.35;
    rUpperArm = -1.35;
    rForeArm = -1.25;
  } else if (st === 'jump_up' || st === 'run_jump') {
    hipY = -42;
    torsoTilt = st === 'run_jump' ? 0.36 : 0.08;
    lThigh = st === 'run_jump' ? 0.65 : -0.45;
    lShin = st === 'run_jump' ? 0.75 : 0.9;
    rThigh = st === 'run_jump' ? -0.85 : -0.55;
    rShin = st === 'run_jump' ? 0.25 : 0.95;
    lUpperArm = -1.15;
    lForeArm = -0.55;
    rUpperArm = -1.35;
    rForeArm = -0.45;
  } else if (st === 'fall' || st === 'float_fall') {
    const wave = Math.sin(time * 12) * 0.2;
    hipY = -38;
    torsoTilt = st === 'float_fall' ? -0.08 : 0.16;
    lThigh = -0.35 + wave;
    lShin = 0.65;
    rThigh = 0.25 - wave;
    rShin = 0.55;
    lUpperArm = -1.45 + wave;
    lForeArm = -0.3;
    rUpperArm = -1.55 - wave;
    rForeArm = -0.3;
  } else if (st === 'ledge_hang') {
    const swing = Math.sin(time * 5) * 0.12;
    hipY = -28;
    torsoTilt = swing * 0.5;
    lThigh = 0.15 + swing;
    lShin = 0.25;
    rThigh = -0.1 + swing;
    rShin = 0.35;
    lUpperArm = -2.75;
    lForeArm = -0.2;
    rUpperArm = -2.85;
    rForeArm = -0.2;
  } else if (st === 'ledge_climb') {
    const p = Math.min(1, t / 0.42);
    hipY = -28 - p * 14;
    torsoTilt = 0.45 * (1 - p);
    lThigh = -0.9 * (1 - p);
    lShin = 1.4 * (1 - p);
    rThigh = 0.3 * (1 - p);
    rShin = 0.8 * (1 - p);
    lUpperArm = -1.8 + p * 1.6;
    rUpperArm = -1.8 + p * 1.6;
  } else if (st === 'sword_idle' || st === 'sword_advance') {
    showSword = true;
    const step = st === 'sword_advance' ? Math.sin(t * 14) * 0.35 : Math.sin(time * 4) * 0.06;
    hipY = -34;
    torsoTilt = 0.16;
    lThigh = 0.42 + step;
    lShin = 0.35;
    rThigh = -0.48 - step;
    rShin = 0.48;
    lUpperArm = 0.45;
    lForeArm = -0.95;
    rUpperArm = -0.55;
    rForeArm = -0.55;
    swordAngle = -0.45 + Math.sin(time * 5) * 0.05;
  } else if (st === 'sword_parry') {
    showSword = true;
    hipY = -33;
    torsoTilt = -0.12;
    lThigh = 0.48;
    lShin = 0.4;
    rThigh = -0.52;
    rShin = 0.55;
    lUpperArm = 0.3;
    lForeArm = -1.1;
    rUpperArm = -1.15;
    rForeArm = -0.75;
    swordAngle = -1.35; // Raised diagonal guard parry
  } else if (st === 'sword_strike') {
    showSword = true;
    hipY = -32;
    torsoTilt = 0.34;
    lThigh = 0.62;
    lShin = 0.25;
    rThigh = -0.68;
    rShin = 0.65;
    lUpperArm = 0.7;
    lForeArm = -0.8;
    rUpperArm = -0.15;
    rForeArm = -0.05;
    swordAngle = 0.18; // Full lunging horizontal thrust/slash
    swordSlashArc = 1;
  } else if (st === 'sword_hit' || st === 'hard_land') {
    hipY = -27;
    torsoTilt = -0.35;
    lThigh = 0.2;
    lShin = 0.7;
    rThigh = -0.4;
    rShin = 0.85;
    lUpperArm = 0.6;
    rUpperArm = 0.4;
  } else if (st === 'dead') {
    hipY = -8;
    torsoTilt = 1.48;
    lThigh = 0.1;
    lShin = 0.2;
    rThigh = -0.2;
    rShin = 0.3;
    lUpperArm = 0.4;
    rUpperArm = -0.6;
  }

  // Palette selection based on character role & visual mode
  const role = actor.role || 'prince';
  let tunicColor = '#F4EFE4';
  let pantsColor = '#EAE2D0';
  let vestColor = '#C93B32';
  let sashColor = '#D9A94E';
  let skinColor = '#E2A97E';
  let hairColor = '#23192D';
  let bladeGlow = '#A8E6FF';

  if (visualMode === 'monochrome') {
    tunicColor = '#FFB84D';
    pantsColor = '#E69926';
    vestColor = '#B36B00';
    sashColor = '#FFD480';
    skinColor = '#FFA31A';
    hairColor = '#4D2E00';
    bladeGlow = '#FFE099';
  } else if (isShadowTwin) {
    tunicColor = 'rgba(56, 184, 168, 0.75)';
    pantsColor = 'rgba(38, 134, 152, 0.72)';
    vestColor = 'rgba(217, 169, 78, 0.85)';
    sashColor = '#64EBD9';
    skinColor = 'rgba(130, 238, 224, 0.8)';
    hairColor = '#0D1E2D';
    bladeGlow = '#64EBD9';
  } else if (isDarkMirror || role === 'shadow_enemy') {
    tunicColor = '#1E1633';
    pantsColor = '#150F26';
    vestColor = '#7E22CE';
    sashColor = '#F43F5E';
    skinColor = '#7C6C94';
    hairColor = '#090612';
    bladeGlow = '#F43F5E';
  } else if (role === 'guard') {
    tunicColor = actor.guardTint || '#D97736';
    pantsColor = '#2B2244';
    vestColor = actor.guardVest || '#8A2432';
    sashColor = '#F4CC74';
    skinColor = '#C88D62';
    hairColor = '#1B1326';
  } else if (role === 'jaffar') {
    tunicColor = '#191229';
    pantsColor = '#100B1C';
    vestColor = '#991B1B';
    sashColor = '#F4CC74';
    skinColor = '#B8967A';
    hairColor = '#0E0A18';
    bladeGlow = '#F59E0B';
  } else if (role === 'princess') {
    tunicColor = '#38B8A8';
    pantsColor = '#F2E7CF';
    vestColor = '#D9A94E';
    sashColor = '#C93B32';
    skinColor = '#E9B893';
    hairColor = '#1A1128';
  }

  // Ground contact shadow
  if (st !== 'jump_up' && st !== 'run_jump' && st !== 'fall' && st !== 'ledge_hang') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 16, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (isShadowTwin) {
    ctx.shadowColor = '#38B8A8';
    ctx.shadowBlur = 12;
  } else if (role === 'jaffar') {
    ctx.shadowColor = 'rgba(239, 83, 71, 0.5)';
    ctx.shadowBlur = 10;
  }

  // Helper to draw a tapered limb segment + baggy trouser/sleeve puff
  const drawLeg = (thighAngle, shinAngle, isBack) => {
    const hipOriginX = hipX;
    const hipOriginY = hipY;
    const thighLen = 18;
    const shinLen = 18;

    const kneeX = hipOriginX + Math.sin(thighAngle) * thighLen;
    const kneeY = hipOriginY + Math.cos(thighAngle) * thighLen;
    const footX = kneeX + Math.sin(thighAngle - shinAngle) * shinLen;
    const footY = kneeY + Math.cos(thighAngle - shinAngle) * shinLen;

    // Baggy Persian harem trousers (Sirwal)
    ctx.strokeStyle = isBack ? shadeColor(pantsColor, -15) : pantsColor;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hipOriginX, hipOriginY);
    ctx.lineTo(kneeX, kneeY);
    ctx.stroke();

    ctx.lineWidth = 8.5;
    ctx.beginPath();
    ctx.moveTo(kneeX, kneeY);
    ctx.lineTo(footX, footY - 3);
    ctx.stroke();

    // Foot / Boot
    ctx.fillStyle = role === 'prince' ? skinColor : '#2B1D16';
    ctx.beginPath();
    ctx.ellipse(footX + 3.5, footY, 5.5, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  // Back leg
  drawLeg(lThigh, lShin, true);

  // Torso computation
  const torsoLen = 24;
  const shoulderX = hipX + Math.sin(torsoTilt) * torsoLen;
  const shoulderY = hipY - Math.cos(torsoTilt) * torsoLen;

  // Jaffar flowing royal cape
  if (role === 'jaffar') {
    const capeWave = Math.sin(time * 5 + actor.vx * 0.05) * 6;
    ctx.fillStyle = '#58121E';
    ctx.beginPath();
    ctx.moveTo(shoulderX - 4, shoulderY + 2);
    ctx.quadraticCurveTo(hipX - 22, hipY + 8, hipX - 26 + capeWave, -2);
    ctx.lineTo(hipX - 8, -4);
    ctx.closePath();
    ctx.fill();
  }

  // Back arm
  const drawArm = (uAngle, fAngle, isBack, withSword) => {
    const uLen = 14;
    const fLen = 14;
    const elbowX = shoulderX + Math.sin(uAngle) * uLen;
    const elbowY = shoulderY + Math.cos(uAngle) * uLen;
    const handX = elbowX + Math.sin(uAngle + fAngle) * fLen;
    const handY = elbowY + Math.cos(uAngle + fAngle) * fLen;

    ctx.strokeStyle = isBack ? shadeColor(tunicColor, -15) : tunicColor;
    ctx.lineWidth = 6.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY + 3);
    ctx.lineTo(elbowX, elbowY);
    ctx.stroke();

    ctx.strokeStyle = skinColor;
    ctx.lineWidth = 4.8;
    ctx.beginPath();
    ctx.moveTo(elbowX, elbowY);
    ctx.lineTo(handX, handY);
    ctx.stroke();

    if (withSword) {
      ctx.save();
      ctx.translate(handX, handY);
      ctx.rotate(swordAngle);

      // Motion slash trail when striking
      if (swordSlashArc > 0) {
        const grad = ctx.createLinearGradient(0, -28, 38, 12);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        grad.addColorStop(0.6, 'rgba(168, 230, 255, 0.45)');
        grad.addColorStop(1, 'rgba(244, 204, 116, 0.85)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, 36, -1.2, 0.45);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();
      }

      // Brass Crossguard
      ctx.strokeStyle = '#F4CC74';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-2, -5);
      ctx.lineTo(2, 5);
      ctx.stroke();

      // Curved Persian Scimitar Blade
      ctx.strokeStyle = bladeGlow;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(18, 2, 34, -7);
      ctx.stroke();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(2, -0.5);
      ctx.quadraticCurveTo(18, 1, 34, -7);
      ctx.stroke();

      ctx.restore();
    }
  };

  drawArm(lUpperArm, lForeArm, true, false);

  // Torso Tunic + Vest
  ctx.save();
  ctx.translate(hipX, hipY);
  ctx.rotate(torsoTilt);

  // White linen tunic
  ctx.fillStyle = tunicColor;
  ctx.beginPath();
  ctx.roundRect(-8, -torsoLen, 16, torsoLen + 4, 5);
  ctx.fill();

  // Persian Vest / Bolero
  ctx.fillStyle = vestColor;
  ctx.beginPath();
  ctx.roundRect(-8.5, -torsoLen + 1, 17, torsoLen - 6, 4);
  ctx.fill();

  // V-neck collar opening
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.moveTo(-2, -torsoLen);
  ctx.lineTo(4, -torsoLen);
  ctx.lineTo(2, -torsoLen + 8);
  ctx.closePath();
  ctx.fill();

  // Golden / Crimson Waist Sash
  ctx.fillStyle = sashColor;
  ctx.fillRect(-9, -6, 18, 5.5);

  ctx.restore();

  // Front leg
  drawLeg(rThigh, rShin, false);

  // Head & Flowing Headband / Turban
  const headX = shoulderX + Math.sin(torsoTilt + headNod) * 9;
  const headY = shoulderY - Math.cos(torsoTilt + headNod) * 9;

  // Flowing headband tail (Verlet wave behind the Prince)
  const speedFactor = Math.min(1.5, Math.abs(actor.vx || 0) / 140 + 0.35);
  ctx.strokeStyle = role === 'prince' ? '#C93B32' : sashColor;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(headX - 5, headY - 3);
  const tail1X = headX - 15 - speedFactor * 6;
  const tail1Y = headY - 1 + Math.sin(time * 11) * 4;
  const tail2X = headX - 24 - speedFactor * 9;
  const tail2Y = headY + 3 + Math.cos(time * 11) * 5;
  ctx.quadraticCurveTo(tail1X, tail1Y, tail2X, tail2Y);
  ctx.stroke();

  // Head silhouette
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.arc(headX, headY, 6.8, 0, Math.PI * 2);
  ctx.fill();

  // Hair / Beard / Turban
  ctx.fillStyle = hairColor;
  ctx.beginPath();
  ctx.arc(headX - 1.5, headY - 1.5, 6.6, Math.PI * 0.75, Math.PI * 2.05);
  ctx.fill();

  if (role === 'guard' || role === 'jaffar') {
    // Beard
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.arc(headX + 2.5, headY + 3, 4.2, 0, Math.PI);
    ctx.fill();

    // Ornate Turban
    ctx.fillStyle = role === 'jaffar' ? '#171126' : sashColor;
    ctx.beginPath();
    ctx.ellipse(headX, headY - 5.5, 8.5, 5.5, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Ruby clasp & feather on Jaffar
    if (role === 'jaffar') {
      ctx.fillStyle = '#EF5347';
      ctx.beginPath();
      ctx.arc(headX + 5, headY - 6, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#F4CC74';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(headX + 5, headY - 7);
      ctx.quadraticCurveTo(headX + 2, headY - 17, headX - 5, headY - 19);
      ctx.stroke();
    }
  } else {
    // Prince headband ribbon
    ctx.fillStyle = '#C93B32';
    ctx.fillRect(headX - 6.8, headY - 4.5, 13.5, 2.8);
  }

  // Front Sword Arm
  drawArm(rUpperArm, rForeArm, false, showSword);

  ctx.restore();
}

function shadeColor(hex, percent) {
  if (!hex || !hex.startsWith('#') || hex.length !== 7) return hex;
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + percent));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + percent));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
