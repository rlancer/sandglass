// 1989 Prince of Persia Room Architecture (10 columns × 3 tiers per room)
// Each tile in the 10×3 grid represents a floor platform at the bottom of that cell
// plus whatever object/trap/wall occupies that cell.
//
// Tile Codes:
// '.' : Empty air (no floor, chasm below)
// '#' : Solid stone wall block (impassable column + floor)
// '_' : Solid stone floor slab
// 'T' : Solid floor slab + flickering Wall Torch
// 'P' : Solid floor slab + carved Persian Pillar
// 'W' : Solid floor slab + Arched Palace Window (shows starry Khorasan vista)
// 'L' : Loose Stone Floor Slab (rattles when stepped on, crashes down!)
// 'S' : Floor Spikes (spring out when run across; safe with Careful Step [Shift])
// 'C' : Chomper / Jaws of Steel (rhythmic slicing guillotine)
// 'B' : Raise-Gate Pressure Plate (opens linked portcullis gates in room)
// 'G' : Portcullis Iron Gate (blocks passage until raised by plate)
// 'R' : Red Healing Potion (+1 Health Triangle)
// 'V' : Golden Life Vessel Pitcher (+1 Max Health & full heal)
// 'X' : Blue Poison Vial (-1 Health Triangle, classic 1989 trap!)
// 'F' : Green Feather-Fall Potion (weightless slow descent for 12s)
// 'K' : Gleaming Persian Scimitar on Altar (unlocks Sword Combat)
// 'M' : The Magic Mirror (running jump through it splits your Dark Shadow!)
// 'E' : Palace Level Exit Door (raised when room's master plate is triggered)
// 'H' : The Astral Hourglass of Khorasan (Finale centerpiece)

export const TILE_TYPES = [
  { code: '_', label: 'Floor (_)' },
  { code: '.', label: 'Chasm (.)' },
  { code: '#', label: 'Wall (#)' },
  { code: 'L', label: 'Loose Slab (L)' },
  { code: 'S', label: 'Spikes (S)' },
  { code: 'C', label: 'Chomper (C)' },
  { code: 'B', label: 'Plate (B)' },
  { code: 'G', label: 'Gate (G)' },
  { code: 'R', label: 'Heal Potion (R)' },
  { code: 'V', label: 'Life Vessel (V)' },
  { code: 'T', label: 'Torch (T)' },
  { code: 'M', label: 'Mirror (M)' }
];

