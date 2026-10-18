// Core 1989 Prince of Persia + Astral Hourglass Gameplay, Physics, Traps, Combat & Renderer

import { INITIAL_ROOMS, TILE_TYPES } from './levels.js';
import { renderCharacter } from './kinematics.js';
import { SoundEngine } from './audio.js';

const CANVAS_W = 960;
const CANVAS_H = 576;
const COLS = 10;
const ROWS = 3;
const TILE_W = 96; // 10 * 96 = 960
const TIER_H = 176; // 3 * 176 = 528
const TOP_MARGIN = 36;

export class PrinceGame {
  constructor(canvas, uiCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ui = uiCallbacks;
    this.sound = new SoundEngine();

    // Load generated Persian pixel-painted backdrops
    this.bgImages = {
      palace: new Image(),
      princess: new Image(),
      jaffar: new Image()
    };
    const base = import.meta.env.BASE_URL;
    this.bgImages.palace.src = `${base}assets/palace-bg.png`;
    this.bgImages.princess.src = `${base}assets/princess-chamber.png`;
    this.bgImages.jaffar.src = `${base}assets/jaffar-portrait.png`;

    this.visualModes = ['illuminated', 'vga1989', 'monochrome'];
    this.visualModeIndex = 0;

    this.keys = {
      left: false,
      right: false,
      up: false,
      down: false,
      shift: false,
      space: false,
      rewind: false
    };

    this.editorActive = false;
    this.selectedTileCode = 'S';

    this.time = 0;
    this.remainingSeconds = 60 * 60; // Classic 60:00 Hourglass
    this.sandEnergy = 100; // 0..100 for Rewind & Shadow Twin
    this.featherFallTimer = 0;
    this.gameWon = false;

    this.particles = [];
    this.floatingTexts = [];
    this.rewindBuffer = []; // Stores last 360 frames (6 seconds) of state
    this.princeHistory = []; // Stores Prince's recent 300 frames for Shadow Twin

    this.shadowTwin = null; // Active spectral echo { history, cursor, x, y, facing, state, animTime }

    this.resetCampaign();
  }

  get visualMode() {
    return this.visualModes[this.visualModeIndex];
  }

  cycleVisualMode() {
    this.visualModeIndex = (this.visualModeIndex + 1) % this.visualModes.length;
    const labels = {
      illuminated: 'Mode: Illuminated VGA',
      vga1989: 'Mode: 1989 Crisp DOS',
      monochrome: 'Mode: Amber Hercules'
    };
    return labels[this.visualMode];
  }

  resetCampaign() {
    // Deep clone rooms so runtime trap states (loose tiles, open gates, drunk potions) are mutable
    this.rooms = JSON.parse(JSON.stringify(INITIAL_ROOMS));
    this.rooms.forEach(room => this.initRoomRuntime(room));

    this.currentRoomIndex = 0;
    this.hasSword = false;
    this.gameWon = false;
    this.sandEnergy = 100;
    this.featherFallTimer = 0;

    const startRoom = this.rooms[0];
    this.prince = {
      role: 'prince',
      x: (startRoom.spawn.col + 0.5) * TILE_W,
      y: this.getFloorY(startRoom.spawn.row),
      vx: 0,
      vy: 0,
      facing: startRoom.spawn.facing || 1,
      state: 'idle',
      animTime: 0,
      hp: 3,
      maxHp: 3,
      grounded: true,
      swordDrawn: false,
      fallStartY: this.getFloorY(startRoom.spawn.row),
      hangCell: null,
      strikeCooldown: 0,
      parryWindow: 0,
      invulnTimer: 0
    };

    this.shadowTwin = null;
    this.rewindBuffer = [];
    this.princeHistory = [];
    this.notifyRoomChanged();
    this.setBanner('THE SULTAN IS AT WAR · 60 MINUTES REMAIN IN THE ASTRAL HOURGLASS');
  }

