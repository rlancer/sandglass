/**
 * Assemble gallery/ + built generations into site-dist/ for Cloudflare Pages.
 */
import { cpSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "site-dist");

function run(cmd, args, cwd) {
  console.log(`\n> ${cmd} ${args.join(" ")}  (${cwd})`);
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function ensureInstall(dir) {
  if (!existsSync(join(dir, "node_modules"))) {
    run("bun", ["install"], dir);
  }
}

function buildVite(dir, base, destName) {
  ensureInstall(dir);
  run("bunx", ["vite", "build", "--base", base, "--outDir", join(out, destName), "--emptyOutDir"], dir);
}

if (existsSync(out)) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

cpSync(join(root, "gallery", "index.html"), join(out, "index.html"));
cpSync(join(root, "gallery", "styles.css"), join(out, "styles.css"));

// Composer baseline (repo root)
ensureInstall(root);
run("bunx", ["tsc", "--noEmit"], root);
run(
  "bunx",
  ["vite", "build", "--base", "/composer/", "--outDir", join(out, "composer"), "--emptyOutDir"],
  root,
);

buildVite(join(root, "generations", "gemini-4-argon"), "/gemini-4-argon/", "gemini-4-argon");
buildVite(join(root, "generations", "grok-4-7"), "/grok-4-7/", "grok-4-7");
buildVite(join(root, "generations", "claude-opus-5-5"), "/claude-opus-5-5/", "claude-opus-5-5");

console.log(`\nGallery ready at ${out}`);