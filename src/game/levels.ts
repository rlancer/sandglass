import { generateCampaign } from "./generate";
import type { LevelDef } from "./types";

export type { LevelDef };

/** Active campaign — regenerated from seed */
let campaignSeed = 0x5a7d91a5;
let campaign: LevelDef[] = generateCampaign(campaignSeed);

export function getCampaignSeed(): number {
  return campaignSeed;
}

export function getLevels(): LevelDef[] {
  return campaign;
}

export function setCampaignSeed(seed: number): LevelDef[] {
  campaignSeed = seed >>> 0 || 1;
  campaign = generateCampaign(campaignSeed);
  return campaign;
}

export function rerollCampaign(seed?: number): LevelDef[] {
  const s =
    seed ??
    ((Math.floor(Math.random() * 0xffffffff) ^ (Date.now() * 2654435761)) >>> 0);
  return setCampaignSeed(s);
}

export function levelCount(): number {
  return campaign.length;
}
