import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialWorld,
  quote,
  newRaid,
  assertWorld,
  MODELS,
} from "../src/domain/game.js";
import {
  command,
  advance,
  finish,
  tick,
  interact,
} from "../src/server/engine.js";

test("simultaneous guard shots have distinct visual identities and real event timestamps", () => {
  const w = initialWorld(),
    raid = newRaid(w, w.inventory[0].id),
    now = Date.now() + 2000;
  raid.enemies = raid.enemies.slice(0, 3);
  raid.enemies.forEach((guard, index) => {
    guard.x = index - 1;
    guard.z = -5;
  });
  tick(
    w,
    raid,
    {
      forward: 0,
      strafe: 0,
      yaw: 0,
      shoot: true,
      reload: false,
      interact: false,
    },
    0.05,
    now,
  );
  assert.equal(raid.shots.filter((shot) => shot.enemy).length, 3);
  assert.equal(
    new Set(raid.shots.map((shot) => shot.id)).size,
    raid.shots.length,
  );
  assert.equal(
    raid.shots.every((shot) => shot.at === now),
    true,
  );
});

test("a trade conserves credits and transfers the exact weapon only once", () => {
  const w = initialWorld(),
    m = w.merchants[0],
    g = m.stock[0],
    total = w.cash + m.cash;
  const p = quote(m, g, "buy").price;
  command(w, null, { type: "buy", merchant: m.id, gunId: g.id, price: p });
  assert.equal(w.cash + m.cash, total);
  assert.equal(w.inventory.find((x) => x.id === g.id)?.owner, "player");
  assert.throws(() =>
    command(w, null, { type: "buy", merchant: m.id, gunId: g.id, price: p }),
  );
  assertWorld(w);
});
test("stale price and insufficient cash leave balances unchanged", () => {
  const w = initialWorld(),
    m = w.merchants[0],
    g = m.stock[0],
    before = JSON.stringify(w);
  assert.throws(() =>
    command(w, null, { type: "buy", merchant: m.id, gunId: g.id, price: 1 }),
  );
  assert.equal(JSON.stringify(w), before);
  w.cash = 0;
  assert.throws(() =>
    command(w, null, {
      type: "buy",
      merchant: m.id,
      gunId: g.id,
      price: quote(m, g, "buy").price,
    }),
  );
  assert.equal(w.cash, 0);
});
test("listing locks an item; an affordable dealer fill pays once", () => {
  const w = initialWorld(),
    g = w.inventory[0],
    cash = w.cash;
  command(w, null, { type: "list", gunId: g.id, price: 100 });
  assert.equal(g.reserved, "listing");
  assert.throws(() =>
    command(w, null, {
      type: "sell",
      gunId: g.id,
      merchant: "mara",
      price: 100,
    }),
  );
  advance(w);
  assert.equal(w.cash, cash + 100);
  assert.equal(w.listings.length, 0);
  advance(w);
  assert.equal(w.cash, cash + 100);
  assertWorld(w);
});
test("cancellation releases the listed weapon without a payment", () => {
  const w = initialWorld(),
    g = w.inventory[0],
    cash = w.cash;
  command(w, null, { type: "list", gunId: g.id, price: 5000 });
  command(w, null, { type: "cancel", listingId: w.listings[0].id });
  assert.equal(g.reserved, undefined);
  assert.equal(w.cash, cash);
});
test("repairs consume finite parts and credits; cannot repeat at full condition", () => {
  const w = initialWorld(),
    g = w.inventory[0],
    cash = w.cash,
    parts = w.parts;
  command(w, null, { type: "repair", gunId: g.id });
  assert.equal(g.condition, 100);
  assert.ok(w.cash < cash);
  assert.ok(w.parts < parts);
  assert.throws(() => command(w, null, { type: "repair", gunId: g.id }));
  assertWorld(w);
});
test("movement cannot cross containers or exceed simulation step speed", () => {
  const w = initialWorld(),
    r = newRaid(w, w.inventory[0].id);
  r.x = -6;
  r.z = 2;
  const input = {
    forward: 0,
    strafe: -1,
    yaw: 0,
    shoot: false,
    reload: false,
    interact: false,
  };
  for (let i = 0; i < 100; i++)
    tick(w, r, input, 0.05, r.started + 1000 + i * 50);
  assert.ok(r.x >= -7.1);
});
test("reload transfers rounds rather than creating ammunition", () => {
  const w = initialWorld(),
    r = newRaid(w, w.inventory[0].id);
  r.mag = 2;
  const total = r.mag + r.reserve;
  const input = {
    forward: 0,
    strafe: 0,
    yaw: 0,
    shoot: false,
    reload: true,
    interact: false,
  };
  tick(w, r, input, 0.05, r.started + 100);
  tick(w, r, { ...input, reload: false }, 0.05, r.started + 2000);
  assert.equal(r.mag, MODELS.pistol.mag);
  assert.equal(r.mag + r.reserve, total);
});
test("extraction is idempotent and a failed raid cannot mint loot", () => {
  const w = initialWorld(),
    r = newRaid(w, w.inventory[0].id);
  r.x = -3;
  r.z = 28;
  interact(w, r);
  assert.equal(r.loot.length, 1);
  finish(w, r, true);
  const saved = JSON.stringify(w);
  finish(w, r, true);
  assert.equal(JSON.stringify(w), saved);
  assertWorld(w);
  const r2 = newRaid(w, w.inventory[0].id);
  r2.x = -3;
  r2.z = 28;
  interact(w, r2);
  const gunId = r2.loot[0].id;
  finish(w, r2, false);
  assert.ok(!w.inventory.some((g) => g.id === gunId));
  assertWorld(w);
});
test("sale → procurement → guard → recovered rifle preserves one identity", () => {
  const w = initialWorld(),
    r = newRaid(w, w.inventory[0].id);
  r.x = -3;
  r.z = 28;
  interact(w, r);
  const id = r.loot[0].id;
  finish(w, r, true);
  const g = w.inventory.find((g) => g.id === id)!,
    m = w.merchants[0];
  command(w, null, {
    type: "sell",
    gunId: id,
    merchant: m.id,
    price: quote(m, g, "sell").price,
  });
  advance(w);
  assert.equal(w.faction.stock.find((g) => g.id === id)?.owner, "faction");
  const next = newRaid(w, w.inventory[0].id),
    guard = next.enemies.find((e) => e.gunId === id)!;
  assert.ok(guard);
  next.x = guard.x;
  next.z = guard.z - 4;
  next.yaw = 0;
  next.mag = 20;
  for (let i = 0; i < 4; i++)
    tick(
      w,
      next,
      {
        forward: 0,
        strafe: 0,
        yaw: 0,
        shoot: true,
        reload: false,
        interact: false,
      },
      0.05,
      next.started + 1000 + i * 400,
    );
  assert.ok(guard.hp <= 0);
  next.x = guard.x;
  next.z = guard.z;
  interact(w, next);
  assert.ok(next.loot.some((g) => g.id === id));
  finish(w, next, true);
  assert.equal(w.inventory.filter((g) => g.id === id).length, 1);
  assert.ok(!w.faction.stock.some((g) => g.id === id));
  assert.ok(
    w.inventory
      .find((g) => g.id === id)!
      .history.some((h) => h.who === "Harbor Authority"),
  );
  assertWorld(w);
});
test("five hundred procurement shifts cannot produce negative budgets or duplicate guns", () => {
  const w = initialWorld();
  for (let i = 0; i < 500; i++) {
    advance(w);
    assertWorld(w);
  }
  assert.ok(w.faction.cash >= 0);
  assert.equal(w.faction.stock.length, 2);
});
test("recovery weapons cannot become an economic faucet", () => {
  const w = initialWorld();
  w.inventory = [];
  w.cash = 0;
  command(w, null, { type: "recovery" });
  const id = w.inventory[0].id;
  assert.throws(() =>
    command(w, null, { type: "sell", gunId: id, merchant: "mara", price: 100 }),
  );
  assert.throws(() =>
    command(w, null, { type: "list", gunId: id, price: 100 }),
  );
  assert.throws(() => command(w, null, { type: "dismantle", gunId: id }));
});

test("standing at deployment does not award an automatic extraction", () => {
  const w = initialWorld(),
    r = newRaid(w, w.inventory[0].id);
  const input = {
    forward: 0,
    strafe: 0,
    yaw: 0,
    shoot: false,
    reload: false,
    interact: false,
  };
  for (let i = 0; i < 300; i++)
    tick(w, r, input, 0.05, r.started + 10000 + i * 50);
  assert.equal(r.finished, false);
  assert.equal(r.extract, 0);
  assert.equal(w.completed, 0);
  r.z = 0;
  tick(w, r, input, 0.05, r.started + 26000);
  assert.equal(r.departed, true);
  r.z = -12;
  for (let i = 0; i < 62; i++)
    tick(w, r, input, 0.05, r.started + 27000 + i * 50);
  assert.equal(r.finished, true);
  assert.equal(w.completed, 1);
});
