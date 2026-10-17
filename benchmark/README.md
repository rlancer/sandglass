# Sandglass model benchmark

Compare image models on the same sprite brief for the Sandglass / Prince of Persia homage.

## Layout

```
PROMPT.md                 ← master prompt (edit this)
benchmark/
  poses.json              ← pose file list (machine-readable)
  active.json             ← which run the game uses
  runs/
    <run-id>/
      manifest.json       ← model, time, scores, file status
      SCORE.md            ← optional human notes
      raw/                ← API outputs
      ready/              ← processed transparent 256×256 sprites
public/sprites/ready/     ← copy of the active run (what the game loads)
```

## Current baseline

| Field | Value |
|-------|--------|
| Run ID | `openai-gpt-image-1` |
| Model | `openai/gpt-image-1` (OpenRouter) |
| Prompt | root [`PROMPT.md`](../PROMPT.md) |
| Generated | 2026-10-17 |

## Generate a new model pack

```bash
# requires OPENROUTER_API_KEY in .env
bun run sprites:gen -- --model openai/gpt-image-1
bun run sprites:gen -- --model black-forest-labs/flux-3-image
bun run sprites:gen -- --model google/gemini-2.5-flash-image

# process raw → ready, then activate into the game
bun run sprites:process -- --run <run-id>
bun run sprites:activate -- --run <run-id>
```

`run-id` defaults to a slug of the model name (e.g. `openai-gpt-image-1`).

Environment overrides:

| Var | Meaning |
|-----|---------|
| `OPENROUTER_API_KEY` | required |
| `OPENROUTER_IMAGE_MODEL` | default model if `--model` omitted |
| `FORCE=1` | overwrite existing raw files |
| `RUN_ID=my-label` | custom folder name under `benchmark/runs/` |

## Activate / compare

```bash
bun run sprites:activate -- --run openai-gpt-image-1
bun run sprites:list
```

Then `mise run dev` and play — the HUD/title still work; only character art swaps.

## Scoring

After generating, copy the rubric from `PROMPT.md` into `benchmark/runs/<run-id>/SCORE.md`.
