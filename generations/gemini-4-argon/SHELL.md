# Eval shell — Gemini 4 Argon

| Setting | Value |
|---------|--------|
| Port | **5181** (`DEV_PORT` in `.env`) |
| URL | http://127.0.0.1:5181 |
| Key | `OPENROUTER_API_KEY` in `.env` |

Do not use 5173 — other Desktop projects may own it. `vite.config.js` enforces `strictPort` on `DEV_PORT`.
