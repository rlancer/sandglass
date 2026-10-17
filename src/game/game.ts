import { START_SECONDS, VIEW_W } from "./constants";
import { AudioBus } from "./audio";
import { updateGuards } from "./guard";
import { Input } from "./input";
import { loadLevel, type World } from "./level";
import { getCampaignSeed, getLevels, rerollCampaign } from "./levels";
import { Player } from "./player";
import { Renderer } from "./renderer";
import type { GamePhase } from "./types";

export class Game {
  private input = new Input();
  private audio = new AudioBus();
  private world: World;
  private player = new Player();
  private renderer: Renderer;
  private phase: GamePhase = "title";
  private timeLeft = START_SECONDS;
  private banner = "";
  private bannerT = 0;
  private titlePulse = 0;
  private last = 0;
  private levelIndex = 0;
  private levelName = "";
  private levelSubtitle = "";
  private introT = 0;
  private selectedLevel = 0;

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = VIEW_W;
    canvas.height = 400;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    this.renderer = new Renderer(ctx);
    rerollCampaign(getCampaignSeed());
    const parsed = loadLevel(0);
    this.world = parsed.world;
    this.levelName = parsed.level.name;
    this.levelSubtitle = parsed.level.subtitle;
    this.player.reset(parsed.start.x, parsed.start.y);
  }

  start() {
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  private beginRun(fromLevel = 0) {
    this.levelIndex = fromLevel;
    this.timeLeft = START_SECONDS;
    this.player = new Player();
    this.loadCurrentLevel(true);
    this.audio.resume();
    this.audio.pickup();
  }

  private loadCurrentLevel(freshPlayer: boolean) {
    const parsed = loadLevel(this.levelIndex);
    this.world = parsed.world;
    this.levelName = parsed.level.name;
    this.levelSubtitle = parsed.level.subtitle;
    this.world.currentId = parsed.start.room;

    const keepSword = !freshPlayer && this.player.hasSword;
    const keepHp = !freshPlayer ? this.player.hp : undefined;
    const keepMax = !freshPlayer ? this.player.maxHp : undefined;

    if (freshPlayer) {
      this.player = new Player();
    }
    this.player.reset(parsed.start.x, parsed.start.y);
    this.player.reachedExit = false;

    if (parsed.level.startWithSword || keepSword) {
      this.player.hasSword = true;
    }
    if (keepMax != null) this.player.maxHp = keepMax;
    if (keepHp != null) this.player.hp = Math.min(keepHp, this.player.maxHp);

    this.phase = "levelintro";
    this.introT = 2.4;
    this.banner = "";
    this.bannerT = 0;
  }

  private loop(now: number) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.update(dt);
    const levels = getLevels();
    this.renderer.draw(
      this.world,
      this.player,
      this.phase,
      this.timeLeft,
      this.bannerT > 0 ? this.banner : "",
      this.titlePulse,
      {
        levelIndex: this.levelIndex,
        levelCount: levels.length,
        levelName: this.levelName,
        levelSubtitle: this.levelSubtitle,
        selectedLevel: this.selectedLevel,
        seed: getCampaignSeed(),
        roomCount: this.world.rooms.size,
      },
    );
    this.input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number) {
    this.titlePulse = 0.5 + Math.sin(performance.now() / 400) * 0.5;
    const levels = getLevels();

    if (this.phase === "title") {
      if (this.input.just("ArrowLeft") || this.input.just("KeyA")) {
        this.selectedLevel = Math.max(0, this.selectedLevel - 1);
      }
      if (this.input.just("ArrowRight") || this.input.just("KeyD")) {
        this.selectedLevel = Math.min(levels.length - 1, this.selectedLevel + 1);
      }
      if (this.input.just("KeyR")) {
        rerollCampaign();
        const preview = loadLevel(this.selectedLevel);
        this.world = preview.world;
        this.levelName = preview.level.name;
        this.levelSubtitle = preview.level.subtitle;
        this.player.reset(preview.start.x, preview.start.y);
        this.audio.resume();
        this.audio.gate();
        this.banner = "Palace rebuilt.";
        this.bannerT = 1.5;
      }
      if (this.input.confirm()) this.beginRun(this.selectedLevel);
      return;
    }

    if (this.phase === "levelintro") {
      this.introT -= dt;
      if (this.introT <= 0 || this.input.confirm()) {
        this.phase = "playing";
        this.banner = this.levelSubtitle;
        this.bannerT = 3;
      }
      return;
    }

    if (this.phase === "levelclear") {
      if (this.input.confirm()) {
        this.levelIndex += 1;
        if (this.levelIndex >= levels.length) {
          this.phase = "win";
          this.audio.win();
        } else {
          this.loadCurrentLevel(false);
        }
      }
      return;
    }

    if (this.phase === "dead" || this.phase === "timeup") {
      if (this.input.confirm()) {
        if (this.phase === "timeup") {
          this.beginRun(this.levelIndex);
        } else {
          this.player.hp = Math.max(1, this.player.maxHp - 1);
          this.player.respawnInRoom();
          this.phase = "playing";
          this.banner = "The sand pours you back.";
          this.bannerT = 2;
        }
      }
      return;
    }

    if (this.phase === "win") {
      if (this.input.confirm()) {
        rerollCampaign();
        this.phase = "title";
      }
      return;
    }

    if (this.input.pause()) {
      this.phase = this.phase === "paused" ? "playing" : "paused";
      this.audio.resume();
    }
    if (this.phase === "paused") return;

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.phase = "timeup";
      this.audio.die();
      return;
    }

    if (this.bannerT > 0) this.bannerT -= dt;

    this.player.update(this.input, this.world, this.audio, dt);
    const msg = this.player.tryPickup(this.world.room, this.audio);
    if (msg) {
      this.banner = msg;
      this.bannerT = 2.5;
    }

    this.world.pressSwitches(this.player.x, this.player.y, () => {
      this.audio.gate();
      this.banner = "A gate opens.";
      this.bannerT = 2;
    });

    updateGuards(this.world.room, this.player, this.audio, dt);

    const exit = this.world.tryExit(this.player.x, this.player.y, this.player.facing);
    if (exit) {
      this.world.enter(exit.room, exit.x, exit.y);
      this.player.x = exit.x;
      this.player.y = exit.y;
      this.player.roomSpawnX = exit.x;
      this.player.roomSpawnY = Math.min(exit.y, 280);
      this.player.vx = 0;
      this.banner = exit.room;
      this.bannerT = 1.2;
    }

    if (this.player.reachedExit) {
      this.player.reachedExit = false;
      this.phase = "levelclear";
      this.audio.win();
    }

    if (this.player.dead) {
      this.phase = "dead";
      this.renderer.bump(6);
    }

    if (this.player.hurtT > 0.3) this.renderer.bump(2);

    this.audio.tickMusic(dt, true);
  }
}
