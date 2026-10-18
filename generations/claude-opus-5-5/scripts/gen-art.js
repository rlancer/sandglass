// Generates the painted artwork used by the game via OpenRouter image models.
// Usage: bun scripts/gen-art.js [name ...]   (Bun loads .env automatically)
import { mkdir, writeFile, exists } from "node:fs/promises";

const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) throw new Error("OPENROUTER_API_KEY missing from .env");
const MODEL = process.env.ART_MODEL || "google/gemini-3-pro-image";
const OUT = "public/art";

const STYLE =
  "Painted in the style of a late-1980s Persian-miniature-inspired video game box illustration, rich lapis blue, saffron gold and deep crimson, dramatic chiaroscuro lighting, painterly brushwork, no text, no letters, no watermark, no UI.";

const ART = {
  title: `Wide cinematic 16:9 scene: a lone young Persian prince in white baggy trousers, red sash and white turban, holding a curved scimitar, standing on a moonlit palace balcony. Behind him a tall ornate gilded mirror reflects not him but his dark shadow self, smoky and glowing faint cyan at the edges. Onion domes and minarets of a sleeping city under a giant moon in the background. ${STYLE}`,
  dungeon: `Wide 16:9 illustration of a vast dark dungeon beneath a Persian palace: wet stone archways, chains, flickering wall torches, iron portcullis gates, a crumbling floor over a black abyss, blue mist. ${STYLE}`,
  mirrors: `Wide 16:9 illustration of a forgotten hall of shattered mirrors inside a Persian palace: tall broken arched mirrors, each shard reflecting a silhouette of a running shadow figure, cool cyan moonlight through lattice windows, gold mosaic floor. ${STYLE}`,
  palace: `Wide 16:9 illustration of a grand Persian palace interior at night: arcades of pointed arches, intricate tilework, hanging brass lanterns, a hidden blade trap in the floor, warm amber light. ${STYLE}`,
  tower: `Wide 16:9 illustration of the sorcerer-vizier's tower: a tall gaunt vizier in purple robes and a towering turban casting glowing purple sorcery, swirling sand and hourglasses floating in the air, a caged princess in the distance. ${STYLE}`,
  skyline: `Wide 16:9 view through a palace window at night: a Persian city of domes and minarets under a huge pale moon, starry indigo sky, warm lit windows in the distance. ${STYLE}`,
  victory: `Wide 16:9 illustration: the young prince in white embracing the princess in a rose and gold gown on a palace terrace at dawn, the shattered mirror behind them with golden sand drifting away like smoke, sunrise over domes. ${STYLE}`,
};

async function gen(name, prompt) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      modalities: ["image", "text"],
      image_config: { aspect_ratio: "16:9" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status} ${await res.text()}`);
  const json = await res.json();
  const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error(`${name}: no image in response ${JSON.stringify(json).slice(0, 400)}`);
  const [, mime, b64] = url.match(/^data:image\/(\w+);base64,(.*)$/s) ?? [];
  if (!b64) throw new Error(`${name}: unexpected image url format`);
  const ext = mime === "jpeg" ? "jpg" : mime;
  await writeFile(`${OUT}/${name}.${ext}`, Buffer.from(b64, "base64"));
  console.log(`✓ ${name}.${ext}`);
  return ext;
}

await mkdir(OUT, { recursive: true });
const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : Object.keys(ART);
const manifest = {};
await Promise.all(
  names.map(async (n) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        manifest[n] = await gen(n, ART[n]);
        return;
      } catch (e) {
        console.warn(`attempt ${attempt} failed: ${e.message}`);
      }
    }
  }),
);
const manifestPath = `${OUT}/manifest.json`;
const prev = (await exists(manifestPath)) ? await Bun.file(manifestPath).json() : {};
await writeFile(manifestPath, JSON.stringify({ ...prev, ...manifest }, null, 2));
