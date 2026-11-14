import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { LiveGame } from "../src/server/live-game.js";
import {
  NearTransport,
  accountId,
  type Role,
} from "../src/server/settlement.js";
import { newRaid, quote } from "../src/domain/game.js";
import { tick } from "../src/server/engine.js";
import { driveRecovery } from "./raid-driver.js";
import type { Prepared, ChainResult } from "../src/server/settlement.js";
import type { Intent } from "../src/server/settlement.js";

class ReadOnlyFixture extends NearTransport {
  override async check() {}
  override async height() {
    return 1000;
  }
  override async view<T>(
    method: string,
    args: Record<string, unknown>,
  ): Promise<T> {
    let value: unknown;
    if (method === "mt_token")
      value = [
        {
          token_id: "DP-0042",
          owner_id: accountId("pilot"),
          model: "pistol",
          condition: 100,
        },
        {
          token_id: "R-042",
          owner_id: accountId("harbor"),
          model: "rifle",
          condition: 100,
        },
      ];
    else if (method === "reservation") value = null;
    else if (method === "mt_balance_of")
      value = String(
        (
          {
            pilot: 920,
            mara: 2400,
            ivo: 1600,
            sable: 1300,
            harbor: 2200,
          } as Record<string, number>
        )[String(args.account_id).split(".")[0]],
      );
    else if (method === "npc_budget") value = "100";
    else if (method === "get_listing") value = null;
    else throw Error(`Unexpected read ${method}`);
    return value as T;
  }
  override async client(_role: Role): Promise<never> {
    throw Error("This test must never sign");
  }
}

test("a rejected NPC payment releases its listing safely across a lost cancellation response", async () => {
  const db = new DatabaseSync(":memory:");
  class RejectedPayment extends ReadOnlyFixture {
    open = false;
    signs = 0;
    cancellations = 0;
    override async view<T>(
      method: string,
      args: Record<string, unknown>,
    ): Promise<T> {
      if (method === "npc_budget") return "2400" as T;
      if (method === "get_listing")
        return (this.open ? { seller: accountId("pilot") } : null) as T;
      return super.view<T>(method, args);
    }
    override async prepare(intent: Intent): Promise<Prepared> {
      this.signs++;
      return {
        bytes: JSON.stringify(intent),
        hash: intent.method,
        reserve: "1000",
      };
    }
    override async submit(tx: Prepared): Promise<ChainResult> {
      const intent = JSON.parse(tx.bytes) as Intent;
      const result: ChainResult = {
        state: "confirmed",
        value: null,
        logs: [],
        burnt: "100",
      };
      if (intent.method === "list_weapon") {
        this.open = true;
        result.value = "17";
      }
      if (intent.method === "fill_listing_for_npc") result.state = "failed";
      if (intent.method === "cancel_listing") {
        this.open = false;
        if (++this.cancellations === 1)
          throw Error("Cancellation accepted but response lost");
      }
      return result;
    }
  }
  const transport = new RejectedPayment(),
    game = new LiveGame(db, transport);
  await game.enter("pilot");
  const command = {
    type: "sell",
    requestId: "rejected-sale",
    gunId: "DP-0042",
    merchant: "mara",
    price: quote(
      game.state.world.merchants[0],
      game.state.world.inventory[0],
      "sell",
    ).price,
  };
  await game.perform(command);
  assert.equal(game.state.job?.state, "failed");
  assert.equal(game.state.world.cash, 920);
  await assert.rejects(game.reconcile("outsider"), /active local pilot/);
  await assert.rejects(game.reconcile("pilot"), /response lost/);
  const restarted = new LiveGame(db, transport);
  await restarted.reconcile("pilot");
  assert.equal(restarted.state.job, null);
  assert.equal(restarted.state.world.cash, 920);
  assert.equal(restarted.state.world.inventory[0].reserved, undefined);
  assert.equal(transport.signs, 3);
  assert.equal(transport.cancellations, 2);
  await assert.rejects(restarted.perform(command), /rejected and reconciled/);
  db.close();
});

test("a rejected guard assignment cancels a pre-combat reservation without awarding loot", async () => {
  const db = new DatabaseSync(":memory:");
  class RejectedGuard extends ReadOnlyFixture {
    reserved = false;
    closed = false;
    calls: Intent[] = [];
    override async view<T>(
      method: string,
      args: Record<string, unknown>,
    ): Promise<T> {
      if (method === "get_raid")
        return (
          this.reserved
            ? {
                player: accountId("pilot"),
                weapon: "DP-0042",
                expires_at: "2800",
                settled: this.closed,
              }
            : null
        ) as T;
      return super.view<T>(method, args);
    }
    override async prepare(intent: Intent): Promise<Prepared> {
      this.calls.push(intent);
      return {
        bytes: JSON.stringify(intent),
        hash: intent.method,
        reserve: "1000",
      };
    }
    override async submit(tx: Prepared): Promise<ChainResult> {
      const intent: Intent = JSON.parse(tx.bytes);
      if (intent.method === "begin_raid") this.reserved = true;
      if (intent.method === "settle_raid") this.closed = true;
      return {
        state: intent.method === "assign_raid_loot" ? "failed" : "confirmed",
        value: null,
        logs: [],
        burnt: "100",
      };
    }
  }
  const transport = new RejectedGuard(),
    game = new LiveGame(db, transport);
  await game.enter("pilot");
  await game.perform({
    type: "deploy",
    requestId: "rejected-deployment",
    gunId: "DP-0042",
  });
  assert.equal(game.state.job?.state, "failed");
  assert.equal(game.state.raid, null);
  assert.equal(game.state.world.ammo, 160);
  await game.reconcile("pilot");
  assert.equal(transport.closed, true);
  assert.equal(game.state.job, null);
  assert.equal(game.state.world.inventory.length, 1);
  assert.equal(game.state.world.completed, 0);
  const cancellation = transport.calls.find(
    (call) => call.method === "settle_raid",
  )!;
  assert.deepEqual(cancellation.args.recovered, []);
  assert.equal(cancellation.args.success, true);
  assert.equal(game.state.world.ammo, 160);
  db.close();
});

