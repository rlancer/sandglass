export class Input {
  private held = new Set<string>();
  private pressed = new Set<string>();
  private released = new Set<string>();

  constructor() {
    window.addEventListener("keydown", (e) => {
      const k = this.norm(e.code);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
      if (!this.held.has(k)) this.pressed.add(k);
      this.held.add(k);
    });
    window.addEventListener("keyup", (e) => {
      const k = this.norm(e.code);
      this.held.delete(k);
      this.released.add(k);
    });
    window.addEventListener("blur", () => {
      this.held.clear();
    });
  }

  private norm(code: string): string {
    return code;
  }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
  }

  hold(code: string) {
    return this.held.has(code);
  }

  just(code: string) {
    return this.pressed.has(code);
  }

  axis(): number {
    let a = 0;
    if (this.hold("ArrowLeft") || this.hold("KeyA")) a -= 1;
    if (this.hold("ArrowRight") || this.hold("KeyD")) a += 1;
    return a;
  }

  up() {
    return this.hold("ArrowUp") || this.hold("KeyW");
  }

  down() {
    return this.hold("ArrowDown") || this.hold("KeyS");
  }

  jump() {
    return this.just("Space") || this.just("KeyZ") || this.just("ArrowUp") || this.just("KeyW");
  }

  jumpHold() {
    return this.hold("Space") || this.hold("KeyZ") || this.up();
  }

  strike() {
    return this.just("KeyX") || this.just("KeyK");
  }

  careful() {
    return this.hold("ShiftLeft") || this.hold("ShiftRight") || this.hold("KeyC");
  }

  pause() {
    return this.just("Escape") || this.just("KeyP");
  }

  confirm() {
    return this.just("Enter") || this.just("Space") || this.just("KeyZ");
  }
}
