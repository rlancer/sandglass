/**
 * Palace paintings via OpenRouter's image API.
 * Reads OPENROUTER_API_KEY from .env. Never prints the key.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const env = await Bun.file(join(root, ".env")).text();
const key = env.match(/^OPENROUTER_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key) {
  console.error("OPENROUTER_API_KEY missing from .env");
  process.exit(1);
}

const STYLE =
  "Painterly storybook illustration, pigment sense of a Persian miniature: lapis lazuli, cinnabar, ivory, gold leaf flecks, sandstone. Seljuk palace architecture with pointed arches and star geometry. Visible brush texture, cinematic but not photoreal. Absolutely no text, no letters, no calligraphy, no numbers, no watermark, no signature, no border, no frame.";

const jobs = [
  {
    name: "bg-day",
    aspect: "16:9",
    prompt: `${STYLE} Wide straight-on view of an empty palace dungeon wall in late afternoon. Warm sandstone blocks, a horizontal band of lapis-and-gold eight-pointed stars, tall pointed-arch niches filled with soft darkness, a single shaft of honey sunlight and floating dust. No people, no creatures, no objects in the foreground, no furniture.`,
  },
  {
    name: "bg-night",
    aspect: "16:9",
    prompt: `${STYLE} The same kind of empty palace dungeon wall at night, straight-on, not a corridor vanishing point. Indigo and charcoal stone, silver star-tile band, pointed-arch niches, cool moonlight, pale dust. No people, no creatures, no objects, no furniture.`,
  },
  {
    name: "prince",
    aspect: "3:4",
    prompt: `${STYLE} Bust portrait, three-quarter view, of a young prince. Shoulder-length black hair, a thin gold circlet, open deep-crimson vest edged in gold over a bare chest, a fold of ivory linen, warm brown skin, dark amber eyes, clean-shaven, alert and calm. Dark sandstone behind him. No weapon across the face.`,
  },
  {
    name: "laleh",
    aspect: "3:4",
    prompt: `${STYLE} Bust portrait, three-quarter view, of a young woman. Long black hair in a single braid threaded with small gold discs, a lapis-blue gown with a gold sunburst clasp at the throat, small gold earrings, warm brown skin, steady dark eyes, dawn light. Sandstone behind her.`,
  },
  {
    name: "shahin",
    aspect: "3:4",
    prompt: `${STYLE} Bust portrait of a severe older vizier. Narrow beard streaked with silver, tall black cap, black robe embroidered with small gold stars, cold eyes, warm brown skin, dim lamplight. He holds a cracked hourglass low in the frame. No readable markings anywhere.`,
  },
  {
    name: "ending",
    aspect: "16:9",
    prompt: `${STYLE} Wide palace balcony at the instant night becomes dawn. The left half of the light is warm gold, the right half silver-blue, meeting in the middle. Far enough away to show the architecture: pointed arches, a stone rail. Two small figures stand at the rail — a young man in a crimson vest and ivory trousers, a young woman in a lapis gown — their hands meeting. Sand-dust in the light. No close-up, faces small.`,
  },
];

const MODELS = [
  "google/gemini-3.1-flash-image",
  "google/gemini-2.5-flash-image",
];

async function generate(job, model) {
  const res = await fetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: job.prompt,
      aspect_ratio: job.aspect,
      resolution: "1K",
      output_format: "png",
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`${model} ${res.status} ${raw.slice(0, 400)}`);
  }
  const json = JSON.parse(raw);
  const item = json.data?.[0];
  if (!item?.b64_json) throw new Error(`${model} returned no image`);
  return {
    bytes: Buffer.from(item.b64_json, "base64"),
    ext: item.media_type?.includes("jpeg")
      ? "jpg"
      : item.media_type?.includes("webp")
        ? "webp"
        : "png",
  };
}

await mkdir(join(root, "public", "art"), { recursive: true });

async function runJob(job) {
  let last = "";
  for (const model of MODELS) {
    try {
      console.log(`gen ${job.name} via ${model}`);
      const { bytes, ext } = await generate(job, model);
      const file = `${job.name}.${ext}`;
      await writeFile(join(root, "public", "art", file), bytes);
      console.log(`ok ${file} ${bytes.length}`);
      return;
    } catch (err) {
      last = err.message;
      console.error(`fail ${job.name}: ${last}`);
    }
  }
  console.error(`gave up ${job.name}: ${last}`);
}

const queue = [...jobs];
const workers = Array.from({ length: 2 }, async () => {
  while (queue.length) {
    const job = queue.shift();
    if (job) await runJob(job);
  }
});
await Promise.all(workers);
console.log("art done");
