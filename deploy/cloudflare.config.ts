import { defineConfig } from "cf/config";

const accountId = "3315bb3e7d2e3556bfea6fb3947a890e";

export default defineConfig(({ mode }) => {
  const staging = mode === "staging";

  return {
    accountId,
    worker: {
      name: staging ? "sandglass-staging" : "sandglass",
      compatibilityDate: "2026-10-18",
      observability: { enabled: true },
      workersDev: true,
      assets: {
        notFoundHandling: "404-page",
        htmlHandling: "auto-trailing-slash",
      },
      domains: staging
        ? ["staging.sandglass.robertlancer.com"]
        : ["sandglass.robertlancer.com"],
    },
  };
});
