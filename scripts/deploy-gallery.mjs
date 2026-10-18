/**
 * Publish site-dist with Cloudflare CLI (`cf deploy`) — no Wrangler CLI.
 */
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "site-dist");
const deployDir = join(root, "deploy");

if (!existsSync(join(site, "index.html"))) {
  console.error("Missing site-dist/index.html — run: bun run gallery:build");
  process.exit(1);
}

function run(cmd, args, cwd) {
  console.log(`\n> ${cmd} ${args.join(" ")}  (${cwd})`);
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      CI: "1",
      CLOUDFLARE_ACCOUNT_ID:
        process.env.CLOUDFLARE_ACCOUNT_ID ?? "3315bb3e7d2e3556bfea6fb3947a890e",
    },
  });
  return r.status ?? 1;
}

if (!existsSync(join(deployDir, "node_modules", "cf"))) {
  const code = run("bun", ["install"], deployDir);
  if (code !== 0) process.exit(code);
}

process.exit(run("bunx", ["cf", "deploy"], deployDir));
