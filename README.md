# SANDGLASS

A browser homage to *Prince of Persia* (1989) with a procedural palace generator — also set up as an **image-model sprite benchmark**.

## Play

```bash
mise run install
mise run dev
```

Or: `bun install && bun run dev`

## Controls

| Key | Action |
|-----|--------|
| ← → | Select level (title) / run (game) |
| R | Re-roll palace seed (title) |
| Enter | Start / confirm |
| Shift | Careful step |
| Z / Space / ↑ | Jump, climb ledge |
| ↓ | Crouch / drop |
| X | Strike |
| P / Esc | Pause |

## Sprite benchmark

Master prompt (edit this): **[`PROMPT.md`](./PROMPT.md)**  
Details: [`benchmark/README.md`](./benchmark/README.md)

**Baseline run:** `openai-gpt-image-1` → model `openai/gpt-image-1` (OpenRouter, 2026-10-17)

```bash
# list packs
bun run sprites:list

# generate a new model pack (needs OPENROUTER_API_KEY in .env)
bun run sprites:gen -- --model black-forest-labs/flux-3-image
bun run sprites:process -- --run black-forest-labs-flux-3-image
bun run sprites:activate -- --run black-forest-labs-flux-3-image
```

Each run lives under `benchmark/runs/<run-id>/` with `manifest.json`, `raw/`, and `ready/`. Activating copies `ready/` into `public/sprites/ready/` for the game.

## Procedural levels

Each campaign seed builds 3 tiers (~6 / ~9 / ~11 rooms). Press **R** on the title screen for a new seed.
