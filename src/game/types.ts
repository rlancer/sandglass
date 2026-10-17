export type Facing = -1 | 1;

export type TileKind =
  | "empty"
  | "floor"
  | "wall"
  | "pillar"
  | "spikes"
  | "gate"
  | "loose"
  | "exit"
  | "torch";

export interface Tile {
  kind: TileKind;
  /** Gate open amount 0..1; loose fall progress */
  state: number;
  solid: boolean;
}

export interface RoomLink {
  left?: string;
  right?: string;
  up?: string;
  down?: string;
}

export interface GuardSpawn {
  x: number;
  y: number;
  facing?: Facing;
  hp?: number;
}

export interface PickupSpawn {
  type: "sword" | "heal" | "life";
  x: number;
  y: number;
}

export interface SwitchSpawn {
  x: number;
  y: number;
  /** Gate tile keys "col,row" in this or linked room */
  gates: { room: string; col: number; row: number }[];
}

export interface RoomDef {
  id: string;
  /** Row-major string map, ROOM_ROWS lines of ROOM_COLS chars */
  map: string[];
  links: RoomLink;
  guards?: GuardSpawn[];
  pickups?: PickupSpawn[];
  switches?: SwitchSpawn[];
  /** Soft parallax tint override */
  mood?: "dungeon" | "palace" | "tower" | "mirror";
}

export interface LevelDef {
  id: number;
  name: string;
  subtitle: string;
  startRoom: string;
  startX: number;
  closedGates: { room: string; col: number; row: number }[];
  rooms: RoomDef[];
  startWithSword?: boolean;
}

export type PlayerAnim =
  | "idle"
  | "run"
  | "walk"
  | "jump"
  | "fall"
  | "land"
  | "hang"
  | "climb"
  | "crouch"
  | "fight"
  | "strike"
  | "hurt"
  | "die"
  | "pickup";

export type GamePhase =
  | "title"
  | "levelintro"
  | "playing"
  | "paused"
  | "dead"
  | "levelclear"
  | "win"
  | "timeup";
