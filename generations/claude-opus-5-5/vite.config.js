import { defineConfig, loadEnv } from "vite";

/** Pre-seeded so Opus's game uses this shell's port. */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.DEV_PORT || 5183);
  return {
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true,
    },
    preview: {
      host: "127.0.0.1",
      port,
      strictPort: true,
    },
  };
});
