# Model generations — Prince of Persia (1989) brief

Same creative brief, separate Cursor agent runs. Root of this repo is the **Composer / Sandglass** baseline.

| Folder | Model | Notes |
|--------|--------|--------|
| _(repo root)_ | Composer | Original Sandglass build |
| [`gemini-4-argon/`](./gemini-4-argon/) | Gemini 4 Argon | Astral Hourglass |
| [`claude-opus-5-5/`](./claude-opus-5-5/) | Claude Opus 5.5 | Mirror of Shadows |

Each generation is a **self-contained** Vite app (own `package.json`, assets, scripts).

```bash
cd generations/gemini-4-argon   # or claude-opus-5-5
cp .env.example .env            # add OPENROUTER_API_KEY if regenerating art
bun install
bun run dev
```

Eval shell ports used during the harness runs (optional): Argon `5181`, Opus `5183` — see each `SHELL.md`.
