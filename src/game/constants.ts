/** Logical playfield — classic PoP room proportions */
export const VIEW_W = 640;
export const VIEW_H = 400;

export const TILE_W = 64;
export const TILE_H = 128;
export const ROOM_COLS = 10;
export const ROOM_ROWS = 3;

export const GRAVITY = 0.38;
export const MAX_FALL = 12;
export const RUN_SPEED = 2.45;
export const WALK_SPEED = 0.9;
export const JUMP_VX = 3.2;
export const JUMP_VY = -9.6;
export const UP_JUMP_VY = -10.8;
export const HANG_DROP = 0.5;

/** Demo timer: 20 minutes (full homage would be 60) */
export const START_SECONDS = 20 * 60;

export const PLAYER_MAX_HP = 3;
export const GUARD_HP = 3;

export const COLORS = {
  ink: "#0b1426",
  night: "#132038",
  skyDeep: "#0e1a2e",
  skyMoon: "#243a5c",
  sand: "#c4a574",
  sandLit: "#e0c896",
  sandDeep: "#8a6a3a",
  stone: "#5c4a32",
  stoneDark: "#3a2e1e",
  turquoise: "#2a9d8f",
  turquoiseDark: "#1a6b62",
  saffron: "#e9a319",
  blood: "#c23b22",
  parchment: "#e8d9b8",
  shadow: "#060a12",
  moon: "#d4e0f0",
  torch: "#ff9a3c",
} as const;
