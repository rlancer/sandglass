import { PrinceGame, TILE_TYPES } from './game.js';

const canvas = document.getElementById('game-canvas');
const titleOverlay = document.getElementById('title-overlay');
const mapOverlay = document.getElementById('map-overlay');
const mapGrid = document.getElementById('map-grid');
const editorBar = document.getElementById('editor-bar');
const editorPalette = document.getElementById('editor-palette');

const roomSectorEl = document.getElementById('room-sector');
const roomTitleEl = document.getElementById('room-title');
const chamberLoreEl = document.getElementById('chamber-lore-text');
const stateBadgeEl = document.getElementById('kinematic-state-badge');
const hudBannerEl = document.getElementById('hud-banner-text');

const princeHeartsEl = document.getElementById('prince-hearts');
const enemyHudBox = document.getElementById('enemy-hud-box');
const enemyHudName = document.getElementById('enemy-hud-name');
const enemyHeartsEl = document.getElementById('enemy-hearts');
const sandBarFill = document.getElementById('sand-bar-fill');
const shadowStatusPill = document.getElementById('shadow-status-pill');
const hourglassTimerEl = document.getElementById('hourglass-timer');

const game = new PrinceGame(canvas, {
  onBanner(msg) {
    hudBannerEl.textContent = msg;
  },
  onRoomChange(room, idx, allRooms) {
    roomSectorEl.textContent = room.sector;
    roomTitleEl.textContent = room.title;
    chamberLoreEl.textContent = room.lore;
    renderQuickJumpButtons(idx);
    renderMapModal(idx, allRooms);
  }
});

// Expose for debugging/inspection
window.__princeGame = game;

// Build Editor Palette Chips
TILE_TYPES.forEach(item => {
  const btn = document.createElement('button');
  btn.className = `palette-chip ${item.code === game.selectedTileCode ? 'active' : ''}`;
  btn.textContent = item.label;
  btn.addEventListener('click', () => {
    game.selectedTileCode = item.code;
    editorPalette.querySelectorAll('.palette-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
  });
  editorPalette.appendChild(btn);
});

function renderMapModal(currentIdx, rooms) {
  mapGrid.innerHTML = '';
  rooms.forEach((rm, idx) => {
    const card = document.createElement('button');
    card.className = `map-room-card ${idx === currentIdx ? 'current' : ''}`;
    card.innerHTML = `
      <span class="room-num">CHAMBER ${idx + 1} · ${rm.theme.toUpperCase()}</span>
      <span class="room-name">${rm.title.replace(/^Room \d+ · /, '')}</span>
      <span class="room-tags">${rm.tags}</span>
    `;
    card.addEventListener('click', () => {
      game.warpToRoom(idx);
      mapOverlay.classList.add('hidden');
      titleOverlay.classList.add('hidden');
      canvas.focus();
    });
    mapGrid.appendChild(card);
  });
}

function renderQuickJumpButtons(currentIdx) {
  document.querySelectorAll('.mini-warp-btn').forEach(btn => {
    const target = Number(btn.dataset.room);
    btn.classList.toggle('active', target === currentIdx);
  });
}

document.querySelectorAll('.mini-warp-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const idx = Number(btn.dataset.room);
    titleOverlay.classList.add('hidden');
    game.warpToRoom(idx);
    canvas.focus();
  });
});

// Vignette Art Switcher on Prologue Card
const titleMuralImg = document.getElementById('title-mural-img');
const prologueCaption = document.getElementById('prologue-caption');
document.querySelectorAll('.vignette-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.vignette-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const artPath = tab.dataset.art.replace(/^\//, "");
    titleMuralImg.src = `${import.meta.env.BASE_URL}${artPath}`;
    prologueCaption.textContent = tab.dataset.caption;
  });
});

// Start Buttons
document.getElementById('btn-start-game').addEventListener('click', () => {
  titleOverlay.classList.add('hidden');
  game.sound.init();
  game.sound.startAmbientMotif();
  canvas.focus();
});

document.getElementById('btn-start-combat-arena').addEventListener('click', () => {
  titleOverlay.classList.add('hidden');
  game.sound.init();
  game.sound.startAmbientMotif();
  game.warpToRoom(2, true);
  game.setBanner('SWORD DUEL · PRESS [UP] TO PARRY SLASHES AND [SPACE] TO COUNTER-STRIKE!');
  canvas.focus();
});

// Top Header Buttons
document.getElementById('btn-story').addEventListener('click', () => {
  titleOverlay.classList.toggle('hidden');
});

document.getElementById('btn-map').addEventListener('click', () => {
  renderMapModal(game.currentRoomIndex, game.rooms);
  mapOverlay.classList.toggle('hidden');
});

document.getElementById('btn-close-map').addEventListener('click', () => {
  mapOverlay.classList.add('hidden');
  canvas.focus();
});

function toggleEditor() {
  game.editorActive = !game.editorActive;
  editorBar.classList.toggle('hidden', !game.editorActive);
  document.getElementById('btn-editor').classList.toggle('active', game.editorActive);
  if (game.editorActive) {
    titleOverlay.classList.add('hidden');
    game.setBanner('ARCHITECT MODE ACTIVE · CLICK TILES ON THE 10×3 GRID TO PLACE TRAPS OR WALLS');
  }
}

