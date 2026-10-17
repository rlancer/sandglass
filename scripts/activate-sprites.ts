/**
 * Activate a model pack for the game.
 *
 *   bun run sprites:activate -- --model openai/gpt-image-1
 *   bun run sprites:activate -- --model google/gemini-2.5-flash-image --label try2
 */
import { activateModel, parseArgs, resolvePack } from "./lib/bench";

const args = parseArgs(process.argv.slice(2));
const { model, slug, label } = resolvePack(args);

activateModel(slug, model, label);
console.log(`Active model → ${model}`);
console.log(`Slug         → ${slug}`);
console.log(`Served from  → public/sprites/models/${slug}/`);