test("the live projection uses existing chain assets and keeps a single local pilot lease", async () => {
  const db = new DatabaseSync(":memory:");
  const game = new LiveGame(db, new ReadOnlyFixture());
  await game.enter("first-browser");
  assert.deepEqual(
    game.state.world.inventory.map((g) => g.id),
    ["DP-0042"],
  );
  assert.deepEqual(
    game.state.world.faction.stock.map((g) => g.id),
    ["R-042"],
  );
  assert.equal(game.state.world.merchants.flatMap((m) => m.stock).length, 0);
  assert.equal(game.state.world.cash, 920);
  await assert.rejects(game.enter("another-browser"), /another local browser/);
  await assert.rejects(
    game.perform({
      type: "sell",
      requestId: "bad-sale",
      gunId: "DP-0042",
      merchant: "mara",
      price: 700,
    }),
    /budget/,
  );
  await assert.rejects(
    game.perform({ type: "mint", requestId: "client-reward" }),
    /practice mode/,
  );
  const restarted = new LiveGame(db, new ReadOnlyFixture());
  assert.equal(restarted.isOwner("first-browser"), true);
  restarted.exit("first-browser");
  assert.equal(restarted.isOwner("first-browser"), false);
  db.close();
});

test("testnet guards without assigned registered guns cannot generate tradable loot", async () => {
  const db = new DatabaseSync(":memory:");
  const game = new LiveGame(db, new ReadOnlyFixture());
  await game.enter("pilot");
  const raid = newRaid(game.state.world, "DP-0042");
  raid.chainBacked = true;
  raid.crates = [];
  raid.enemies = [raid.enemies[1]];
  const guard = raid.enemies[0];
  guard.x = 0;
  guard.z = -5;
  guard.hp = 1;
  guard.gunId = undefined;
  tick(
    game.state.world,
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
    Date.now() + 1000,
  );
  assert.equal(guard.hp <= 0, true);
  assert.equal(raid.crates.filter((c) => c.type === "gun").length, 0);
  assert.equal(raid.kills, 1);
  db.close();
});

test("ordinary server inputs can recover the guard's registered rifle and extract without early rewards", async () => {
  const db = new DatabaseSync(":memory:");
  const game = new LiveGame(db, new ReadOnlyFixture());
  await game.enter("pilot");
  const raid = newRaid(game.state.world, "DP-0042");
  raid.chainBacked = true;
  raid.crates = raid.crates.filter((c) => c.type !== "gun");
  driveRecovery(game.state.world, raid, "R-042");
  assert.equal(
    game.state.world.inventory.some((g) => g.id === "R-042"),
    false,
  );
  assert.equal(game.state.world.inventory[0].reserved, raid.id);
  assert.equal(raid.loot[0].id, "R-042");
  assert.equal(raid.outcome, "extracted");
  db.close();
});

test("ammunition is awarded only after confirmed payment, once across a worker restart", async () => {
  const db = new DatabaseSync(":memory:");
  class DelayedServicePayment extends ReadOnlyFixture {
    attempts = 0;
    override async prepare(): Promise<Prepared> {
      return {
        bytes: "service-transaction",
        hash: "service-hash",
        reserve: "1000",
      };
    }
    override async submit(): Promise<ChainResult> {
      if (++this.attempts === 1)
        throw Error("Payment confirmation unavailable");
      return { state: "confirmed", value: null, logs: [], burnt: "100" };
    }
  }
  const transport = new DelayedServicePayment(),
    game = new LiveGame(db, transport);
  await game.enter("pilot");
  const command = { type: "ammo", requestId: "service-ammo" };
  await game.perform(command);
  assert.equal(game.state.world.ammo, 160);
  assert.equal(game.state.job?.state, "pending");
  const restarted = new LiveGame(db, transport);
  await restarted.resume();
  assert.equal(restarted.state.world.ammo, 220);
  assert.equal(restarted.state.world.merchants[2].parts, 15);
  await restarted.perform(command);
  assert.equal(restarted.state.world.ammo, 220);
  assert.equal(transport.attempts, 2);
  db.close();
});
