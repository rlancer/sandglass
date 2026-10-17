/**
 * Chroma-key + crop + normalize a benchmark run's raw/ → ready/
 *
 *   bun run sprites:process -- --run openai-gpt-image-1
 */
import sharp from "sharp";
import { mkdir, readdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import {
  getActiveRunId,
  parseArgs,
  runDir,
  ensureRunDirs,
} from "./lib/bench";

const SIZE = 256;
const args = parseArgs(process.argv.slice(2));
const RUN_ID =
  (typeof args.run === "string" && args.run) ||
  process.env.RUN_ID ||
  getActiveRunId();

function isBg(r: number, g: number, b: number, a: number): boolean {
  if (a < 16) return true;
  if (r < 36 && g < 36 && b < 36) return true;
  if (r > 160 && g < 90 && b > 40 && r > g + 40) return true;
  if (g > 180 && r < 80 && b < 80 && g > r + 60) return true;
  return false;
}

async function processFile(srcPath: string, destPath: string, name: string) {
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  let minX = w,
    minY = h,
    maxX = 0,
    maxY = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const a = data[i + 3]!;
      if (isBg(r, g, b, a)) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      } else {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    console.log(`empty ${name}`);
    return;
  }

  const pad = 8;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;

  const cropped = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = ((minY + y) * w + (minX + x)) * 4;
      const di = (y * cw + x) * 4;
      cropped[di] = data[si]!;
      cropped[di + 1] = data[si + 1]!;
      cropped[di + 2] = data[si + 2]!;
      cropped[di + 3] = data[si + 3]!;
    }
  }

  const scale = Math.min((SIZE - 16) / cw, (SIZE - 16) / ch);
  const nw = Math.max(1, Math.round(cw * scale));
  const nh = Math.max(1, Math.round(ch * scale));
  const left = Math.round((SIZE - nw) / 2);
  const top = SIZE - nh - 4;

  const resized = await sharp(cropped, {
    raw: { width: cw, height: ch, channels: 4 },
  })
    .resize(nw, nh, { kernel: "lanczos3" })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toFile(destPath);

  console.log(`ok ${name} (${cw}x${ch} -> ${SIZE})`);
}

ensureRunDirs(RUN_ID);
const rawDir = join(runDir(RUN_ID), "raw");
const readyDir = join(runDir(RUN_ID), "ready");
const legacyRaw = join(import.meta.dir, "..", "public", "sprites");

const rawFiles = existsSync(rawDir)
  ? (await readdir(rawDir)).filter((f) => f.endsWith(".png"))
  : [];
const srcDir = rawFiles.length ? rawDir : legacyRaw;

if (!existsSync(srcDir)) throw new Error(`No raw sprites for run ${RUN_ID}`);

await mkdir(readyDir, { recursive: true });
const files = (await readdir(srcDir)).filter((f) => f.endsWith(".png"));
console.log(`Processing run=${RUN_ID} from ${srcDir}`);
for (const f of files) {
  await processFile(join(srcDir, f), join(readyDir, f), f);
}
console.log(`done → ${readyDir}`);
console.log(`Next: bun run sprites:activate -- --run ${RUN_ID}`);
