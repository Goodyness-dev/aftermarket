export type Model = "pistol" | "smg" | "rifle";
export const MODELS = {
  pistol: {
    name: "Vesper P9",
    label: "SIDEARM",
    base: 180,
    damage: 30,
    mag: 12,
    delay: 330,
    range: 33,
  },
  smg: {
    name: "Kestrel S4",
    label: "SUBMACHINE GUN",
    base: 390,
    damage: 19,
    mag: 24,
    delay: 115,
    range: 27,
  },
  rifle: {
    name: "Marrow R7",
    label: "ASSAULT RIFLE",
    base: 650,
    damage: 39,
    mag: 20,
    delay: 210,
    range: 60,
  },
} as const;
export type History = { who: string; action: string; at: number };
export type Gun = {
  id: string;
  model: Model;
  condition: number;
  owner: string;
  reserved?: string;
  history: History[];
};
export type Merchant = {
  id: string;
  name: string;
  role: string;
  cash: number;
  parts: number;
  stock: Gun[];
  target: number;
  demand: number;
};
export type Listing = {
  id: string;
  gunId: string;
  price: number;
  seller: string;
  created: number;
};
export type Receipt = { id: string; label: string; detail: string; at: number };
export type World = {
  cash: number;
  parts: number;
  ammo: number;
  inventory: Gun[];
  merchants: Merchant[];
  listings: Listing[];
  faction: { cash: number; stock: Gun[] };
  receipts: Receipt[];
  day: number;
  nextId: number;
  completed: number;
  contractDone: boolean;
  contractClaimed: boolean;
  reputation: number;
};
export const stamp = (who: string, action: string): History => ({
  who,
  action,
  at: Date.now(),
});
export function initialWorld(): World {
  let n = 42;
  const gun = (model: Model, owner: string, condition = 85): Gun => ({
    id: `DP-${String(n++).padStart(4, "0")}`,
    model,
    owner,
    condition,
    history: [stamp(owner, "Registered in Duskport")],
  });
  return {
    cash: 920,
    parts: 8,
    ammo: 160,
    inventory: [gun("pistol", "player", 92)],
    merchants: [
      {
        id: "mara",
        name: "Mara Voss",
        role: "ARMS BROKER",
        cash: 2400,
        parts: 0,
        target: 5,
        demand: 0,
        stock: [
          gun("rifle", "mara", 76),
          gun("smg", "mara", 92),
          gun("pistol", "mara", 67),
        ],
      },
      {
        id: "ivo",
        name: "Ivo Okoro",
        role: "GUNSMITH",
        cash: 1600,
        parts: 32,
        target: 3,
        demand: 0,
        stock: [gun("rifle", "ivo", 100)],
      },
      {
        id: "sable",
        name: "Sable Adeyemi",
        role: "QUARTERMASTER",
        cash: 1300,
        parts: 16,
        target: 3,
        demand: 0,
        stock: [gun("smg", "sable", 83), gun("pistol", "sable", 100)],
      },
    ],
    listings: [],
    faction: { cash: 2200, stock: [] },
    receipts: [],
    day: 1,
    nextId: n,
    completed: 0,
    contractDone: false,
    contractClaimed: false,
    reputation: 0,
  };
}
export function quote(merchant: Merchant, gun: Gun, side: "buy" | "sell") {
  const stock = merchant.stock.filter((g) => g.model === gun.model).length;
  const scarcity = Math.max(
    0.72,
    Math.min(1.4, 1 + (merchant.target - stock) * 0.065),
  );
  const condition = 0.35 + (0.65 * gun.condition) / 100;
  const value =
    MODELS[gun.model].base *
    condition *
    scarcity *
    (1 + merchant.demand * 0.025);
  const price = Math.round(value * (side === "sell" ? 0.68 : 1.13));
  return {
    price,
    reason: `${stock} ${gun.model}s in stock · target ${merchant.target} · condition ${gun.condition}%${merchant.demand ? " · active faction demand" : ""}`,
  };
}
export const distance = (
  a: { x: number; z: number },
  b: { x: number; z: number },
) => Math.hypot(a.x - b.x, a.z - b.z);
export type Obstacle = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  kind: "container" | "crate" | "wall";
  color?: string;
};
export const OBSTACLES: Obstacle[] = [
  { x: -10, z: 2, w: 5, d: 13, h: 3, kind: "container", color: "#ac5b35" },
  { x: 10, z: -2, w: 5, d: 13, h: 3, kind: "container", color: "#506d69" },
  { x: -10, z: 20, w: 5, d: 12, h: 3, kind: "container", color: "#536c76" },
  { x: 9, z: 20, w: 5, d: 10, h: 3, kind: "container", color: "#a6a18a" },
  { x: 0, z: 13, w: 3, d: 2, h: 1.3, kind: "crate" },
  { x: 4, z: 32, w: 3, d: 2, h: 1.5, kind: "crate" },
  { x: -4, z: 39, w: 4, d: 2, h: 1.2, kind: "crate" },
  { x: -16, z: 38, w: 4, d: 12, h: 4, kind: "wall" },
  { x: 16, z: 38, w: 4, d: 12, h: 4, kind: "wall" },
  { x: 0, z: 52, w: 12, d: 2, h: 3.2, kind: "container", color: "#6f7567" },
];
export function blocked(x: number, z: number, r = 0.4) {
  return (
    x < -21 + r ||
    x > 21 - r ||
    z < -16 + r ||
    z > 60 - r ||
    OBSTACLES.some(
      (o) => Math.abs(x - o.x) < o.w / 2 + r && Math.abs(z - o.z) < o.d / 2 + r,
    )
  );
}
export function lineBlocked(
  a: { x: number; z: number },
  b: { x: number; z: number },
) {
  const steps = Math.ceil(distance(a, b) * 4);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (
      OBSTACLES.some(
        (o) =>
          o.h > 1.6 &&
          Math.abs(a.x + (b.x - a.x) * t - o.x) < o.w / 2 &&
          Math.abs(a.z + (b.z - a.z) * t - o.z) < o.d / 2,
      )
    )
      return true;
  }
  return false;
}
export type Actor = {
  id: string;
  x: number;
  z: number;
  hp: number;
  model: Model;
  gunId?: string;
  state: string;
  yaw: number;
  lastShot: number;
  homeX: number;
  homeZ: number;
};
export type Crate = {
  id: string;
  x: number;
  z: number;
  type: "parts" | "ammo" | "gun";
  amount: number;
  gun?: Gun;
  taken: boolean;
};
export type Raid = {
  chainBacked?: boolean;
  outcome?: "extracted" | "lost";
  id: string;
  gunId: string;
  model: Model;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  mag: number;
  reserve: number;
  reloadUntil: number;
  started: number;
  lastShot: number;
  lastInput: number;
  seq: number;
  enemies: Actor[];
  crates: Crate[];
  loot: Gun[];
  parts: number;
  ammo: number;
  kills: number;
  departed: boolean;
  extract: number;
  finished: boolean;
  shots: {
    id: number;
    at?: number;
    x: number;
    z: number;
    tx: number;
    tz: number;
    enemy: boolean;
  }[];
};
export function newRaid(world: World, gunId: string): Raid {
  const g = world.inventory.find((g) => g.id === gunId && !g.reserved);
  if (!g) throw Error("Select an available weapon.");
  if (world.ammo < MODELS[g.model].mag)
    throw Error("Buy ammunition before deploying.");
  const id = crypto.randomUUID();
  g.reserved = id;
  const rounds = Math.min(world.ammo, MODELS[g.model].mag * 4);
  world.ammo -= rounds;
  const assigned = world.faction.stock.filter((g) => !g.reserved).slice(0, 2);
  assigned.forEach((g) => (g.reserved = id));
  const enemies: Actor[] = [
    [-3, 18],
    [5, 27],
    [-4, 35],
    [8, 43],
    [-7, 48],
  ].map(([x, z], i) => ({
    id: `guard-${i}`,
    x,
    z,
    homeX: x,
    homeZ: z,
    hp: 85,
    model: assigned[i]?.model ?? (i % 2 ? "smg" : "pistol"),
    gunId: assigned[i]?.id,
    state: i < 2 ? "PATROL" : "GUARD",
    yaw: Math.PI,
    lastShot: 0,
  }));
  const found: Gun = {
    id: `DP-${String(world.nextId++).padStart(4, "0")}`,
    model: "rifle",
    condition: 63,
    owner: id,
    history: [stamp("Freight Nine", "Recovered from abandoned shipment")],
  };
  return {
    id,
    gunId,
    model: g.model,
    x: 0,
    z: -11,
    yaw: 0,
    hp: 100,
    mag: MODELS[g.model].mag,
    reserve: rounds - MODELS[g.model].mag,
    reloadUntil: 0,
    started: Date.now(),
    lastShot: 0,
    lastInput: Date.now(),
    seq: 0,
    enemies,
    crates: [
      { id: "supply-a", x: -4, z: 5, type: "parts", amount: 6, taken: false },
      { id: "supply-b", x: 5, z: 16, type: "ammo", amount: 36, taken: false },
      {
        id: "supply-c",
        x: -3,
        z: 28,
        type: "gun",
        amount: 1,
        gun: found,
        taken: false,
      },
      { id: "supply-d", x: 8, z: 46, type: "parts", amount: 9, taken: false },
    ],
    loot: [],
    parts: 0,
    ammo: 0,
    kills: 0,
    departed: false,
    extract: 0,
    finished: false,
    shots: [],
  };
}
export function assertWorld(w: World) {
  const guns = [
    ...w.inventory,
    ...w.merchants.flatMap((m) => m.stock),
    ...w.faction.stock,
  ];
  if (new Set(guns.map((g) => g.id)).size !== guns.length)
    throw Error("Duplicate weapon");
  if (
    [
      w.cash,
      w.parts,
      w.ammo,
      w.faction.cash,
      ...w.merchants.flatMap((m) => [m.cash, m.parts]),
    ].some((n) => !Number.isSafeInteger(n) || n < 0)
  )
    throw Error("Invalid balance");
}
