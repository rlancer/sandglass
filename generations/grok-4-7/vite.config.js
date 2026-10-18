import { defineConfig, loadEnv } from "vite";

/** Pre-seeded so Grok’s game uses this shell’s port even before package.json exists. */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.DEV_PORT || 5182);
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
