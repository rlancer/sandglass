// Map legend (each room is 10 x 3 cells, each cell's floor sits at its bottom):
//  .  empty           _  floor          #  wall           ~  loose floor
//  ^  spikes          K  chomper        T  torch          W  window
//  I  pillar          A-F gate          a-f plate (opens gate of same letter)
//  X  exit (closed)   x  exit plate     O  exit (open)
//  !  red potion      $  life potion    ?  poison         S  sword
//  E  mirror shard    P  player start   G  guard          J  Jaffar   Z  princess
//
// Maps are written room-by-room; rows of rooms are joined left to right.

function join(...rooms) {
  return rooms[0].map((_, i) => rooms.map((r) => r[i]).join(""));
}

export const LEVELS = [
  {
    name: "The Dungeon",
    theme: "dungeon",
    art: "dungeon",
    intro: "Beneath the palace, the Vizier's prisoners are left to rot.\nFind a blade. Find the way up.",
    guard: "jailer",
    map: [
      ...join(
        ["##########", "#.........", "#_P_T.____"],
        ["####......", "....._~~__", "_____#...."],
        ["..........", "__^___..__", "######^^##"],
        ["###.__S###", "__T_______", "##########"],
        ["##########", "_!x_T_G_X#", "##########"],
      ),
    ],
    gates: {},
    hints: [
      { c: 2, r: 2, text: "Arrows / WASD run.  Hold UP + RIGHT to leap the pit." },
      { c: 13, r: 2, text: "Face the wall and press UP to climb." },
      { c: 15, r: 1, text: "Loose stones! Keep running, or leap with UP while running." },
      { c: 21, r: 1, text: "Hold SHIFT to step carefully over spikes." },
      { c: 24, r: 1, text: "Build speed, then press UP to clear wide gaps." },
      { c: 32, r: 1, text: "Stand beneath the ledge and press UP." },
      { c: 35, r: 0, text: "A scimitar! Press DOWN to take it." },
      { c: 41, r: 1, text: "DOWN drinks potions.  SPACE strikes, UP parries." },
    ],
  },
  {
    name: "Hall of Mirrors",
    theme: "mirrors",
    art: "mirrors",
    intro: "Jaffar shattered the Mirror of Ahura to steal the hours of the world.\nIts shards remember everything you do.",
    guard: "shade",
    map: [
      ...join(
        ["##########", "#.........", "#_P_T_E_W_"],
        ["##########", "..........", "__a_T__A_$"],
        ["..........", "___._T_B__", "###b######"],
        ["###.x_####", "__G_T__X_#", "##########"],
      ),
    ],
    gates: {
      A: { hold: 0.25, close: 0.9 },
      B: { hold: 0.25, close: 0.9 },
    },
    hints: [
      { c: 6, r: 2, text: "A Mirror Shard. Press DOWN to take it." },
      { c: 11, r: 2, text: "E: start recording.  E again: rewind. Your shadow replays your steps." },
      { c: 13, r: 2, text: "This gate slams the moment the plate is free. Let your shadow hold it." },
      { c: 21, r: 1, text: "Shadows have weight. Send yours into the pit." },
    ],
  },
  {
    name: "The Blade Arcade",
    theme: "palace",
    art: "palace",
    intro: "The palace halls are lined with the Vizier's blades.\nTime them, or be cut in two.",
    guard: "palace",
    map: [
      ...join(
        ["##########", "#.........", "#P_T_I_W__"],
        ["##########", "..........", "__K__K__T_"],
        ["##########", "..........", "__I_G_!___"],
        ["##########", "..........", "_T___.####"],
      ),
      ...join(
        ["##########", "#_X_T_x___", "##########"],
        ["##########", "___..__G__", "###^^#####"],
        ["####a_.###", "__A__T____", "##########"],
        ["#####~####", "_^__T____#", "##########"],
      ),
    ],
    gates: {
      A: { hold: 0, close: 0.7 },
    },
    hints: [
      { c: 11, r: 2, text: "Watch the rhythm of the blades. Dash through when the jaws part." },
      { c: 34, r: 2, text: "A drop into darkness..." },
      { c: 27, r: 4, text: "The plate is above, the gate is behind. Who will stand where?" },
    ],
  },
  {
    name: "The Vizier's Tower",
    theme: "tower",
    art: "tower",
    intro: "At the top of the tower the princess waits,\nand Jaffar waits with her.",
    guard: "palace",
    map: [
      ...join(
        ["##########", "#.........", "#P_T_K__K_"],
        ["##########", "..........", "_!c_T_?cC_"],
        ["##########", "..........", "__T__J_TDZ"],
      ),
    ],
    gates: {
      C: { hold: 1.2, close: 1.0, mode: "all" },
      D: { mode: "boss" },
    },
    hints: [
      { c: 11, r: 2, text: "Two plates, one gate. You will need to be in two places at once." },
      { c: 16, r: 2, text: "Not every potion is a friend." },
      { c: 21, r: 2, text: "JAFFAR: \"Your shadow is mine, boy. As is your time.\"" },
    ],
  },
];
