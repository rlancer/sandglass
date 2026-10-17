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

Master prompt: **[`PROMPT.md`](./PROMPT.md)** · details: [`benchmark/README.md`](./benchmark/README.md)

Each model automatically gets `benchmark/models/<model-slug>/` (raw + ready + manifest).

**Baseline:** `openai/gpt-image-1` → `benchmark/models/openai-gpt-image-1/`

```bash
bun run sprites:list

# needs OPENROUTER_API_KEY in .env — folder is created from the model id
bun run sprites:gen -- --model black-forest-labs/flux-3-image
bun run sprites:process -- --model black-forest-labs/flux-3-image
bun run sprites:activate -- --model black-forest-labs/flux-3-image
```

## Procedural levels

Each campaign seed builds 3 tiers (~6 / ~9 / ~11 rooms). Press **R** on the title screen for a new seed.
