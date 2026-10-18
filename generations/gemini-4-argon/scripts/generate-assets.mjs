import fs from 'node:fs';
import path from 'node:path';

const envText = fs.readFileSync('.env', 'utf8');
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const key = process.env.OPENROUTER_API_KEY;
const outDir = path.resolve('public/assets');
fs.mkdirSync(outDir, { recursive: true });

const prompts = [
  {
    filename: 'title-mural.png',
    prompt:
      'Masterpiece 1989 MS-DOS VGA pixel-painted fantasy illustration in the style of classic Brøderbund Prince of Persia box art and Safavid Persian miniature painting. A brave Prince in white loose tunic, crimson sash, and headband leaps mid-air with gleaming scimitar across a torchlit stone dungeon chasm over iron floor spikes. In the background, an arched Persian palace window reveals a starry indigo night sky, a giant golden celestial hourglass pouring glowing sand, and the sinister Grand Vizier Jaffar in black and gold robes. Rich obsidian, burnished gold, lapis turquoise, and cinnabar red palette, no text.'
  },
  {
    filename: 'palace-bg.png',
    prompt:
      'Atmospheric 16-bit VGA pixel art panoramic background of an ancient Persian royal palace night sky seen through carved stone horseshoe arches. Deep obsidian and midnight lapis sky filled with golden astrolabe constellations, crescent moon, distant illuminated domes and minarets of Khorasan, subtle warm torchlight rim on dark carved limestone columns. Dark moody palette suitable as a parallax game background, no text, no characters.'
  },
  {
    filename: 'jaffar-portrait.png',
    prompt:
      '1989 VGA pixel art close-up character portrait of Grand Vizier Jaffar from Prince of Persia, gaunt aristocratic face with sharp goatee, towering black and gold silk turban with a ruby feather clasp, sinister emerald eyes, holding a glowing golden hourglass staff in a shadowy torchlit palace chamber. Crisp pixel art, rich chiaroscuro lighting, no text.'
  },
  {
    filename: 'princess-chamber.png',
    prompt:
      '1989 VGA pixel art scene of the Princess in an ornate Persian palace bedchamber at night, standing beside a massive floor-to-ceiling golden Hourglass filled with glowing amber sand. Intricate turquoise and gold geometric tilework, arched lattice window with moonlight, crimson Persian rug, dramatic warm candlelight, classic Jordan Mechner Prince of Persia 1989 aesthetic, no text.'
  }
];

async function generateOne({ filename, prompt }) {
  const target = path.join(outDir, filename);
  const models = [
    'google/gemini-2.5-flash-image',
    'google/gemini-3.1-flash-image-preview',
    'openai/gpt-5-image-mini'
  ];

  for (const model of models) {
    try {
      console.log(`Generating ${filename} via ${model}...`);
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          modalities: ['image', 'text'],
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await res.json();
      const msg = data?.choices?.[0]?.message;
      let dataUrl = null;

      if (Array.isArray(msg?.images) && msg.images.length > 0) {
        dataUrl = msg.images[0]?.image_url?.url || msg.images[0]?.url;
      }
      if (!dataUrl && Array.isArray(msg?.content)) {
        for (const part of msg.content) {
          if (part?.type === 'image_url' && part?.image_url?.url) {
            dataUrl = part.image_url.url;
          }
        }
      }

      if (dataUrl && dataUrl.startsWith('data:image')) {
        const base64 = dataUrl.split(',')[1];
        fs.writeFileSync(target, Buffer.from(base64, 'base64'));
        console.log(`Saved ${filename} (${fs.statSync(target).size} bytes)`);
        return true;
      } else {
        console.warn(`No image returned from ${model} for ${filename}:`, JSON.stringify(data).slice(0, 250));
      }
    } catch (err) {
      console.warn(`Error with ${model} for ${filename}:`, err.message);
    }
  }
  return false;
}

await Promise.all(prompts.map(generateOne));
