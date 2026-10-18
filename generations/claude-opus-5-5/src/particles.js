const list = [];
const rand = (a, b) => a + Math.random() * (b - a);

function add(p) {
  if (list.length > 900) list.shift();
  list.push({ life: 1, age: 0, g: 0, drag: 0, size: 2, glow: false, ...p });
}

export const particles = {
  list,
  clear() {
    list.length = 0;
  },
  dust(x, y, n = 8) {
    for (let i = 0; i < n; i++)
      add({ x: x + rand(-28, 28), y: y + rand(-4, 4), vx: rand(-30, 30), vy: rand(-50, -5), g: 40, drag: 2, life: rand(0.6, 1.4), size: rand(2, 5), color: "rgba(180,160,130,A)", soft: true });
  },
  chips(x, y, n = 8) {
    for (let i = 0; i < n; i++)
      add({ x: x + rand(-24, 24), y, vx: rand(-120, 120), vy: rand(-260, -60), g: 1200, life: rand(0.5, 1), size: rand(2, 4), color: "rgba(120,110,100,A)" });
  },
  sparks(x, y, n = 14, dir = 0) {
    for (let i = 0; i < n; i++)
      add({ x, y, vx: rand(-200, 200) + dir * 120, vy: rand(-260, 60), g: 900, drag: 1, life: rand(0.2, 0.55), size: rand(1, 2.2), color: "rgba(255,230,150,A)", glow: true, streak: true });
  },
  sand(x, y, n = 6) {
    for (let i = 0; i < n; i++)
      add({ x: x + rand(-14, 14), y: y + rand(-60, 0), vx: rand(-60, 60), vy: rand(-80, 20), g: -20, drag: 1.5, life: rand(0.5, 1.2), size: rand(1, 2.5), color: "rgba(255,205,110,A)", glow: true });
  },
  shade(x, y, n = 4) {
    for (let i = 0; i < n; i++)
      add({ x: x + rand(-10, 10), y: y + rand(-60, 0), vx: rand(-20, 20), vy: rand(-50, -10), g: -30, drag: 1, life: rand(0.4, 1), size: rand(1.5, 3.5), color: "rgba(90,230,255,A)", glow: true });
  },
  ember(x, y) {
    add({ x: x + rand(-3, 3), y, vx: rand(-10, 10), vy: rand(-70, -30), g: -10, drag: 0.5, life: rand(0.5, 1.2), size: rand(0.8, 1.6), color: "rgba(255,170,60,A)", glow: true });
  },
  bubble(x, y, color) {
    add({ x: x + rand(-3, 3), y, vx: rand(-5, 5), vy: rand(-30, -14), life: rand(0.4, 0.9), size: rand(0.8, 1.6), color, glow: true });
  },
  mote(x0, y0, w, h) {
    add({ x: x0 + Math.random() * w, y: y0 + Math.random() * h, vx: rand(-6, 6), vy: rand(-6, 4), life: rand(3, 6), size: rand(0.6, 1.4), color: "rgba(255,240,210,A)", mote: true });
  },
  burst(x, y, color, n = 30) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(40, 220);
      add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 3, life: rand(0.4, 1.1), size: rand(1, 3), color, glow: true });
    }
  },
  update(dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.age += dt;
      if (p.age >= p.life) {
        list.splice(i, 1);
        continue;
      }
      p.vy += p.g * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  },
  draw(ctx) {
    for (const p of list) {
      const k = 1 - p.age / p.life;
      let a = p.mote ? Math.sin((p.age / p.life) * Math.PI) * 0.5 : k;
      ctx.globalCompositeOperation = p.glow ? "lighter" : "source-over";
      ctx.fillStyle = p.color.replace("A", a.toFixed(3));
      if (p.streak) {
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      } else if (p.soft) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.5 - k * 0.5), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalCompositeOperation = "source-over";
  },
};