document.getElementById('btn-editor').addEventListener('click', toggleEditor);
document.getElementById('btn-editor-close').addEventListener('click', toggleEditor);
document.getElementById('btn-editor-add-guard').addEventListener('click', () => {
  game.toggleRoomGuardInEditor();
});
document.getElementById('btn-editor-reset').addEventListener('click', () => {
  game.restartCurrentRoom();
});

document.getElementById('btn-visual-mode').addEventListener('click', () => {
  const label = game.cycleVisualMode();
  document.getElementById('visual-mode-label').textContent = label;
});

document.getElementById('btn-audio').addEventListener('click', e => {
  const on = game.sound.toggle();
  document.getElementById('audio-label').textContent = `Audio: ${on ? 'ON' : 'OFF'}`;
  e.currentTarget.classList.toggle('active', on);
});

document.getElementById('btn-restart-room').addEventListener('click', () => {
  game.restartCurrentRoom();
  canvas.focus();
});

// Canvas Editor Mouse Interaction
canvas.addEventListener('mousedown', e => {
  if (!game.editorActive) return;
  e.preventDefault();
  game.handleCanvasEditClick(e.clientX, e.clientY, e.button === 2);
});
canvas.addEventListener('contextmenu', e => {
  if (game.editorActive) e.preventDefault();
});

// Global Keyboard Handling
window.addEventListener('keydown', e => {
  if (e.code === 'Escape') {
    mapOverlay.classList.add('hidden');
    titleOverlay.classList.add('hidden');
    return;
  }
  if (e.code === 'KeyM') {
    renderMapModal(game.currentRoomIndex, game.rooms);
    mapOverlay.classList.toggle('hidden');
    return;
  }
  if (e.code === 'KeyL') {
    toggleEditor();
    return;
  }
  if (e.code === 'KeyV') {
    const label = game.cycleVisualMode();
    document.getElementById('visual-mode-label').textContent = label;
    return;
  }
  if (e.code === 'KeyN') {
    const on = game.sound.toggle();
    document.getElementById('audio-label').textContent = `Audio: ${on ? 'ON' : 'OFF'}`;
    document.getElementById('btn-audio').classList.toggle('active', on);
    return;
  }

  // Prevent arrow/space page scrolling while playing
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
    e.preventDefault();
  }

  if (!titleOverlay.classList.contains('hidden') && (e.code === 'Enter' || e.code === 'Space')) {
    titleOverlay.classList.add('hidden');
    game.sound.init();
    game.sound.startAmbientMotif();
    return;
  }

  game.onKeyDown(e.code);
});

window.addEventListener('keyup', e => {
  game.onKeyUp(e.code);
});

// Sync 1989 Status Strip DOM
function updateHudDom() {
  const p = game.prince;

  // Prince health triangles
  let pHtml = '';
  for (let i = 0; i < p.maxHp; i++) {
    pHtml += `<span class="life-triangle ${i < p.hp ? '' : 'empty'}"></span>`;
  }
  if (princeHeartsEl.dataset.prev !== pHtml) {
    princeHeartsEl.innerHTML = pHtml;
    princeHeartsEl.dataset.prev = pHtml;
  }

  // Sand bar & Shadow Twin indicator
  sandBarFill.style.width = `${Math.round(game.sandEnergy)}%`;
  if (game.shadowTwin) {
    shadowStatusPill.textContent = `SHADOW [Q SWAP]: ${game.shadowTwin.ttl.toFixed(1)}s`;
    shadowStatusPill.classList.add('active');
  } else {
    shadowStatusPill.textContent =
      game.sandEnergy >= 20 ? 'SHADOW [E]: READY' : 'SHADOW: RECHARGING';
    shadowStatusPill.classList.remove('active');
  }

  // Kinematic state badge
  const prettyState = (p.state || 'idle').toUpperCase().replace('_', ' ');
  stateBadgeEl.textContent = `STATE: ${prettyState}`;

  // Enemy health triangles on right wing
  const enemy = game.getActiveEnemy();
  if (enemy && enemy.hp > 0) {
    enemyHudBox.classList.remove('hidden');
    enemyHudName.textContent = enemy.name;
    let eHtml = '';
    for (let i = 0; i < enemy.maxHp; i++) {
      eHtml += `<span class="life-triangle ${i < enemy.hp ? '' : 'empty'}"></span>`;
    }
    if (enemyHeartsEl.dataset.prev !== eHtml) {
      enemyHeartsEl.innerHTML = eHtml;
      enemyHeartsEl.dataset.prev = eHtml;
    }
  } else {
    enemyHudBox.classList.add('hidden');
  }

  // Hourglass MM:SS countdown
  const mins = Math.floor(game.remainingSeconds / 60);
  const secs = Math.floor(game.remainingSeconds % 60);
  hourglassTimerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Main 60fps Fixed-Step Game Loop
let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  game.update(dt);
  game.render();
  updateHudDom();

  requestAnimationFrame(frame);
}

game.notifyRoomChanged();
requestAnimationFrame(frame);