  initRoomRuntime(room) {
    room.gates = [];
    room.plates = [];
    room.looseTiles = [];
    room.fallingSlabs = [];
    room.spikes = [];
    room.chompers = [];
    room.mirrorBroken = false;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const code = room.grid[r][c];
        if (code === 'G' || code === 'E') {
          room.gates.push({
            row: r,
            col: c,
            isExit: code === 'E',
            openAmount: 0, // 0 = closed, 1 = fully raised
            holdTimer: 0,
            lockedOpen: false
          });
        } else if (code === 'B') {
          room.plates.push({
            row: r,
            col: c,
            depressed: false,
            rubblePinned: false
          });
        } else if (code === 'L') {
          room.looseTiles.push({
            row: r,
            col: c,
            wobble: 0,
            triggered: false
          });
        } else if (code === 'S') {
          room.spikes.push({
            row: r,
            col: c,
            extension: 0,
            cooldown: 0
          });
        } else if (code === 'C') {
          room.chompers.push({
            row: r,
            col: c,
            phase: (c * 0.37 + r * 0.5) % 1.4,
            closedAmount: 0
          });
        }
      }
    }

    room.liveGuards = (room.guards || []).map(g => ({
      role: g.role || 'guard',
      name: g.name || 'PALACE GUARD',
      x: (g.col + 0.5) * TILE_W,
      y: this.getFloorY(g.row),
      row: g.row,
      vx: 0,
      facing: g.facing || -1,
      hp: g.hp || 3,
      maxHp: g.maxHp || 3,
      skill: g.skill || 0.6,
      guardTint: g.tint || '#D97736',
      guardVest: g.vest || '#8A2432',
      state: 'sword_idle',
      animTime: 0,
      swordDrawn: true,
      aiCooldown: 0.4,
      parryWindow: 0
    }));
  }

  get currentRoom() {
    return this.rooms[this.currentRoomIndex];
  }

  getFloorY(row) {
    return TOP_MARGIN + (row + 1) * TIER_H;
  }

  getCellAt(x, y) {
    const col = Math.floor(x / TILE_W);
    const row = Math.floor((y - TOP_MARGIN - 8) / TIER_H);
    return {
      col: Math.max(0, Math.min(COLS - 1, col)),
      row: Math.max(0, Math.min(ROWS - 1, row))
    };
  }

  hasFloorSupport(room, row, col) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
    const code = room.grid[row][col];
    return code !== '.';
  }

  isWallBlocked(room, row, col, x) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
    const code = room.grid[row][col];
    if (code === '#') return true;
    if (code === 'G') {
      const gate = room.gates.find(g => g.row === row && g.col === col);
      if (gate && gate.openAmount < 0.68) {
        // Gate iron bars sit on the right side of the cell
        const gateX = col * TILE_W + TILE_W * 0.55;
        if (Math.abs(x - gateX) < 16) return true;
      }
    }
    return false;
  }

  warpToRoom(roomIdx, startCombatDemo = false) {
    if (roomIdx < 0 || roomIdx >= this.rooms.length) return;
    this.currentRoomIndex = roomIdx;
    const room = this.currentRoom;
    if (roomIdx >= 2 || startCombatDemo) {
      this.hasSword = true;
    }

    const sp = room.spawn || { col: 1, row: 2, facing: 1 };
    this.prince.x = (sp.col + 0.5) * TILE_W;
    this.prince.y = this.getFloorY(sp.row);
    this.prince.vx = 0;
    this.prince.vy = 0;
    this.prince.facing = sp.facing || 1;
    this.prince.grounded = true;
    this.prince.state = 'idle';
    this.prince.fallStartY = this.prince.y;
    this.prince.hangCell = null;
    if (this.prince.hp <= 0) {
      this.prince.hp = this.prince.maxHp;
    }

    this.shadowTwin = null;
    this.princeHistory = [];
    this.notifyRoomChanged();
  }

  restartCurrentRoom() {
    const freshTemplate = JSON.parse(JSON.stringify(INITIAL_ROOMS[this.currentRoomIndex]));
    this.initRoomRuntime(freshTemplate);
    this.rooms[this.currentRoomIndex] = freshTemplate;
    this.prince.hp = this.prince.maxHp;
    this.warpToRoom(this.currentRoomIndex);
    this.setBanner('CHAMBER TIMELINE RESTORED');
  }

  spawnShadowTwin() {
    if (this.prince.state === 'dead') return;
    if (this.shadowTwin) {
      // Dismiss existing twin
      this.spawnParticles(this.shadowTwin.x, this.shadowTwin.y - 36, '#64EBD9', 18);
      this.shadowTwin = null;
      this.setBanner('SHADOW TWIN DISMISSED');
      return;
    }

    if (this.sandEnergy < 20) {
      this.setBanner('NOT ENOUGH ASTRAL SAND FOR SHADOW TWIN');
      return;
    }

    this.sandEnergy = Math.max(0, this.sandEnergy - 22);
    this.sound.playShadowManifest();

    // Clone recent 240 frames (4 seconds) or spawn stationary decoy on current spot
    const historySlice =
      this.princeHistory.length > 20
        ? this.princeHistory.slice(-240).map(f => ({ ...f }))
        : [
            {
              x: this.prince.x,
              y: this.prince.y,
              facing: this.prince.facing,
              state: 'idle',
              animTime: 0,
              swordDrawn: this.prince.swordDrawn
            }
          ];

    // Also include current spot hold at end so twin stays on pressure plates!
    const lastFrame = historySlice[historySlice.length - 1];
    for (let i = 0; i < 150; i++) {
      historySlice.push({ ...lastFrame, state: 'idle' });
    }

    this.shadowTwin = {
      role: 'prince',
      history: historySlice,
      cursor: Math.max(0, historySlice.length - 180),
      x: this.prince.x,
      y: this.prince.y,
      facing: this.prince.facing,
      state: this.prince.state,
      animTime: this.prince.animTime,
      swordDrawn: this.prince.swordDrawn,
      ttl: 9.0 // Stays active for 9 seconds holding plates or flanking guards
    };

    this.spawnParticles(this.prince.x, this.prince.y - 38, '#64EBD9', 26);
    this.addFloatingText(this.prince.x, this.prince.y - 78, 'SHADOW TWIN MANIFESTED [Q TO SWAP]', '#64EBD9');
    this.setBanner('SHADOW TWIN ACTIVE · IT HOLDS PLATES & FLANKS GUARDS · PRESS [Q] TO SWAP BODIES');
  }

  swapWithShadowTwin() {
    if (!this.shadowTwin || this.prince.state === 'dead') {
      this.setBanner('MANIFEST SHADOW TWIN WITH [E] BEFORE SWAPPING WITH [Q]');
      return;
    }

    this.sound.playShadowManifest();
    this.spawnParticles(this.prince.x, this.prince.y - 36, '#F4CC74', 22);
    this.spawnParticles(this.shadowTwin.x, this.shadowTwin.y - 36, '#64EBD9', 22);

    const tx = this.prince.x;
    const ty = this.prince.y;
    const tf = this.prince.facing;

    this.prince.x = this.shadowTwin.x;
    this.prince.y = this.shadowTwin.y;
    this.prince.facing = this.shadowTwin.facing;
    this.prince.vx = 0;
    this.prince.vy = 0;
    this.prince.fallStartY = this.prince.y;

    this.shadowTwin.x = tx;
    this.shadowTwin.y = ty;
    this.shadowTwin.facing = tf;
    // Pin the twin at the swapped position so it keeps holding plates!
    this.shadowTwin.history = [
      {
        x: tx,
        y: ty,
        facing: tf,
        state: 'idle',
        animTime: 0,
        swordDrawn: this.prince.swordDrawn
      }
    ];
    this.shadowTwin.cursor = 0;

    this.addFloatingText(this.prince.x, this.prince.y - 78, 'ASTRAL SWAP!', '#F4CC74');
    this.setBanner('SWAPPED BODIES ACROSS SPACE WITH YOUR SHADOW TWIN!');
  }

  setBanner(msg) {
    if (this.ui && this.ui.onBanner) {
      this.ui.onBanner(msg);
    }
  }

  notifyRoomChanged() {
    if (this.ui && this.ui.onRoomChange) {
      this.ui.onRoomChange(this.currentRoom, this.currentRoomIndex, this.rooms);
    }
  }

  spawnParticles(x, y, color, count = 14, speed = 130) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const mag = (0.25 + Math.random() * 0.75) * speed;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * mag,
        vy: Math.sin(angle) * mag - 35,
        color,
        size: 2 + Math.random() * 3.5,
        life: 0.35 + Math.random() * 0.45,
        maxLife: 0.8
      });
    }
  }

  addFloatingText(x, y, text, color = '#F4CC74') {
    this.floatingTexts.push({
      x,
      y,
      text,
      color,
      life: 1.25
    });
  }

  onKeyDown(code) {
    this.sound.init();
    this.sound.startAmbientMotif();

    if (code === 'ArrowLeft' || code === 'KeyA') this.keys.left = true;
    if (code === 'ArrowRight' || code === 'KeyD') this.keys.right = true;
    if (code === 'ArrowUp' || code === 'KeyW') {
      this.keys.up = true;
      this.handleUpTrigger();
    }
    if (code === 'ArrowDown' || code === 'KeyS') {
      this.keys.down = true;
      this.handleDownTrigger();
    }
    if (code === 'ShiftLeft' || code === 'ShiftRight') {
      this.keys.shift = true;
      this.handleActionTrigger(true);
    }
    if (code === 'Space') {
      this.keys.space = true;
      this.handleActionTrigger(false);
    }
    if (code === 'KeyR') {
      this.keys.rewind = true;
    }
    if (code === 'KeyE') {
      this.spawnShadowTwin();
    }
    if (code === 'KeyQ') {
      this.swapWithShadowTwin();
    }
    if (code === 'KeyK') {
      this.restartCurrentRoom();
    }
  }

  onKeyUp(code) {
    if (code === 'ArrowLeft' || code === 'KeyA') this.keys.left = false;
    if (code === 'ArrowRight' || code === 'KeyD') this.keys.right = false;
    if (code === 'ArrowUp' || code === 'KeyW') this.keys.up = false;
    if (code === 'ArrowDown' || code === 'KeyS') this.keys.down = false;
    if (code === 'ShiftLeft' || code === 'ShiftRight') this.keys.shift = false;
    if (code === 'Space') this.keys.space = false;
    if (code === 'KeyR') this.keys.rewind = false;
  }

  handleUpTrigger() {
    const p = this.prince;
    if (p.state === 'dead') return;

    // 1. If hanging from a ledge, climb up!
    if (p.state === 'ledge_hang' && p.hangCell) {
      p.state = 'ledge_climb';
      p.animTime = 0;
      this.sound.playJump();
      return;
    }

    // 2. If in sword combat, UP triggers overhead Parry!
    const activeEnemy = this.getActiveEnemy();
    if (activeEnemy && p.grounded && Math.abs(activeEnemy.y - p.y) < 30 && Math.abs(activeEnemy.x - p.x) < 220) {
      p.swordDrawn = true;
      p.state = 'sword_parry';
      p.animTime = 0;
      p.parryWindow = 0.38;
      this.sound.playSwordClash(true);
      return;
    }

    // 3. If grounded, either climb up a ledge directly above or Jump!
    if (p.grounded) {
      const cell = this.getCellAt(p.x, p.y - 12);
      const room = this.currentRoom;

      // Check if there is a climbable ledge opening on row - 1
      if (cell.row > 0) {
        const upRow = cell.row - 1;
        const targetCol = Math.max(0, Math.min(COLS - 1, cell.col + p.facing));
        const directlyAboveOpen = !this.hasFloorSupport(room, upRow, cell.col);
        const adjacentAboveSolid =
          this.hasFloorSupport(room, upRow, targetCol) && room.grid[upRow][targetCol] !== '#';
        const currentAboveSolid =
          this.hasFloorSupport(room, upRow, cell.col) && room.grid[upRow][cell.col] !== '#';

        if ((directlyAboveOpen && adjacentAboveSolid) || currentAboveSolid) {
          const climbCol = adjacentAboveSolid && directlyAboveOpen ? targetCol : cell.col;
          p.hangCell = { row: upRow, col: climbCol };
          p.x = (climbCol + 0.5 - p.facing * 0.25) * TILE_W;
          p.y = this.getFloorY(upRow) + 46;
          p.vx = 0;
          p.vy = 0;
          p.grounded = false;
          p.state = 'ledge_hang';
          p.animTime = 0;
          this.sound.playGrab();
          return;
        }
      }

      // Standing or Running Horizontal Leap
      this.sound.playJump();
      p.grounded = false;
      p.fallStartY = p.y;
      if (Math.abs(p.vx) > 95 || this.keys.left || this.keys.right) {
        p.state = 'run_jump';
        const dir = this.keys.right ? 1 : this.keys.left ? -1 : p.facing;
        p.facing = dir;
        p.vx = dir * 248;
        p.vy = -375;
      } else {
        p.state = 'jump_up';
        p.vx = p.facing * 95;
        p.vy = -395;
      }
      p.animTime = 0;
    }
  }

  handleDownTrigger() {
    const p = this.prince;
    if (p.state === 'dead') return;

    if (p.state === 'ledge_hang') {
      // Drop from ledge safely
      p.state = 'fall';
      p.fallStartY = p.y;
      p.hangCell = null;
      return;
    }

    if (p.swordDrawn) {
      p.swordDrawn = false;
      p.state = 'idle';
      this.setBanner('SCIMITAR SHEATHED · FULL ACROBATICS ENABLED');
      return;
    }

    // Check if standing near a drop edge to climb down into a ledge hang
    if (p.grounded) {
      const room = this.currentRoom;
      const cell = this.getCellAt(p.x, p.y - 10);
      const behindCol = cell.col - p.facing;
      const aheadCol = cell.col + p.facing;
      if (aheadCol >= 0 && aheadCol < COLS && !this.hasFloorSupport(room, cell.row, aheadCol)) {
        // Turn and hang on current tile edge
        p.facing = -p.facing;
        p.hangCell = { row: cell.row, col: cell.col };
        p.x = (cell.col + 0.5 - p.facing * 0.35) * TILE_W;
        p.y = this.getFloorY(cell.row) + 46;
        p.vx = 0;
        p.vy = 0;
        p.grounded = false;
        p.state = 'ledge_hang';
        this.sound.playGrab();
        return;
      } else if (behindCol >= 0 && behindCol < COLS && !this.hasFloorSupport(room, cell.row, behindCol)) {
        p.hangCell = { row: cell.row, col: cell.col };
        p.x = (cell.col + 0.5 - p.facing * 0.35) * TILE_W;
        p.y = this.getFloorY(cell.row) + 46;
        p.vx = 0;
        p.vy = 0;
        p.grounded = false;
        p.state = 'ledge_hang';
        this.sound.playGrab();
        return;
      }

      // Check for potion or sword pickup on current tile
      if (this.tryPickupItemAtCell(cell.row, cell.col)) {
        return;
      }

      p.state = 'crouch';
      p.vx = 0;
      p.animTime = 0;
    }
  }

  handleActionTrigger(fromShift) {
    const p = this.prince;
    if (p.state === 'dead') return;

    // 1. Check item pickup on current floor cell first
    if (p.grounded) {
      const cell = this.getCellAt(p.x, p.y - 10);
      if (this.tryPickupItemAtCell(cell.row, cell.col)) {
        return;
      }
    }

    // 2. If enemy nearby or Space pressed with sword unlocked, perform Scimitar Lunge Strike!
    const enemy = this.getActiveEnemy();
    if (this.hasSword && (!fromShift || enemy)) {
      if (p.grounded && p.strikeCooldown <= 0) {
        p.swordDrawn = true;
        p.state = 'sword_strike';
        p.animTime = 0;
        p.strikeCooldown = 0.32;
        this.resolvePrinceStrike();
        return;
      }
    }

    // 3. Careful step probe if Shift + Left/Right held while grounded
    if (fromShift && p.grounded && (this.keys.left || this.keys.right)) {
      const dir = this.keys.right ? 1 : -1;
      p.facing = dir;
      p.state = 'careful_step';
      p.animTime = 0;
      this.sound.playStep(true);
    }
  }

  tryPickupItemAtCell(row, col) {
    const room = this.currentRoom;
    const code = room.grid[row]?.[col];
    const p = this.prince;

    if (code === 'K') {
      room.grid[row][col] = '_';
      this.hasSword = true;
      p.swordDrawn = true;
      this.sound.playPotion(true);
      this.spawnParticles((col + 0.5) * TILE_W, this.getFloorY(row) - 18, '#F4CC74', 28);
      this.addFloatingText(p.x, p.y - 75, 'PERSIAN SCIMITAR ACQUIRED!', '#F4CC74');
      this.setBanner('SCIMITAR DRAWN! PRESS [UP] TO PARRY SLASHES AND [SPACE] TO STRIKE');
      return true;
    }

    if (code === 'R' || code === 'V' || code === 'X' || code === 'F') {
      room.grid[row][col] = '_';
      p.state = 'drink';
      p.animTime = 0;
      p.vx = 0;

      if (code === 'R') {
        p.hp = Math.min(p.maxHp, p.hp + 1);
        this.sound.playPotion(true);
        this.spawnParticles(p.x, p.y - 24, '#EF5347', 22);
        this.addFloatingText(p.x, p.y - 72, '+1 LIFE RESTORED', '#EF5347');
        this.setBanner('CRIMSON ELIXIR · HEALTH TRIANGLE RESTORED');
      } else if (code === 'V') {
        p.maxHp = Math.min(8, p.maxHp + 1);
        p.hp = p.maxHp;
        this.sound.playPotion(true);
        this.spawnParticles(p.x, p.y - 28, '#F4CC74', 32);
        this.addFloatingText(p.x, p.y - 75, 'MAX LIFE INCREASED & FULL HEAL!', '#F4CC74');
        this.setBanner('GOLDEN VESSEL OF HORMAZ · MAXIMUM LIFE TRIANGLES EXTENDED!');
      } else if (code === 'X') {
        p.hp = Math.max(1, p.hp - 1);
        this.sound.playPotion(false);
        this.spawnParticles(p.x, p.y - 24, '#3B82F6', 22);
        this.addFloatingText(p.x, p.y - 72, 'POISON VIAL! -1 LIFE', '#60A5FA');
        this.setBanner('COBALT VIAL · JAFFAR’S BITTER POISON DRAINED ONE LIFE TRIANGLE');
      } else if (code === 'F') {
        this.featherFallTimer = 14.0;
        this.sound.playPotion(true);
        this.spawnParticles(p.x, p.y - 28, '#34D399', 28);
        this.addFloatingText(p.x, p.y - 75, 'FEATHER FALL (14s)', '#34D399');
        this.setBanner('EMERALD VAPOR · WEIGHTLESS FEATHER-FALL ACTIVE FOR 14 SECONDS');
      }
      return true;
    }

    return false;
  }

  getActiveEnemy() {
    const room = this.currentRoom;
    const p = this.prince;
    let closest = null;
    let bestDist = Infinity;
    for (const g of room.liveGuards) {
      if (g.hp <= 0) continue;
      const dy = Math.abs(g.y - p.y);
      const dx = Math.abs(g.x - p.x);
      if (dy < 40 && dx < bestDist) {
        bestDist = dx;
        closest = g;
      }
    }
    return closest;
  }

  resolvePrinceStrike() {
    const p = this.prince;
    const enemy = this.getActiveEnemy();
    if (!enemy) {
      this.sound.playSwordClash(false);
      return;
    }

    const dx = enemy.x - p.x;
    const facingEnemy = Math.sign(dx) === p.facing || Math.abs(dx) < 20;
    const dist = Math.abs(dx);

    if (facingEnemy && dist < 88) {
      // Check if Shadow Twin is flanking the guard from the opposite side
      const flankedByTwin =
        this.shadowTwin &&
        Math.abs(this.shadowTwin.y - enemy.y) < 35 &&
        Math.abs(this.shadowTwin.x - enemy.x) < 90 &&
        Math.sign(enemy.x - this.shadowTwin.x) !== Math.sign(enemy.x - p.x);

      // Guard tries to parry unless staggered by a Prince Parry or flanked by Shadow Twin
      const canGuardParry =
        !flankedByTwin && enemy.parryWindow >= 0 && Math.random() < enemy.skill * 0.55;

      if (canGuardParry) {
        enemy.state = 'sword_parry';
        enemy.animTime = 0;
        p.x -= p.facing * 14;
        this.sound.playSwordClash(true);
        this.spawnParticles((p.x + enemy.x) * 0.5, p.y - 44, '#F4CC74', 16);
        this.addFloatingText(enemy.x, enemy.y - 82, 'PARRIED!', '#F4CC74');
      } else {
        const dmg = flankedByTwin ? 2 : 1;
        enemy.hp = Math.max(0, enemy.hp - dmg);
        enemy.state = enemy.hp <= 0 ? 'dead' : 'sword_hit';
        enemy.animTime = 0;
        enemy.x += p.facing * 24;
        this.sound.playHit(enemy.hp <= 0);
        this.spawnParticles(enemy.x, enemy.y - 40, '#EF5347', 22);
        this.addFloatingText(
          enemy.x,
          enemy.y - 82,
          flankedByTwin ? 'SHADOW FLANK HIT! -2' : 'DIRECT HIT!',
          '#EF5347'
        );

        if (enemy.hp <= 0) {
          this.sandEnergy = Math.min(100, this.sandEnergy + 35);
          if (enemy.role === 'jaffar') {
            // Jaffar defeated! Open all gates in Throne Room
            this.currentRoom.gates.forEach(g => {
              g.lockedOpen = true;
              g.openAmount = 1;
            });
            this.setBanner('GRAND VIZIER JAFFAR VANQUISHED! PROCEED RIGHT TO THE PRINCESS & HOURGLASS!');
          } else {
            this.setBanner(`${enemy.name} DEFEATED · +35 ASTRAL SAND RECOVERED`);
          }
        }
      }
    } else {
      this.sound.playSwordClash(false);
    }
  }

  damagePrince(amount, reasonText) {
    const p = this.prince;
    if (p.state === 'dead' || p.invulnTimer > 0) return;

    p.hp = Math.max(0, p.hp - amount);
    p.invulnTimer = 0.65;
    this.sound.playHit(p.hp <= 0);
    this.spawnParticles(p.x, p.y - 36, '#EF5347', 24);

    if (p.hp <= 0) {
      p.state = 'dead';
      p.vx = 0;
      p.animTime = 0;
      this.addFloatingText(p.x, p.y - 72, 'HOLD [R] TO REWIND TIME OR [K] TO RETRY', '#F4CC74');
      this.setBanner(`${reasonText} · HOLD [R] TO REWIND FATE OR PRESS [K] TO RESTART CHAMBER`);
    } else {
      p.state = 'hard_land';
      p.animTime = 0;
      this.addFloatingText(p.x, p.y - 72, `-${amount} LIFE`, '#EF5347');
      this.setBanner(reasonText);
    }
  }

  captureRewindSnapshot() {
    const room = this.currentRoom;
    return {
      roomIdx: this.currentRoomIndex,
      prince: { ...this.prince, hangCell: this.prince.hangCell ? { ...this.prince.hangCell } : null },
      gates: room.gates.map(g => ({ ...g })),
      plates: room.plates.map(pl => ({ ...pl })),
      looseTiles: room.looseTiles.map(lt => ({ ...lt })),
      fallingSlabs: room.fallingSlabs.map(fs => ({ ...fs })),
      guards: room.liveGuards.map(g => ({ ...g })),
      grid: room.grid.map(row => [...row])
    };
  }

  restoreRewindSnapshot(snap) {
    if (snap.roomIdx !== this.currentRoomIndex) {
      this.currentRoomIndex = snap.roomIdx;
      this.notifyRoomChanged();
    }
    const room = this.currentRoom;
    this.prince = { ...snap.prince };
    room.gates = snap.gates.map(g => ({ ...g }));
    room.plates = snap.plates.map(pl => ({ ...pl }));
    room.looseTiles = snap.looseTiles.map(lt => ({ ...lt }));
    room.fallingSlabs = snap.fallingSlabs.map(fs => ({ ...fs }));
    room.liveGuards = snap.guards.map(g => ({ ...g }));
    room.grid = snap.grid.map(row => [...row]);
  }

  update(dt) {
    this.time += dt;

    // Handle Astral Hourglass Rewind [Hold R]
    if (this.keys.rewind && this.rewindBuffer.length > 1 && this.sandEnergy > 0.5) {
      // Pop 2 frames per tick for crisp reverse-time effect
      this.rewindBuffer.pop();
      const snap = this.rewindBuffer.pop();
      if (snap) {
        this.restoreRewindSnapshot(snap);
        this.sandEnergy = Math.max(0, this.sandEnergy - dt * 24);
        if (Math.random() < 0.35) {
          this.sound.playRewindPulse();
          this.spawnParticles(this.prince.x, this.prince.y - 36, '#F4CC74', 2, 60);
        }
        this.setBanner('REWINDING THE SANDS OF THE ASTRAL HOURGLASS...');
      }
      this.updateParticles(dt);
      return;
    }

    // Regenerate Sand slowly
    this.sandEnergy = Math.min(100, this.sandEnergy + dt * 3.8);
    if (this.featherFallTimer > 0) {
      this.featherFallTimer = Math.max(0, this.featherFallTimer - dt);
    }
    if (!this.gameWon) {
      this.remainingSeconds = Math.max(0, this.remainingSeconds - dt);
    }

    // Record snapshot every frame (cap at 360 frames = 6 seconds)
    this.rewindBuffer.push(this.captureRewindSnapshot());
    if (this.rewindBuffer.length > 360) {
      this.rewindBuffer.shift();
    }

    // Record Prince trajectory for Shadow Twin
    this.princeHistory.push({
      x: this.prince.x,
      y: this.prince.y,
      facing: this.prince.facing,
      state: this.prince.state,
      animTime: this.prince.animTime,
      swordDrawn: this.prince.swordDrawn
    });
    if (this.princeHistory.length > 300) {
      this.princeHistory.shift();
    }

    this.updatePrince(dt);
    this.updateShadowTwin(dt);
    this.updateRoomTraps(dt);
    this.updateGuards(dt);
    this.updateParticles(dt);
  }

  updatePrince(dt) {
    const p = this.prince;
    const room = this.currentRoom;

    p.animTime += dt;
    if (p.strikeCooldown > 0) p.strikeCooldown = Math.max(0, p.strikeCooldown - dt);
    if (p.parryWindow > 0) p.parryWindow = Math.max(0, p.parryWindow - dt);
    if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);

    if (p.state === 'dead') return;

    // Ledge climb completion
    if (p.state === 'ledge_climb') {
      if (p.animTime >= 0.42 && p.hangCell) {
        p.x = (p.hangCell.col + 0.5) * TILE_W;
        p.y = this.getFloorY(p.hangCell.row);
        p.vx = 0;
        p.vy = 0;
        p.grounded = true;
        p.fallStartY = p.y;
        p.hangCell = null;
        p.state = 'idle';
      }
      return;
    }

    // Ledge hang idle
    if (p.state === 'ledge_hang') {
      if (this.keys.up) {
        this.handleUpTrigger();
      }
      return;
    }

    // Short locked animations (drink, strike, parry, hard_land)
    if (
      (p.state === 'drink' && p.animTime < 0.45) ||
      (p.state === 'sword_strike' && p.animTime < 0.25) ||
      (p.state === 'sword_parry' && p.animTime < 0.28) ||
      (p.state === 'hard_land' && p.animTime < 0.32)
    ) {
      p.vx *= 0.8;
    } else if (p.grounded) {
      const nearbyEnemy = this.getActiveEnemy();
      const inCombatRange =
        this.hasSword &&
        nearbyEnemy &&
        Math.abs(nearbyEnemy.y - p.y) < 30 &&
        Math.abs(nearbyEnemy.x - p.x) < 230;

      if (inCombatRange) {
        p.swordDrawn = true;
        // Face the opponent automatically like 1989 Prince of Persia
        p.facing = nearbyEnemy.x >= p.x ? 1 : -1;
      } else if (!nearbyEnemy) {
        p.swordDrawn = false;
      }

      if (this.keys.down) {
        p.state = 'crouch';
        p.vx = 0;
      } else if (this.keys.left || this.keys.right) {
        const dir = this.keys.right ? 1 : -1;

        if (p.swordDrawn && inCombatRange) {
          // Measured combat footwork
          p.vx = dir * 115;
          p.state = 'sword_advance';
        } else if (this.keys.shift) {
          // 1989 Careful Step: slow tiptoe, safe through spikes, stops at chasm ledges!
          p.facing = dir;
          p.vx = dir * 72;
          p.state = 'careful_step';

          // Check if stepping off an unguarded drop edge—stop right at the brink!
          const nextX = p.x + p.vx * dt * 2.2;
          const curCell = this.getCellAt(p.x, p.y - 10);
          const nextCell = this.getCellAt(nextX, p.y - 10);
          if (nextCell.col !== curCell.col && !this.hasFloorSupport(room, curCell.row, nextCell.col)) {
            p.vx = 0;
            this.setBanner('CAREFUL STEP: STOPPED AT CHASM BRINK (RELEASE SHIFT TO LEAP OR DROP)');
          }
        } else {
          // Full Rotoscoped Run with momentum & skid turn
          if (p.facing !== dir && Math.abs(p.vx) > 120) {
            p.state = 'skid_turn';
            p.facing = dir;
            p.vx = dir * 90;
          } else {
            p.facing = dir;
            p.vx = dir * 215;
            p.state = 'run';
          }
          if (Math.floor((p.animTime - dt) * 7.5) !== Math.floor(p.animTime * 7.5)) {
            this.sound.playStep(false);
          }
        }
      } else {
        p.vx *= 0.72;
        if (Math.abs(p.vx) < 8) p.vx = 0;
        p.state = p.swordDrawn ? 'sword_idle' : 'idle';
      }
    }

    // Horizontal motion + Wall / Closed Gate collision
    const proposedX = p.x + p.vx * dt;
    const checkRow = Math.max(0, Math.min(ROWS - 1, Math.floor((p.y - TOP_MARGIN - 24) / TIER_H)));
    const checkCol = Math.floor((proposedX + Math.sign(p.vx || p.facing) * 14) / TILE_W);

    if (checkCol >= 0 && checkCol < COLS && this.isWallBlocked(room, checkRow, checkCol, proposedX)) {
      p.vx = 0;
    } else {
      p.x = proposedX;
    }

    // Check Magic Mirror leap-through in Room 9!
    const mirrorCell = this.getCellAt(p.x, p.y - 25);
    if (
      room.grid[mirrorCell.row]?.[mirrorCell.col] === 'M' &&
      !room.mirrorBroken &&
      !p.grounded &&
      Math.abs(p.vx) > 80
    ) {
      room.mirrorBroken = true;
      room.grid[mirrorCell.row][mirrorCell.col] = '_';
      this.sound.playSwordClash(true);
      this.spawnParticles(
        (mirrorCell.col + 0.5) * TILE_W,
        this.getFloorY(mirrorCell.row) - 45,
        '#64EBD9',
        45,
        210
      );
      this.addFloatingText(p.x, p.y - 82, 'THE MAGIC MIRROR SHATTERS!', '#64EBD9');
      this.setBanner('YOUR DARK REFLECTION HAS SPLIT FROM THE MIRROR AND STEPPED ONTO THE PLATE!');
      // Spawn Shadow Twin automatically on the room's pressure plate
      const plate = room.plates[0];
      if (plate) {
        const px = (plate.col + 0.5) * TILE_W;
        const py = this.getFloorY(plate.row);
        this.shadowTwin = {
          role: 'prince',
          history: [{ x: px, y: py, facing: -1, state: 'idle', animTime: 0, swordDrawn: false }],
          cursor: 0,
          x: px,
          y: py,
          facing: -1,
          state: 'idle',
          animTime: 0,
          swordDrawn: false,
          ttl: 25.0
        };
      }
    }

    // Check Victory Finale in Room 12 (Astral Hourglass & Princess)
    if (room.grid[checkRow]?.[Math.floor(p.x / TILE_W)] === 'H' && !this.gameWon) {
      this.gameWon = true;
      this.sound.playPotion(true);
      this.spawnParticles(p.x, p.y - 48, '#F4CC74', 55, 220);
      this.addFloatingText(p.x, p.y - 95, 'THE SANDS OF KHORASAN ARE RESTORED!', '#F4CC74');
      this.setBanner('VICTORY! THE PRINCE, HIS SHADOW, AND THE PRINCESS REUNITE BEFORE THE HOURGLASS!');
    }

    // Room transitions (Left / Right screen boundaries)
    if (p.x > CANVAS_W - 10) {
      if (room.neighbors?.right !== undefined) {
        const nextIdx = room.neighbors.right;
        this.currentRoomIndex = nextIdx;
        p.x = 24;
        p.fallStartY = p.y;
        this.shadowTwin = null;
        this.notifyRoomChanged();
        return;
      } else {
        p.x = CANVAS_W - 14;
        p.vx = 0;
      }
    } else if (p.x < 10) {
      if (room.neighbors?.left !== undefined) {
        const prevIdx = room.neighbors.left;
        this.currentRoomIndex = prevIdx;
        p.x = CANVAS_W - 24;
        p.fallStartY = p.y;
        this.shadowTwin = null;
        this.notifyRoomChanged();
        return;
      } else {
        p.x = 14;
        p.vx = 0;
      }
    }

    // Vertical physics & floor support check
    const footCol = Math.max(0, Math.min(COLS - 1, Math.floor(p.x / TILE_W)));
    const currentTier = Math.max(0, Math.min(ROWS - 1, Math.floor((p.y - TOP_MARGIN - 8) / TIER_H)));
    const tierFloorY = this.getFloorY(currentTier);

    if (p.grounded) {
      if (!this.hasFloorSupport(room, currentTier, footCol)) {
        // Stepped over a chasm!
        p.grounded = false;
        p.fallStartY = p.y;
        p.state = this.featherFallTimer > 0 ? 'float_fall' : 'fall';
      } else {
        p.y = tierFloorY;
        p.vy = 0;
      }
    } else {
      const gravity = this.featherFallTimer > 0 && p.vy > 0 ? 220 : 980;
      const prevY = p.y;
      p.vy += gravity * dt;
      if (this.featherFallTimer > 0 && p.vy > 95) {
        p.vy = 95;
        p.state = 'float_fall';
      }
      p.y += p.vy * dt;

      // Check mid-air Ledge Grab if holding Shift or Up while descending past a ledge!
      if (p.vy > 0 && (this.keys.shift || this.keys.up)) {
        for (let r = 0; r < ROWS; r++) {
          const ledgeY = this.getFloorY(r);
          if (Math.abs(p.y - (ledgeY + 38)) < 26) {
            const grabCol = footCol + p.facing;
            if (
              grabCol >= 0 &&
              grabCol < COLS &&
              !this.hasFloorSupport(room, r, footCol) &&
              this.hasFloorSupport(room, r, grabCol) &&
              room.grid[r][grabCol] !== '#'
            ) {
              p.hangCell = { row: r, col: grabCol };
              p.x = (grabCol + 0.5 - p.facing * 0.36) * TILE_W;
              p.y = ledgeY + 46;
              p.vx = 0;
              p.vy = 0;
              p.state = 'ledge_hang';
              p.animTime = 0;
              this.sound.playGrab();
              this.setBanner('LEDGE CAUGHT! PRESS [UP] TO CLIMB UP OR [DOWN] TO DROP');
              return;
            }
          }
        }
      }

      // Check landing on any tier floor
      if (p.vy > 0) {
        for (let r = 0; r < ROWS; r++) {
          const fY = this.getFloorY(r);
          if (prevY <= fY + 10 && p.y >= fY && this.hasFloorSupport(room, r, footCol)) {
            p.y = fY;
            p.vy = 0;
            p.vx *= 0.4;
            p.grounded = true;

            const fallDistance = p.y - p.fallStartY;
            const tileCode = room.grid[r][footCol];

            // Falling onto spikes is immediately lethal
            if (tileCode === 'S' && this.featherFallTimer <= 0) {
              const sp = room.spikes.find(s => s.row === r && s.col === footCol);
              if (sp) sp.extension = 1;
              this.sound.playSpikes();
              this.damagePrince(99, 'IMPALED UPON IRON FLOOR SPIKES');
              return;
            }

            // 1989 Fall height damage rules:
            // 1 story (~176px): safe
            // 2 stories (~352px): -1 HP hard landing
            // >2.5 stories: fatal
            if (this.featherFallTimer <= 0 && fallDistance > TIER_H * 1.65) {
              const dmg = fallDistance > TIER_H * 2.4 ? 3 : 1;
              this.damagePrince(dmg, 'HARD FALL ONTO PALACE FLAGSTONES');
            } else {
              p.state = 'idle';
              this.sound.playStep(false);
            }
            p.fallStartY = p.y;
            break;
          }
        }
      }

      // Bottom abyss pitfall
      if (p.y > CANVAS_H + 30) {
        this.damagePrince(99, 'PLUMMETED INTO THE SUBTERRANEAN ABYSS');
      }
    }
  }

  updateShadowTwin(dt) {
    if (!this.shadowTwin) return;
    this.shadowTwin.ttl -= dt;
    this.shadowTwin.animTime += dt;

    if (this.shadowTwin.cursor < this.shadowTwin.history.length - 1) {
      this.shadowTwin.cursor++;
      const frame = this.shadowTwin.history[this.shadowTwin.cursor];
      if (frame) {
        this.shadowTwin.x = frame.x;
        this.shadowTwin.y = frame.y;
        this.shadowTwin.facing = frame.facing;
        this.shadowTwin.state = frame.state;
        this.shadowTwin.swordDrawn = frame.swordDrawn;
      }
    }

    if (this.shadowTwin.ttl <= 0) {
      this.spawnParticles(this.shadowTwin.x, this.shadowTwin.y - 35, '#64EBD9', 15);
      this.shadowTwin = null;
    }
  }

  updateRoomTraps(dt) {
    const room = this.currentRoom;
    const p = this.prince;
    const pCell = this.getCellAt(p.x, p.y - 10);
    const twinCell = this.shadowTwin ? this.getCellAt(this.shadowTwin.x, this.shadowTwin.y - 10) : null;

    // 1. Loose Floor Tiles (wobble then crash down!)
    for (let i = room.looseTiles.length - 1; i >= 0; i--) {
      const lt = room.looseTiles[i];
      const steppedByPrince = p.grounded && pCell.row === lt.row && pCell.col === lt.col;
      const steppedByTwin = twinCell && twinCell.row === lt.row && twinCell.col === lt.col;

      if ((steppedByPrince || steppedByTwin) && !lt.triggered) {
        lt.triggered = true;
        this.sound.playLooseShake();
      }

      if (lt.triggered) {
        lt.wobble += dt;
        if (lt.wobble >= 0.42) {
          // Detach loose tile into a falling slab!
          room.grid[lt.row][lt.col] = '.';
          room.fallingSlabs.push({
            col: lt.col,
            x: lt.col * TILE_W,
            y: this.getFloorY(lt.row),
            vy: 60
          });
          room.looseTiles.splice(i, 1);
        }
      }
    }

    // 2. Falling Stone Slabs (can land on Pressure Plates below and pin them open!)
    for (let i = room.fallingSlabs.length - 1; i >= 0; i--) {
      const slab = room.fallingSlabs[i];
      slab.vy += 920 * dt;
      slab.y += slab.vy * dt;

      const r = Math.floor((slab.y - TOP_MARGIN - 4) / TIER_H);
      if (r >= 0 && r < ROWS && this.hasFloorSupport(room, r, slab.col)) {
        const floorY = this.getFloorY(r);
        if (slab.y >= floorY) {
          this.sound.playTileCrash();
          this.spawnParticles(slab.x + TILE_W * 0.5, floorY - 6, '#B5A78F', 18);

          // If it lands on a Pressure Plate 'B', pin the plate permanently!
          const plate = room.plates.find(pl => pl.row === r && pl.col === slab.col);
          if (plate) {
            plate.rubblePinned = true;
            plate.depressed = true;
            this.addFloatingText(slab.x + TILE_W * 0.5, floorY - 40, 'PLATE PINNED BY RUBBLE!', '#F4CC74');
            this.setBanner('FALLING LIMESTONE SLAB PINNED THE PRESSURE PLATE OPEN!');
          }
          room.fallingSlabs.splice(i, 1);
          continue;
        }
      }
      if (slab.y > CANVAS_H + 50) {
        room.fallingSlabs.splice(i, 1);
      }
    }

    // 3. Pressure Plates & Linked Portcullis Gates
    let anyPlateActive = false;
    for (const pl of room.plates) {
      const onByPrince = p.grounded && pCell.row === pl.row && pCell.col === pl.col;
      const onByTwin =
        this.shadowTwin &&
        Math.abs(this.shadowTwin.y - this.getFloorY(pl.row)) < 20 &&
        Math.floor(this.shadowTwin.x / TILE_W) === pl.col;

      const nowDepressed = pl.rubblePinned || onByPrince || onByTwin;
      if (nowDepressed && !pl.depressed) {
        this.sound.playPlatePress();
      }
      pl.depressed = nowDepressed;
      if (pl.depressed) anyPlateActive = true;
    }

    for (const gate of room.gates) {
      if (anyPlateActive || gate.lockedOpen) {
        gate.holdTimer = 4.5; // Holds open briefly after stepping off, just like 1989
      } else if (gate.holdTimer > 0) {
        gate.holdTimer = Math.max(0, gate.holdTimer - dt);
      }

      const targetOpen = anyPlateActive || gate.lockedOpen || gate.holdTimer > 0 ? 1 : 0;
      if (gate.openAmount < targetOpen) {
        gate.openAmount = Math.min(1, gate.openAmount + dt * 0.85);
        if (Math.random() < 0.2) this.sound.playGateTick(true);
      } else if (gate.openAmount > targetOpen) {
        gate.openAmount = Math.max(0, gate.openAmount - dt * 0.32);
        if (Math.random() < 0.15) this.sound.playGateTick(false);
      }
    }

    // 4. Floor Spikes (spring out when run across; safe when Careful-Stepping with Shift!)
    for (const sp of room.spikes) {
      const princeInSpikeCell = p.grounded && pCell.row === sp.row && pCell.col === sp.col;
      if (princeInSpikeCell) {
        sp.extension = Math.min(1, sp.extension + dt * 8);
        const isSafeCareful = p.state === 'careful_step' || this.keys.shift || Math.abs(p.vx) < 85;
        if (!isSafeCareful && p.state !== 'dead') {
          this.sound.playSpikes();
          this.damagePrince(2, 'FLOOR SPIKES! HOLD [SHIFT] TO STEP SAFELY THROUGH SPIKES');
        }
      } else {
        sp.extension = Math.max(0.22, sp.extension - dt * 2.5);
      }
    }

    // 5. Chompers / Jaws of Steel
    for (const ch of room.chompers) {
      ch.phase = (ch.phase + dt) % 1.35;
      // Snaps shut sharply between 0.55 and 0.80 of cycle
      if (ch.phase > 0.55 && ch.phase < 0.78) {
        if (ch.closedAmount < 0.9) this.sound.playChomper();
        ch.closedAmount = 1;
      } else {
        ch.closedAmount = Math.max(0, ch.closedAmount - dt * 4.5);
      }

      const bladeX = ch.col * TILE_W + TILE_W * 0.5;
      const bladeY = this.getFloorY(ch.row);
      if (
        ch.closedAmount > 0.75 &&
        Math.abs(p.y - bladeY) < 28 &&
        Math.abs(p.x - bladeX) < 16 &&
        p.state !== 'dead'
      ) {
        this.damagePrince(99, 'SLICED BY THE JAWS OF STEEL');
      }
    }
  }

  updateGuards(dt) {
    const room = this.currentRoom;
    const p = this.prince;

    for (const g of room.liveGuards) {
      g.animTime += dt;
      if (g.hp <= 0) {
        g.state = 'dead';
        continue;
      }

      if (g.parryWindow > 0) g.parryWindow -= dt;
      if (g.aiCooldown > 0) g.aiCooldown -= dt;

      // Check if Prince is on the same floor tier
      const sameTier = Math.abs(g.y - p.y) < 32 && p.state !== 'dead';
      if (!sameTier) {
        g.state = 'sword_idle';
        continue;
      }

      const dx = p.x - g.x;
      const dist = Math.abs(dx);
      g.facing = dx >= 0 ? 1 : -1;

      if (g.state === 'sword_hit' && g.animTime < 0.26) {
        continue;
      }

      // Guard AI spacing & duel rhythm
      if (dist > 74 && dist < 340) {
        const moveX = g.x + g.facing * 92 * dt;
        const nextCol = Math.floor(moveX / TILE_W);
        if (nextCol >= 0 && nextCol < COLS && this.hasFloorSupport(room, g.row, nextCol)) {
          g.x = moveX;
          g.state = 'sword_advance';
        } else {
          g.state = 'sword_idle';
        }
      } else if (dist < 44) {
        g.x -= g.facing * 65 * dt;
        g.state = 'sword_advance';
      } else {
        g.state = 'sword_idle';
      }

      // Guard slash attack when in dueling range
      if (dist <= 82 && g.aiCooldown <= 0) {
        g.aiCooldown = g.role === 'jaffar' ? 0.62 : 0.95;
        g.state = 'sword_strike';
        g.animTime = 0;

        // Did the Prince Parry with [Up]?
        if (p.parryWindow > 0 || p.state === 'sword_parry') {
          this.sound.playSwordClash(true);
          this.spawnParticles((p.x + g.x) * 0.5, p.y - 44, '#64EBD9', 22);
          this.addFloatingText(p.x, p.y - 82, 'PARRY! COUNTER WITH [SPACE]!', '#64EBD9');
          g.parryWindow = -0.55; // Guard is wide open to Prince riposte!
          g.x -= g.facing * 16;
        } else {
          this.damagePrince(1, `STRUCK BY ${g.name} (PRESS [UP] TO PARRY!)`);
        }
      }
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 260 * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 28 * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  // ============================================================================
  // RENDER PIPELINE: 1989 Persian Limestone & Palace Tilework + Dynamic Torches
  // ============================================================================
  render() {
    const ctx = this.ctx;
    const room = this.currentRoom;
    const mode = this.visualMode;

    ctx.save();

    // Base Sky / Chamber Obsidian Backdrop
    if (mode === 'monochrome') {
      ctx.fillStyle = '#120A00';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    } else {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      if (room.theme === 'palace') {
        bgGrad.addColorStop(0, '#0E0B20');
        bgGrad.addColorStop(1, '#1C1536');
      } else {
        bgGrad.addColorStop(0, '#08070F');
        bgGrad.addColorStop(1, '#141122');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Subtle parallax Persian Palace night sky mural in Palace sectors
      const bgImg = this.currentRoomIndex === 11 ? this.bgImages.princess : this.bgImages.palace;
      if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
        ctx.save();
        ctx.globalAlpha = room.theme === 'palace' ? 0.34 : 0.14;
        ctx.drawImage(bgImg, 0, 0, CANVAS_W, CANVAS_H);
        ctx.restore();
      }
    }

    // Draw back-wall masonry & architectural fixtures per cell
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        this.renderCellBackground(ctx, room, r, c);
      }
    }

    // Draw floor slabs, loose tiles, pressure plates, spikes, potions, mirrors
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        this.renderCellFloorAndProps(ctx, room, r, c);
      }
    }

    // Falling loose slabs
    for (const slab of room.fallingSlabs) {
      ctx.fillStyle = mode === 'monochrome' ? '#CC8400' : '#4C436A';
      ctx.fillRect(slab.x + 4, slab.y - 14, TILE_W - 8, 14);
      ctx.strokeStyle = '#D9A94E';
      ctx.strokeRect(slab.x + 4, slab.y - 14, TILE_W - 8, 14);
    }

    // Render Princess in Finale Chamber (Room 12)
    if (this.currentRoomIndex === 11) {
      renderCharacter(
        ctx,
        {
          role: 'princess',
          x: 6.2 * TILE_W,
          y: this.getFloorY(2),
          facing: -1,
          state: 'idle',
          animTime: this.time
        },
        { visualMode: mode, time: this.time }
      );
    }

    // Render Shadow Twin (with spectral tether line to Prince)
    if (this.shadowTwin) {
      ctx.save();
      ctx.strokeStyle = 'rgba(100, 235, 217, 0.32)';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(this.prince.x, this.prince.y - 36);
      ctx.lineTo(this.shadowTwin.x, this.shadowTwin.y - 36);
      ctx.stroke();
      ctx.restore();

      renderCharacter(ctx, this.shadowTwin, {
        visualMode: mode,
        time: this.time,
        isShadowTwin: true
      });
    }

    // Render Guards / Vizier Jaffar
    for (const g of room.liveGuards) {
      renderCharacter(ctx, g, {
        visualMode: mode,
        time: this.time
      });
    }

    // Render The Prince
    renderCharacter(ctx, this.prince, {
      visualMode: mode,
      time: this.time
    });

    // Render Foreground Traps (Portcullis Gates & Chomper Blades overlap characters)
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        this.renderCellForeground(ctx, room, r, c);
      }
    }

    // Particles & Sparks
    for (const pt of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = mode === 'monochrome' ? '#FFB84D' : pt.color;
      ctx.fillRect(pt.x - pt.size * 0.5, pt.y - pt.size * 0.5, pt.size, pt.size);
      ctx.restore();
    }

    // Floating combat & lore callouts
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, ft.life);
      ctx.font = '700 13px "Cinzel", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#090812';
      ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
      ctx.fillStyle = mode === 'monochrome' ? '#FFD480' : ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // Rewind golden sand vignette when holding [R]
    if (this.keys.rewind && this.sandEnergy > 1) {
      ctx.save();
      const grad = ctx.createRadialGradient(
        CANVAS_W * 0.5,
        CANVAS_H * 0.5,
        140,
        CANVAS_W * 0.5,
        CANVAS_H * 0.5,
        CANVAS_W * 0.65
      );
      grad.addColorStop(0, 'rgba(244, 204, 116, 0)');
      grad.addColorStop(1, 'rgba(217, 169, 78, 0.36)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.restore();
    }

    // Level Editor Grid Overlay when Architect Mode is active
    if (this.editorActive) {
      this.renderEditorGrid(ctx, room);
    }

    ctx.restore();
  }

  renderCellBackground(ctx, room, r, c) {
    const x = c * TILE_W;
    const y = TOP_MARGIN + r * TIER_H;
    const code = room.grid[r][c];
    const mode = this.visualMode;
    const isPalace = room.theme === 'palace';

    // Subtle stone course brick lines
    ctx.strokeStyle =
      mode === 'monochrome'
        ? 'rgba(255, 184, 77, 0.14)'
        : isPalace
          ? 'rgba(217, 169, 78, 0.12)'
          : 'rgba(120, 110, 165, 0.11)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 2, y + 4, TILE_W - 4, TIER_H - 8);

    // Solid Wall Block '#'
    if (code === '#') {
      ctx.fillStyle = mode === 'monochrome' ? '#593800' : isPalace ? '#2A2244' : '#1E1A30';
      ctx.fillRect(x, y, TILE_W, TIER_H);

      // Beveled ashlar stone blocks inside wall
      ctx.strokeStyle = mode === 'monochrome' ? '#CC8400' : '#3E3460';
      for (let by = 0; by < TIER_H; by += 35) {
        const offset = (by / 35) % 2 === 0 ? 0 : 24;
        ctx.strokeRect(x + offset, y + by, TILE_W - offset, 35);
      }
      return;
    }

    // Arched Persian Palace Window 'W'
    if (code === 'W') {
      ctx.save();
      const wx = x + 18;
      const wy = y + 20;
      const ww = TILE_W - 36;
      const wh = TIER_H - 42;

      ctx.fillStyle = mode === 'monochrome' ? '#261700' : '#080B1C';
      ctx.beginPath();
      ctx.moveTo(wx, wy + wh);
      ctx.lineTo(wx, wy + 34);
      ctx.quadraticCurveTo(wx + ww * 0.5, wy - 12, wx + ww, wy + 34);
      ctx.lineTo(wx + ww, wy + wh);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = mode === 'monochrome' ? '#FFB84D' : '#D9A94E';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Twinkling stars & crescent inside arch
      ctx.fillStyle = '#F4CC74';
      ctx.fillRect(wx + 16, wy + 32, 2, 2);
      ctx.fillRect(wx + ww - 18, wy + 48, 2.5, 2.5);
      ctx.fillRect(wx + ww * 0.5, wy + 26, 2, 2);
      ctx.restore();
    }

    // Carved Persian Limestone Column 'P'
    if (code === 'P') {
      const px = x + TILE_W * 0.5 - 12;
      ctx.fillStyle = mode === 'monochrome' ? '#805300' : isPalace ? '#3B315E' : '#2B2542';
      ctx.fillRect(px, y + 8, 24, TIER_H - 22);
      // Capital & base
      ctx.fillStyle = mode === 'monochrome' ? '#FFB84D' : '#D9A94E';
      ctx.fillRect(px - 6, y + 6, 36, 8);
      ctx.fillRect(px - 6, y + TIER_H - 22, 36, 8);
    }

    // Flickering Wall Torch 'T'
    if (code === 'T') {
      const tx = x + TILE_W * 0.5;
      const ty = y + 68;
      const flicker = Math.sin(this.time * 16 + c * 2.3 + r) * 3;

      if (mode === 'illuminated') {
        const glow = ctx.createRadialGradient(tx, ty - 8, 4, tx, ty - 8, 68 + flicker * 2);
        glow.addColorStop(0, 'rgba(255, 200, 95, 0.42)');
        glow.addColorStop(0.5, 'rgba(239, 83, 71, 0.16)');
        glow.addColorStop(1, 'rgba(239, 83, 71, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(tx, ty - 8, 70, 0, Math.PI * 2);
        ctx.fill();
      }

      // Iron sconce bracket
      ctx.fillStyle = '#6E5A4F';
      ctx.fillRect(tx - 3, ty, 6, 18);

      // Flame teardrop
      ctx.fillStyle = mode === 'monochrome' ? '#FFD480' : '#F59E0B';
      ctx.beginPath();
      ctx.ellipse(tx, ty - 7, 5.5, 10 + flicker * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.ellipse(tx, ty - 5, 3, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  renderCellFloorAndProps(ctx, room, r, c) {
    const x = c * TILE_W;
    const floorY = this.getFloorY(r);
    const code = room.grid[r][c];
    const mode = this.visualMode;
    const isPalace = room.theme === 'palace';

    if (code === '.') return; // Open chasm

    // Loose Tile wobble offset
    let wobbleY = 0;
    if (code === 'L') {
      const lt = room.looseTiles.find(t => t.row === r && t.col === c);
      if (lt && lt.triggered) {
        wobbleY = Math.sin(this.time * 55) * 3.5;
      }
    }

    // Draw isometric 1989 stone floor slab ledge
    const slabH = 14;
    ctx.fillStyle =
      mode === 'monochrome'
        ? '#B36B00'
        : code === 'L'
          ? '#4D4168'
          : isPalace
            ? '#3F3463'
            : '#302A48';
    ctx.fillRect(x, floorY - 4 + wobbleY, TILE_W, slabH);

    // Top highlight lip of stone slab
    ctx.fillStyle =
      mode === 'monochrome' ? '#FFD480' : isPalace ? '#D9A94E' : '#6A5E91';
    ctx.fillRect(x, floorY - 4 + wobbleY, TILE_W, 3);

    // Joint crack on Loose Slab 'L'
    if (code === 'L') {
      ctx.strokeStyle = '#120E1E';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 28, floorY - 4 + wobbleY);
      ctx.lineTo(x + 36, floorY + 8 + wobbleY);
      ctx.moveTo(x + 64, floorY - 4 + wobbleY);
      ctx.lineTo(x + 58, floorY + 8 + wobbleY);
      ctx.stroke();
    }

    // Pressure Plate 'B'
    if (code === 'B') {
      const pl = room.plates.find(p => p.row === r && p.col === c);
      const depressed = pl && pl.depressed;
      ctx.fillStyle = depressed ? '#38B8A8' : '#D9A94E';
      ctx.fillRect(x + 18, floorY - (depressed ? 5 : 9), TILE_W - 36, depressed ? 3 : 6);
      if (pl && pl.rubblePinned) {
        ctx.fillStyle = '#8C7D70';
        ctx.fillRect(x + 22, floorY - 15, TILE_W - 44, 10);
      }
    }

    // Floor Spikes 'S'
    if (code === 'S') {
      const sp = room.spikes.find(s => s.row === r && s.col === c);
      const ext = sp ? sp.extension : 0.3;
      const spikeH = 8 + ext * 26;
      for (let sx = x + 14; sx <= x + TILE_W - 14; sx += 16) {
        ctx.fillStyle = '#CBD5E1';
        ctx.beginPath();
        ctx.moveTo(sx - 5, floorY - 4);
        ctx.lineTo(sx, floorY - 4 - spikeH);
        ctx.lineTo(sx + 5, floorY - 4);
        ctx.closePath();
        ctx.fill();

        // Crimson tip highlight
        ctx.fillStyle = '#C93B32';
        ctx.beginPath();
        ctx.moveTo(sx - 2, floorY - 4 - spikeH * 0.65);
        ctx.lineTo(sx, floorY - 4 - spikeH);
        ctx.lineTo(sx + 2, floorY - 4 - spikeH * 0.65);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Potions: 'R' (Heal), 'V' (Max HP Vessel), 'X' (Poison), 'F' (Feather Fall)
    if (code === 'R' || code === 'V' || code === 'X' || code === 'F') {
      const px = x + TILE_W * 0.5;
      const py = floorY - 6;
      const colors = {
        R: '#EF5347',
        V: '#F4CC74',
        X: '#3B82F6',
        F: '#34D399'
      };
      const colHex = colors[code];

      // Potion bulb
      ctx.fillStyle = colHex;
      ctx.beginPath();
      ctx.arc(px, py - 9, code === 'V' ? 10 : 7.5, 0, Math.PI * 2);
      ctx.fill();

      // Flask neck
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(px - 3, py - (code === 'V' ? 23 : 19), 6, 5);

      // Rising bubbles
      const bY = py - 24 - ((this.time * 18 + c * 7) % 14);
      ctx.fillStyle = colHex;
      ctx.beginPath();
      ctx.arc(px + Math.sin(this.time * 6) * 4, bY, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Gleaming Scimitar Pickup 'K'
    if (code === 'K') {
      const sx = x + TILE_W * 0.5;
      const sy = floorY - 12 + Math.sin(this.time * 4) * 3;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.strokeStyle = '#F4CC74';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-18, 4);
      ctx.quadraticCurveTo(0, 8, 20, -4);
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-4, -2, 4, 4);
      ctx.restore();
    }

    // The Magic Mirror 'M'
    if (code === 'M') {
      const mx = x + TILE_W * 0.5;
      const my = floorY - 4;
      ctx.save();
      // Golden frame
      ctx.fillStyle = '#D9A94E';
      ctx.fillRect(mx - 10, my - 88, 20, 84);
      // Shimmering silver-lapis glass
      const mGrad = ctx.createLinearGradient(mx - 7, my - 84, mx + 7, my - 8);
      mGrad.addColorStop(0, '#64EBD9');
      mGrad.addColorStop(0.5, '#E0F2FE');
      mGrad.addColorStop(1, '#38B8A8');
      ctx.fillStyle = mGrad;
      ctx.fillRect(mx - 6, my - 82, 12, 74);
      ctx.restore();
    }

    // The Astral Hourglass of Khorasan 'H'
    if (code === 'H') {
      const hx = x + TILE_W * 0.5;
      const hy = floorY - 6;
      ctx.save();
      // Golden top & bottom caps
      ctx.fillStyle = '#F4CC74';
      ctx.fillRect(hx - 24, hy - 118, 48, 8);
      ctx.fillRect(hx - 24, hy - 8, 48, 8);

      // Glass bulbs
      ctx.strokeStyle = '#64EBD9';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(hx - 18, hy - 110);
      ctx.lineTo(hx + 18, hy - 110);
      ctx.lineTo(hx - 18, hy - 8);
      ctx.lineTo(hx + 18, hy - 8);
      ctx.closePath();
      ctx.stroke();

      // Glowing sand stream
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.moveTo(hx - 12, hy - 90);
      ctx.lineTo(hx + 12, hy - 90);
      ctx.lineTo(hx, hy - 58);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(hx, hy - 58);
      ctx.lineTo(hx - 15, hy - 8);
      ctx.lineTo(hx + 15, hy - 8);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hx, hy - 58);
      ctx.lineTo(hx, hy - 10);
      ctx.stroke();
      ctx.restore();
    }
  }

  renderCellForeground(ctx, room, r, c) {
    const x = c * TILE_W;
    const y = TOP_MARGIN + r * TIER_H;
    const floorY = this.getFloorY(r);
    const code = room.grid[r][c];

    // Portcullis Iron Gate 'G' or Exit Door 'E'
    if (code === 'G' || code === 'E') {
      const gate = room.gates.find(g => g.row === r && g.col === c);
      const openAmt = gate ? gate.openAmount : 0;
      const gateH = (TIER_H - 18) * (1 - openAmt * 0.86);
      const gx = x + TILE_W * 0.55;

      // Top stone lintel housing
      ctx.fillStyle = '#D9A94E';
      ctx.fillRect(gx - 12, y + 6, 24, 10);

      // Iron portcullis bars
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(gx - 6, y + 14, 12, gateH);

      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 2;
      for (let by = y + 24; by < y + 14 + gateH; by += 18) {
        ctx.beginPath();
        ctx.moveTo(gx - 8, by);
        ctx.lineTo(gx + 8, by);
        ctx.stroke();
      }
    }

    // Chomper / Jaws of Steel 'C'
    if (code === 'C') {
      const ch = room.chompers.find(cm => cm.row === r && cm.col === c);
      const closed = ch ? ch.closedAmount : 0;
      const cx = x + TILE_W * 0.5;
      const gap = (1 - closed) * 34;

      // Upper & lower serrated steel jaws
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(cx - 10, y + 12, 20, TIER_H * 0.45 - gap);
      ctx.fillRect(cx - 10, floorY - 4 - (TIER_H * 0.42 - gap), 20, TIER_H * 0.42 - gap);

      // Serrated blood-crimson teeth
      ctx.fillStyle = '#C93B32';
      ctx.fillRect(cx - 10, y + 12 + (TIER_H * 0.45 - gap) - 5, 20, 5);
      ctx.fillRect(cx - 10, floorY - 4 - (TIER_H * 0.42 - gap), 20, 5);
    }
  }

  renderEditorGrid(ctx, room) {
    ctx.save();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * TILE_W;
        const y = TOP_MARGIN + r * TIER_H;
        ctx.strokeStyle = 'rgba(100, 235, 217, 0.45)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 1, y + 1, TILE_W - 2, TIER_H - 2);

        ctx.fillStyle = 'rgba(9, 8, 18, 0.75)';
        ctx.fillRect(x + 4, y + 4, 24, 18);
        ctx.fillStyle = '#64EBD9';
        ctx.font = '700 11px "JetBrains Mono", monospace';
        ctx.fillText(room.grid[r][c], x + 11, y + 17);
      }
    }
    ctx.restore();
  }

  handleCanvasEditClick(clientX, clientY, clearToAir = false) {
    if (!this.editorActive) return;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const cx = (clientX - rect.left) * scaleX;
    const cy = (clientY - rect.top) * scaleY;

    const col = Math.floor(cx / TILE_W);
    const row = Math.floor((cy - TOP_MARGIN) / TIER_H);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;

    const room = this.currentRoom;
    room.grid[row][col] = clearToAir ? '.' : this.selectedTileCode;
    this.initRoomRuntime(room);
    this.sound.playPlatePress();
  }

  toggleRoomGuardInEditor() {
    const room = this.currentRoom;
    if (room.liveGuards.length > 0) {
      room.liveGuards = [];
      room.guards = [];
      this.setBanner('ARCHITECT: REMOVED GUARD FROM CURRENT CHAMBER');
    } else {
      const newGuard = {
        col: 6,
        row: 2,
        facing: -1,
        hp: 3,
        maxHp: 3,
        name: 'ROYAL SENTINEL',
        skill: 0.65
      };
      room.guards = [newGuard];
      this.initRoomRuntime(room);
      this.setBanner('ARCHITECT: PLACED ROYAL SENTINEL ON LOWER TIER');
    }
  }
}

export { TILE_TYPES };
