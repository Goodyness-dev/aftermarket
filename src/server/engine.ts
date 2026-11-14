import {
  MODELS,
  quote,
  stamp,
  assertWorld,
  newRaid,
  distance,
  blocked,
  lineBlocked,
  type World,
  type Raid,
  type Gun,
} from "../domain/game.js";
export function receipt(w: World, label: string, detail: string) {
  w.receipts.unshift({
    id: crypto.randomUUID(),
    label,
    detail,
    at: Date.now(),
  });
  w.receipts = w.receipts.slice(0, 50);
}
export function command(w: World, raid: Raid | null, a: any): Raid | null {
  if (
    ["sell", "list", "dismantle"].includes(a.type) &&
    String(a.gunId).startsWith("LOAN")
  )
    throw Error("Recovery weapons cannot be sold, listed or dismantled.");
  if (raid && !raid.finished && a.type !== "abandon")
    throw Error("Finish or abandon your active raid first.");
  const merchant = w.merchants.find((m) => m.id === a.merchant);
  const gun = w.inventory.find((g) => g.id === a.gunId && !g.reserved);
  switch (a.type) {
    case "deploy":
      return newRaid(w, a.gunId);
    case "abandon":
      if (raid && !raid.finished) finish(w, raid, false);
      return null;
    case "buy": {
      if (!merchant) throw Error("Unknown merchant.");
      const g = merchant.stock.find((g) => g.id === a.gunId);
      if (!g) throw Error("That weapon has already sold.");
      const q = quote(merchant, g, "buy");
      if (a.price !== q.price)
        throw Error("Quote changed. Review the new price.");
      if (w.cash < q.price) throw Error("Insufficient credits.");
      w.cash -= q.price;
      merchant.cash += q.price;
      merchant.stock = merchant.stock.filter((x) => x.id !== g.id);
      g.owner = "player";
      g.history.push(stamp("player", `Purchased from ${merchant.name}`));
      w.inventory.push(g);
      receipt(
        w,
        "Purchase confirmed",
        `${g.id} · ${MODELS[g.model].name} · −${q.price} cr`,
      );
      break;
    }
    case "sell": {
      if (!merchant || !gun) throw Error("Weapon unavailable or reserved.");
      const q = quote(merchant, gun, "sell");
      if (a.price !== q.price)
        throw Error("Quote changed. Review the new price.");
      if (merchant.cash < q.price)
        throw Error("Dealer has insufficient purchasing cash.");
      merchant.cash -= q.price;
      w.cash += q.price;
      w.inventory = w.inventory.filter((g) => g.id !== gun.id);
      gun.owner = merchant.id;
      gun.history.push(
        stamp(merchant.name, `Purchased for ${q.price} credits`),
      );
      merchant.stock.push(gun);
      merchant.demand = Math.max(0, merchant.demand - 1);
      receipt(
        w,
        "Sale confirmed",
        `${gun.id} → ${merchant.name} · +${q.price} cr`,
      );
      break;
    }
    case "repair": {
      if (!gun) throw Error("Weapon unavailable.");
      const cost = Math.ceil((100 - gun.condition) * 1.7),
        parts = Math.ceil((100 - gun.condition) / 12),
        ivo = w.merchants[1];
      if (!parts) throw Error("Weapon is already fully repaired.");
      if (w.cash < cost || w.parts < parts)
        throw Error(`Repair needs ${cost} credits and ${parts} parts.`);
      if (ivo.parts < 2) throw Error("Ivo needs workshop supplies.");
      w.cash -= cost;
      w.parts -= parts;
      ivo.cash += cost;
      ivo.parts -= 2;
      gun.condition = 100;
      gun.history.push(stamp("Ivo Okoro", "Rebuilt and calibrated"));
      receipt(
        w,
        "Workshop completed",
        `${gun.id} restored · −${cost} cr · −${parts} parts`,
      );
      break;
    }
    case "dismantle":
      if (!gun) throw Error("Weapon unavailable.");
      if (w.inventory.length === 1)
        throw Error("Keep at least one weapon for your next run.");
      w.inventory = w.inventory.filter((g) => g.id !== gun.id);
      w.parts += gun.model === "rifle" ? 7 : gun.model === "smg" ? 4 : 2;
      receipt(
        w,
        "Weapon dismantled",
        `${gun.id} permanently converted to salvage`,
      );
      break;
    case "ammo": {
      const m = w.merchants[2];
      if (w.cash < 90 || m.parts < 1)
        throw Error("Ammunition unavailable or insufficient credits.");
      w.cash -= 90;
      m.cash += 90;
      m.parts--;
      w.ammo += 60;
      receipt(w, "Supplies received", "60 rounds · −90 cr");
      break;
    }
    case "list":
      if (!gun) throw Error("Weapon unavailable.");
      if (!Number.isSafeInteger(a.price) || a.price < 25 || a.price > 5000)
        throw Error("Set a whole-credit price between 25 and 5,000.");
      gun.reserved = "listing";
      w.listings.push({
        id: crypto.randomUUID(),
        gunId: gun.id,
        price: a.price,
        seller: "player",
        created: Date.now(),
      });
      receipt(
        w,
        "Listing opened",
        `${gun.id} · ${a.price} cr · reserved until filled or cancelled`,
      );
      break;
    case "cancel": {
      const l = w.listings.find((l) => l.id === a.listingId);
      if (!l) throw Error("Listing no longer available.");
      const g = w.inventory.find((g) => g.id === l.gunId);
      if (g) delete g.reserved;
      w.listings = w.listings.filter((x) => x.id !== l.id);
      receipt(w, "Listing cancelled", "Your weapon is available again.");
      break;
    }
    case "shift":
      advance(w);
      break;
    case "claim":
      if (w.contractClaimed || !w.contractDone)
        throw Error("Contract reward unavailable.");
      w.contractClaimed = true;
      w.cash += 240;
      w.reputation += 15;
      receipt(
        w,
        "Contract paid",
        "Recovered shipment · +240 cr · +15 standing",
      );
      break;
    case "recovery":
      if (w.inventory.some((g) => !g.reserved) || w.cash >= 180)
        throw Error("Recovery kit is only for stranded operators.");
      {
        const g: Gun = {
          id: `LOAN-${w.nextId++}`,
          owner: "player",
          model: "pistol",
          condition: 65,
          history: [stamp("Depot", "Recovery weapon — not tradable")],
        };
        w.inventory.push(g);
        w.ammo += 36;
        receipt(
          w,
          "Recovery kit issued",
          "A basic pistol and 36 rounds. Loan weapons cannot be traded.",
        );
        break;
      }
    default:
      throw Error("Unknown action.");
  }
  assertWorld(w);
  return null;
}
export function advance(w: World) {
  w.day++;
  for (const l of [...w.listings]) {
    const g = w.inventory.find((g) => g.id === l.gunId);
    if (!g) continue;
    const m = w.merchants.find(
      (m) => m.cash >= l.price && quote(m, g, "sell").price >= l.price,
    );
    if (!m) continue;
    m.cash -= l.price;
    w.cash += l.price;
    w.inventory = w.inventory.filter((x) => x.id !== g.id);
    delete g.reserved;
    g.owner = m.id;
    g.history.push(stamp(m.name, "Filled player listing"));
    m.stock.push(g);
    w.listings = w.listings.filter((x) => x.id !== l.id);
    receipt(w, "Listing filled", `${g.id} → ${m.name} · +${l.price} cr`);
  }
  for (const m of w.merchants) {
    const g = m.stock.findLast((g) => g.model === "rifle");
    if (g && w.faction.stock.length < 4) {
      const price = Math.round(
        MODELS[g.model].base * (0.5 + g.condition / 200),
      );
      if (w.faction.cash >= price) {
        w.faction.cash -= price;
        m.cash += price;
        m.stock = m.stock.filter((x) => x.id !== g.id);
        g.owner = "faction";
        g.history.push(
          stamp("Harbor Authority", "Procured for a Freight Nine guard"),
        );
        w.faction.stock.push(g);
        receipt(
          w,
          "Faction procurement",
          `${g.id} assigned to Harbor Authority · ${price} cr paid to ${m.name}`,
        );
      }
    }
    m.demand = Math.min(8, m.demand + 1);
  }
  receipt(
    w,
    `Shift ${w.day} opened`,
    "Procurement processed. Dealer prices respond to stock and funded demand.",
  );
  assertWorld(w);
}
export function finish(w: World, r: Raid, success: boolean) {
  if (r.finished) return;
  r.finished = true;
  r.outcome = success ? "extracted" : "lost";
  const carried = w.inventory.find((g) => g.id === r.gunId);
  if (carried) delete carried.reserved;
  if (success) {
    w.parts += r.parts;
    w.ammo += r.mag + r.reserve + r.ammo;
    for (const g of r.loot) {
      g.owner = "player";
      delete g.reserved;
      g.history.push(stamp("player", "Extracted from Freight Nine"));
      w.inventory.push(g);
    }
    if (carried) carried.condition = Math.max(15, carried.condition - 4);
    w.completed++;
    w.reputation += 3;
    if (r.loot.some((g) => g.model === "rifle")) w.contractDone = true;
    receipt(
      w,
      "Extraction confirmed",
      `${r.loot.length} weapons · ${r.parts} parts · ${r.kills} hostiles · carried ammunition returned`,
    );
  } else {
    if (carried) {
      w.inventory = w.inventory.filter((g) => g.id !== carried.id);
      carried.owner = "mara";
      carried.condition = Math.max(15, carried.condition - 20);
      if (!carried.id.startsWith("LOAN")) {
        carried.history.push(
          stamp("Mara Voss", "Recovered by a salvage crew after raid loss"),
        );
        w.merchants[0].stock.push(carried);
      }
    }
    receipt(
      w,
      "Operator recovered",
      "Carried gear lost. Your depot stash is safe.",
    );
  }
  // Reserved faction guns recovered as loot leave faction custody exactly once.
  const lootIds = new Set(r.loot.map((g) => g.id));
  w.faction.stock = w.faction.stock.filter(
    (g) => !(success && lootIds.has(g.id)),
  );
  for (const g of w.faction.stock) if (g.reserved === r.id) delete g.reserved;
  assertWorld(w);
}
export function interact(w: World, r: Raid) {
  const c = r.crates.find(
    (c) => !c.taken && distance(r, c) < 2.6 && !lineBlocked(r, c),
  );
  if (c) {
    c.taken = true;
    if (c.type === "parts") r.parts += c.amount;
    else if (c.type === "ammo") r.ammo += c.amount;
    else if (c.gun) r.loot.push(structuredClone(c.gun));
    return;
  }
}
export function tick(
  w: World,
  r: Raid,
  input: {
    forward: number;
    strafe: number;
    yaw: number;
    shoot: boolean;
    reload: boolean;
    interact: boolean;
  },
  dt: number,
  now = Date.now(),
) {
  if (r.finished) return;
  dt = Math.min(0.075, Math.max(0, dt));
  r.yaw = input.yaw;
  const len = Math.max(1, Math.hypot(input.forward, input.strafe));
  const f = input.forward / len,
    s = input.strafe / len;
  const dx = (Math.sin(r.yaw) * f + Math.cos(r.yaw) * s) * 4.7 * dt,
    dz = (Math.cos(r.yaw) * f - Math.sin(r.yaw) * s) * 4.7 * dt;
  if (!blocked(r.x + dx, r.z)) r.x += dx;
  if (!blocked(r.x, r.z + dz)) r.z += dz;
  if (r.reloadUntil && now >= r.reloadUntil) {
    const count = Math.min(MODELS[r.model].mag - r.mag, r.reserve);
    r.mag += count;
    r.reserve -= count;
    r.reloadUntil = 0;
  }
  if (
    input.reload &&
    !r.reloadUntil &&
    r.reserve > 0 &&
    r.mag < MODELS[r.model].mag
  )
    r.reloadUntil = now + 1600;
  if (
    input.shoot &&
    !r.reloadUntil &&
    r.mag > 0 &&
    now - r.lastShot >= MODELS[r.model].delay
  ) {
    r.lastShot = now;
    r.mag--;
    const target = r.enemies
      .filter(
        (e) =>
          e.hp > 0 &&
          distance(e, r) < MODELS[r.model].range &&
          !lineBlocked(r, e),
      )
      .map((e) => ({
        e,
        angle: Math.abs(
          Math.atan2(
            Math.sin(Math.atan2(e.x - r.x, e.z - r.z) - r.yaw),
            Math.cos(Math.atan2(e.x - r.x, e.z - r.z) - r.yaw),
          ),
        ),
      }))
      .filter((x) => x.angle < 0.085)
      .sort((a, b) => distance(a.e, r) - distance(b.e, r))[0]?.e;
    const shot = {
      id: now * 16,
      at: now,
      x: r.x,
      z: r.z,
      tx: target?.x ?? r.x + Math.sin(r.yaw) * 40,
      tz: target?.z ?? r.z + Math.cos(r.yaw) * 40,
      enemy: false,
    };
    r.shots.push(shot);
    if (target) {
      target.hp -= MODELS[r.model].damage;
      if (target.hp <= 0) {
        target.state = "DOWN";
        r.kills++;
        const actual = w.faction.stock.find((g) => g.id === target.gunId);
        if (actual)
          r.crates.push({
            id: target.id,
            x: target.x,
            z: target.z,
            type: "gun",
            amount: 1,
            gun: structuredClone(actual),
            taken: false,
          });
        else if (!r.chainBacked) {
          const g: Gun = {
            id: `DP-${String(w.nextId++).padStart(4, "0")}`,
            model: target.model,
            condition: 48,
            owner: r.id,
            history: [stamp("Freight Nine", "Scavenged patrol weapon")],
          };
          r.crates.push({
            id: target.id,
            x: target.x,
            z: target.z,
            type: "gun",
            amount: 1,
            gun: g,
            taken: false,
          });
        }
      }
    }
  }
  for (const [enemyIndex, e] of r.enemies.entries()) {
    if (e.hp <= 0) continue;
    const d = distance(e, r),
      visible = d < 22 && !lineBlocked(e, r);
    if (visible) {
      e.state = d < 11 ? "ENGAGE" : "PURSUE";
      e.yaw = Math.atan2(r.x - e.x, r.z - e.z);
      if (d > 10) {
        const x = e.x + Math.sin(e.yaw) * 1.7 * dt,
          z = e.z + Math.cos(e.yaw) * 1.7 * dt;
        if (!blocked(x, z)) {
          e.x = x;
          e.z = z;
        }
      }
      if (d < 20 && now - e.lastShot > 1450) {
        e.lastShot = now;
        r.hp = Math.max(0, r.hp - (d < 10 ? 9 : 5));
        r.shots.push({
          id: now * 16 + enemyIndex + 1,
          at: now,
          x: e.x,
          z: e.z,
          tx: r.x,
          tz: r.z,
          enemy: true,
        });
      }
    } else {
      e.state = "PATROL";
      const t = (now - r.started) / 1000;
      const tx = e.homeX + Math.sin(t * 0.35 + e.homeZ) * 2,
        tz = e.homeZ + Math.cos(t * 0.3) * 2;
      e.yaw = Math.atan2(tx - e.x, tz - e.z);
      const x = e.x + Math.sin(e.yaw) * dt,
        z = e.z + Math.cos(e.yaw) * dt;
      if (!blocked(x, z)) {
        e.x = x;
        e.z = z;
      }
    }
  }
  if (input.interact) interact(w, r);
  const near =
    distance(r, { x: 0, z: -12 }) < 2.5 || distance(r, { x: 0, z: 57 }) < 3;
  if (distance(r, { x: 0, z: -11 }) > 7) r.departed = true;
  r.extract = near && r.departed && now - r.started > 8000 ? r.extract + dt : 0;
  r.shots = r.shots.slice(-12);
  if (r.hp <= 0 || now - r.started > 8 * 60e3) finish(w, r, false);
  else if (r.extract >= 3) finish(w, r, true);
}
