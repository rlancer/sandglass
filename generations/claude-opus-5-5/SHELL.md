# Eval shell — Claude Opus 5.5

| Setting | Value |
|---------|--------|
| Port | **5183** (`DEV_PORT` in `.env`) |
| URL | http://127.0.0.1:5183 |
| Key | `OPENROUTER_API_KEY` in `.env` |

When you scaffold the app, pin the dev server to port **5183** with `strictPort: true` (`vite.config.js` is pre-seeded).

Do not use 5173, 5181, or 5182 — those belong to other projects / eval shells.
