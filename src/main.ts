import "./style.css";
import { Game } from "./game/game";
import { preloadSprites } from "./game/sprites";

preloadSprites();

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <div class="shell">
    <div class="brand">SANDGLASS</div>
    <canvas id="game" width="640" height="400" aria-label="Sandglass game"></canvas>
    <p class="hint">
      Title: <kbd>←</kbd><kbd>→</kbd> level · <kbd>R</kbd> new seed · <kbd>Enter</kbd> start
      · In-game: run / jump / <kbd>X</kbd> strike · plates open gates · explore rooms · reach <kbd>EXIT</kbd>
    </p>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = new Game(canvas);
game.start();
