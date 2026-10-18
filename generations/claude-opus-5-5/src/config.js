export const TW = 64; // tile width
export const TH = 128; // tile (story) height
export const FT = 12; // floor slab thickness
export const ROOM_W = 10;
export const ROOM_H = 3;
export const VIEW_W = TW * ROOM_W; // 640
export const VIEW_H = TH * ROOM_H; // 384
export const HUD_H = 26;
export const SCREEN_W = VIEW_W;
export const SCREEN_H = VIEW_H + HUD_H;

export const DT = 1 / 120;
export const GRAVITY = 1500;
export const MAX_FALL = 1000;

export const PLAYER_H = 64;
export const CROUCH_H = 36;
export const HALF_W = 8;

export const RUN_SPEED = 190;
export const WALK_SPEED = 58;
export const RUN_JUMP_VX = 295;
export const RUN_JUMP_VY = -360;
export const STAND_JUMP_VX = 190;
export const STAND_JUMP_VY = -380;

export const FALL_SAFE = 150;
export const FALL_HURT = 285;

export const ECHO_MAX = 10; // seconds of recordable shadow
export const ECHO_LINGER = 4; // seconds the shadow holds its last pose

export const TIME_LIMIT = 60 * 60;

export const surfaceY = (r) => (r + 1) * TH - FT;
