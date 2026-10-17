# Sandglass model benchmark

Compare image models on the **same** sprite brief. Each model gets its own folder automatically.

## Layout

```
PROMPT.md                          ← master prompt (edit this)
benchmark/
  poses.json
  active.json                      ← which model pack the game uses
  models/
    openai-gpt-image-1/            ← slug from model id
      manifest.json
      SCORE.md
      raw/                         ← API outputs
      ready/                       ← processed 256×256 cutouts
    google-gemini-2-5-flash-image/
      ...
public/sprites/
  active.json                      ← mirrored for the browser
  models/<slug>/                   ← activated ready sprites (served to game)
```

Slug rule: `openai/gpt-image-1` → `openai-gpt-image-1`  
Optional second pack of the same model: `--label try2` → `openai-gpt-image-1__try2`

## Baseline

| Field | Value |
|-------|--------|
| Slug | `openai-gpt-image-1` |
| Model | `openai/gpt-image-1` |
| Prompt | [`PROMPT.md`](../PROMPT.md) |

## Commands

```bash
# new model → creates benchmark/models/<slug>/ automatically
bun run sprites:gen -- --model black-forest-labs/flux-3-image
bun run sprites:process -- --model black-forest-labs/flux-3-image
bun run sprites:activate -- --model black-forest-labs/flux-3-image

# same model, separate folder
bun run sprites:gen -- --model openai/gpt-image-1 --label v2

bun run sprites:list
```

| Flag / env | Meaning |
|------------|---------|
| `--model` | OpenRouter model id (required for new packs) |
| `--label` | Optional variant suffix on the folder |
| `--slug` | Pin exact folder name (advanced) |
| `FORCE=1` | Overwrite existing raw files |

## Scoring

Copy the rubric from `PROMPT.md` into `benchmark/models/<slug>/SCORE.md`.