export const INITIAL_ROOMS = [
  {
    id: 0,
    sector: 'SECTOR I · SUBTERRANEAN CISTERNS',
    title: "Room 1 · The Prisoner's Drop",
    tags: 'Loose Slabs · Spikes · Careful Step',
    theme: 'dungeon',
    lore:
      'Thrown into Jaffar’s dungeon. Hold [Shift] + Left/Right to Careful-Step safely through floor spikes, or hold [Shift] while falling off an edge to grab the ledge. Run right to enter Room 2.',
    spawn: { col: 1, row: 0, facing: 1 },
    neighbors: { right: 1 },
    grid: [
      ['#', '_', 'T', 'L', '_', 'P', '_', 'T', '_', '_'],
      ['#', '_', 'T', '_', 'S', '_', '_', 'P', 'R', '_'],
      ['#', '_', '_', 'S', 'S', '_', 'T', '_', '_', '_']
    ],
    guards: []
  },
  {
    id: 1,
    sector: 'SECTOR I · SUBTERRANEAN CISTERNS',
    title: 'Room 2 · The Loose Stone Shaft',
    tags: 'Pressure Plate · Loose Tile Puzzle · Gate',
    theme: 'dungeon',
    lore:
      'The heavy portcullis on the bottom floor blocks your escape. Step onto the Loose Slab [L] on the upper ledge so it crashes down onto the Pressure Plate [B] below, locking the gate open!',
    spawn: { col: 1, row: 0, facing: 1 },
    neighbors: { left: 0, right: 2 },
    grid: [
      ['_', '_', 'T', 'L', '_', '_', 'T', '_', 'R', '#'],
      ['_', 'P', '_', '.', '_', 'T', '_', '_', '.', '#'],
      ['_', 'T', '_', 'B', '_', 'S', '_', 'G', '_', '_']
    ],
    guards: []
  },
  {
    id: 2,
    sector: 'SECTOR I · GUARDHOUSE',
    title: 'Room 3 · The Scimitar & The Sentinel',
    tags: 'Sword Pickup · First Guard Duel',
    theme: 'dungeon',
    lore:
      'Crouch or press [Shift]/[Space] over the gleaming Scimitar on the upper altar to arm yourself. Drop down to duel the Dungeon Captain: press [Up] to Parry his slash, then immediately press [Space] to Riposte!',
    spawn: { col: 1, row: 2, facing: 1 },
    neighbors: { left: 1, right: 3 },
    grid: [
      ['#', '_', 'T', 'K', '_', 'P', 'T', '_', 'V', '#'],
      ['#', '_', '_', '_', '.', '_', '_', 'T', '.', '#'],
      ['_', '_', 'T', '_', '_', 'B', '_', '_', 'G', '_']
    ],
    guards: [
      {
        col: 6.5,
        row: 2,
        facing: -1,
        hp: 3,
        maxHp: 3,
        name: 'DUNGEON SENTINEL',
        skill: 0.55,
        tint: '#D97736',
        vest: '#8A2432'
      }
    ]
  },
  {
    id: 3,
    sector: 'SECTOR II · TORTURE GALLERY',
    title: 'Room 4 · The Guillotine Corridor',
    tags: 'Jaws of Steel · Running Jump · Guard',
    theme: 'dungeon',
    lore:
      'Time your sprint or Careful-Step right up to the rhythmic Jaws of Steel [C]. On the upper gallery, take a Running Jump ([Left/Right] + [Up]) to clear the spiked chasm.',
    spawn: { col: 1, row: 2, facing: 1 },
    neighbors: { left: 2, right: 4 },
    grid: [
      ['#', '_', 'T', '_', 'C', '_', '.', '_', 'R', '#'],
      ['#', '.', '_', 'T', '_', 'P', '_', '_', 'T', '#'],
      ['_', '_', 'C', '_', 'S', '_', 'T', 'B', 'G', '_']
    ],
    guards: [
      {
        col: 6.2,
        row: 1,
        facing: -1,
        hp: 3,
        maxHp: 3,
        name: 'JAILER BLADEMASTER',
        skill: 0.65,
        tint: '#38B8A8',
        vest: '#1E3A8A'
      }
    ]
  },
  {
    id: 4,
    sector: 'SECTOR II · ASTRAL SANCTUM',
    title: 'Room 5 · Hall of the Shadow Twin',
    tags: 'Shadow Echo [E] · Body Swap [Q] · Gate Puzzle',
    theme: 'palace',
    lore:
      'SIGNATURE VARIATION MECHANIC: The pressure plate [B] on the upper balcony only holds the lower gate open while someone stands on it! Stand on [B], press [E] to manifest your Shadow Twin on the plate, then drop down and sprint through the gate—or sprint toward the gate and press [E] then [Q]!',
    spawn: { col: 1, row: 2, facing: 1 },
    neighbors: { left: 3, right: 5 },
    grid: [
      ['#', '_', 'W', 'B', '_', 'P', 'W', '_', 'V', '#'],
      ['#', '_', 'T', '_', '_', 'T', '_', '_', '.', '#'],
      ['_', '_', 'P', '_', 'S', '_', 'T', '_', 'G', '_']
    ],
    guards: []
  },
  {
    id: 5,
    sector: 'SECTOR II · ROYAL APOTHECARY',
    title: 'Room 6 · The Alchemist’s Vault',
    tags: 'Feather-Fall Potion · Life Vessel · Poison Trick',
    theme: 'palace',
    lore:
      'Four crystal flasks rest in the Royal Apothecary: Crimson restores health, Gold increases maximum life triangles, Emerald grants weightless Feather-Fall down deep shafts, and Cobalt is Jaffar’s poison trap!',
    spawn: { col: 1, row: 0, facing: 1 },
    neighbors: { left: 4, right: 6 },
    grid: [
      ['_', '_', 'W', 'F', '_', 'X', 'W', 'V', '.', '#'],
      ['#', 'P', '_', '_', 'C', '_', 'T', '_', '.', '#'],
      ['#', '_', 'T', 'R', '_', 'B', '_', 'S', 'G', '_']
    ],
    guards: [
      {
        col: 4.5,
        row: 2,
        facing: -1,
        hp: 4,
        maxHp: 4,
        name: 'APOTHECARY WARDEN',
        skill: 0.68,
        tint: '#A855F7',
        vest: '#4C1D95'
      }
    ]
  },
  {
    id: 6,
    sector: 'SECTOR III · MECHANICAL WORKS',
    title: 'Room 7 · Jaws of Steel & Falling Slabs',
    tags: 'Double Chompers · Loose Bridge · Rewind [Hold R]',
    theme: 'dungeon',
    lore:
      'A classic 1989 gauntlet of synchronized steel slicers and crumbling bridges. Remember: if a blade or spike catches you, hold [R] immediately to rewind the Astral Hourglass!',
    spawn: { col: 1, row: 2, facing: 1 },
    neighbors: { left: 5, right: 7 },
    grid: [
      ['#', 'V', '_', 'C', '_', 'L', 'L', '_', 'B', '#'],
      ['#', '.', '_', 'T', 'C', '_', 'T', '_', '.', '#'],
      ['_', '_', 'C', '_', '_', 'S', '_', 'T', 'G', '_']
    ],
    guards: []
  },
  {
    id: 7,
    sector: 'SECTOR III · STARLIT TERRACE',
    title: 'Room 8 · The Astrolabe Courtyard',
    tags: 'Khorasan Night Vista · Long Leaps · Elite Guard',
    theme: 'palace',
    lore:
      'High above Khorasan beneath golden constellations. Use running jumps ([Run] + [Up]) and ledge grabs ([Hold Shift]) across the moonlit limestone arches.',
    spawn: { col: 1, row: 2, facing: 1 },
    neighbors: { left: 6, right: 8 },
    grid: [
      ['#', '_', 'W', '.', '_', 'W', '.', '_', 'B', '#'],
      ['#', '_', 'P', '_', '.', 'P', '_', '_', '.', '#'],
      ['_', '_', 'W', '_', 'S', 'W', '_', 'R', 'G', '_']
    ],
    guards: [
      {
        col: 6.5,
        row: 2,
        facing: -1,
        hp: 4,
        maxHp: 4,
        name: 'ROYAL JANISSARY',
        skill: 0.74,
        tint: '#EAB308',
        vest: '#991B1B'
      }
    ]
  },
  {
    id: 8,
    sector: 'SECTOR IV · HALL OF REFLECTIONS',
    title: 'Room 9 · Chamber of the Magic Mirror',
    tags: 'Iconic 1989 Mirror Leap · Dark Shadow Split',
    theme: 'palace',
    lore:
      'Jordan Mechner’s most famous moment: climb to the top gallery and take a fearless Running Jump straight through the ornate Magic Mirror [M]! Shattering it splits your Dark Reflection loose while opening the lower gate.',
    spawn: { col: 1, row: 2, facing: 1 },
    neighbors: { left: 7, right: 9 },
    grid: [
      ['#', '_', 'W', '_', '_', 'M', '_', 'W', 'B', '#'],
      ['#', '_', 'P', '_', 'T', '_', '.', '_', '.', '#'],
      ['_', '_', 'W', '_', '_', 'T', 'R', '_', 'G', '_']
    ],
    guards: []
  },
  {
    id: 9,
    sector: 'SECTOR IV · INNER SANCTUM',
    title: 'Room 10 · The Twin Lock Sanctum',
    tags: 'Co-op with Your Shadow Twin · Palace Exit Door',
    theme: 'palace',
    lore:
      'Stand on the upper pressure plate [B], press [E] to leave your Shadow Twin holding the mechanism open, or swap with [Q] to slip past the twin portcullis gates toward Vizier Jaffar’s throne room!',
    spawn: { col: 1, row: 2, facing: 1 },
    neighbors: { left: 8, right: 10 },
    grid: [
      ['#', '_', 'W', 'B', '_', 'C', '_', 'W', 'V', '#'],
      ['#', '_', 'T', '_', '_', 'P', '_', 'R', '.', '#'],
      ['_', '_', 'G', '_', 'S', '_', 'T', '_', 'G', '_']
    ],
    guards: [
      {
        col: 6.2,
        row: 2,
        facing: -1,
        hp: 4,
        maxHp: 4,
        name: 'SANCTUM IMMORTAL',
        skill: 0.78,
        tint: '#EC4899',
        vest: '#581C87'
      }
    ]
  },
  {
    id: 10,
    sector: 'SECTOR V · GRAND VIZIER SANCTUM',
    title: 'Room 11 · Throne of Grand Vizier Jaffar',
    tags: 'Final Boss Duel · Grand Vizier Jaffar',
    theme: 'palace',
    lore:
      'Grand Vizier Jaffar awaits with his enchanted scimitar! Parry his rapid flurries with [Up], counter-strike with [Space], or summon your Shadow Twin [E] to flank him from behind. Defeating Jaffar unlocks the Princess’s Chamber!',
    spawn: { col: 1, row: 2, facing: 1 },
    neighbors: { left: 9, right: 11 },
    grid: [
      ['#', 'W', '_', 'P', 'W', 'P', '_', 'W', 'V', '#'],
      ['#', '_', 'T', '_', '.', '_', 'T', '_', '.', '#'],
      ['_', '_', 'P', '_', '_', '_', 'P', 'B', 'G', '_']
    ],
    guards: [
      {
        col: 6.8,
        row: 2,
        facing: -1,
        hp: 6,
        maxHp: 6,
        role: 'jaffar',
        name: 'GRAND VIZIER JAFFAR',
        skill: 0.85,
        tint: '#191229',
        vest: '#991B1B'
      }
    ]
  },
  {
    id: 11,
    sector: 'SECTOR V · THE ASTRAL OBSERVATORY',
    title: 'Room 12 · The Princess & The Hourglass',
    tags: 'Victory Finale · The Sands Restored',
    theme: 'palace',
    lore:
      'Jaffar’s spell is broken! Approach the Princess and the giant Astral Hourglass of Khorasan on the royal dais to unite the Prince and his Shadow and complete your chronicle.',
    spawn: { col: 1, row: 2, facing: 1 },
    neighbors: { left: 10 },
    grid: [
      ['#', 'W', 'P', 'W', '_', 'W', 'P', 'W', '_', '#'],
      ['#', '_', 'T', '_', '.', '_', 'T', '_', '_', '#'],
      ['_', '_', 'P', '_', '_', 'H', '_', '_', 'E', '#']
    ],
    guards: []
  }
];
