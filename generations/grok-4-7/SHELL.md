# Eval shell — Grok 4.7

| Setting | Value |
|---------|--------|
| Port | **5182** (`DEV_PORT` in `.env`) |
| URL | http://127.0.0.1:5182 |
| Key | `OPENROUTER_API_KEY` in `.env` |

When you scaffold the app, pin the dev server to port **5182** with `strictPort: true` (see `vite.config.js` if present, or set `"dev": "vite --host 127.0.0.1 --port 5182 --strictPort"`).

Do not use 5173 or 5181 — those belong to other projects / the Argon shell.
