import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "sandglass",
    compatibilityDate: "2026-10-18",
    observability: { enabled: true },
    assets: {
      notFoundHandling: "404-page",
      htmlHandling: "auto-trailing-slash",
    },
  },
});
