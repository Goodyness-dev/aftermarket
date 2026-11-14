import { DatabaseSync } from "node:sqlite";
import {
  initialWorld,
  newRaid,
  quote,
  stamp,
  MODELS,
  type World,
  type Raid,
  type Gun,
} from "../domain/game.js";
import { finish, receipt } from "./engine.js";
import {
  NearTransport,
  SettlementOutbox,
  SettlementFailure,
  CONTRACT,
  accountId,
  type Role,
} from "./settlement.js";

type Action = {
  type: string;
  requestId: string;
  gunId?: string;
  merchant?: string;
  price?: number;
  listingId?: string;
};
type LiveListing = {
  id: string;
  gunId: string;
  seller: Role;
  price: number;
  commandId?: string;
};
type Job = {
  action: Action;
  expires: string;
  raid?: Raid;
  world?: World;
  assigned?: string[];
  success?: boolean;
  recovered?: string[];
  state: "pending" | "failed";
  error?: string;
};
type LiveState = {
  owner: string | null;
  initialized: boolean;
  world: World;
  raid: Raid | null;
  listings: LiveListing[];
  job: Job | null;
  budgets: Record<string, number>;
  lastAction?: string;
};
const GUNS = ["DP-0042", "R-042"];
const roles: Role[] = ["pilot", "mara", "ivo", "sable", "harbor"];

export class LiveGame {
  state: LiveState;
  readonly transport: NearTransport;
  readonly outbox: SettlementOutbox;
  private running: Promise<void> | null = null;
  private preparing = false;
  constructor(
    private db: DatabaseSync,
    transport = new NearTransport(),
  ) {
    this.transport = transport;
    this.outbox = new SettlementOutbox(db, transport);
    db.exec(
      "CREATE TABLE IF NOT EXISTS live_game(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS live_commands(id TEXT PRIMARY KEY,action TEXT NOT NULL,state TEXT NOT NULL);",
    );
    const row = db
      .prepare("SELECT payload FROM live_game WHERE id=1")
      .get() as any;
    this.state = row
      ? JSON.parse(row.payload)
      : {
          owner: null,
          initialized: false,
          world: initialWorld(),
          raid: null,
          listings: [],
          job: null,
          budgets: {},
        };
  }
  isOwner(id: string) {
    return this.state.owner === id;
  }
  get busy() {
    return this.preparing || !!this.state.job;
  }
  save() {
    this.db
      .prepare(
        "INSERT INTO live_game VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
      )
      .run(JSON.stringify(this.state));
  }
  status() {
    return {
      live: true,
      custody: "Local demo pilot; server holds signing keys",
      contractId: CONTRACT,
      accountId: accountId("pilot"),
      pending: this.busy,
      action: this.state.job?.action.type,
      error: this.state.job?.error,
      state: this.state.job?.state ?? "confirmed",
      budgets: this.state.budgets,
      receipts: this.outbox.receipts(),
    };
  }
  async enter(id: string) {
    if (this.state.owner && this.state.owner !== id)
      throw Error(
        "The testnet pilot is already controlled by another local browser. Use that browser or practice mode.",
      );
    if (this.preparing) throw Error("The testnet pilot is being loaded.");
    this.preparing = true;
    try {
      await this.transport.check();
      if (!this.state.initialized) {
        this.state.world = initialWorld();
        this.state.world.receipts = [];
        this.state.initialized = true;
      }
      if (!this.state.job && (!this.state.raid || this.state.raid.finished))
        await this.refresh();
      this.state.owner = id;
      this.save();
    } finally {
      this.preparing = false;
    }
    if (this.state.job) void this.resume();
  }
  exit(id: string) {
    if (!this.isOwner(id)) return;
    if (this.busy || (this.state.raid && !this.state.raid.finished))
      throw Error(
        "Finish the raid and its settlement before leaving testnet mode.",
      );
    this.state.owner = null;
    this.save();
  }
  async refresh() {
    const tokens = await this.transport.view<
      Array<{
        token_id: string;
        owner_id: string;
        model: Gun["model"];
        condition: number;
      }>
    >("mt_token", { token_ids: GUNS });
    const [balances, reservations, budgets] = await Promise.all([
      Promise.all(
        roles.map((role) =>
          this.transport.view<string>("mt_balance_of", {
            account_id: accountId(role),
            token_id: "credit",
          }),
        ),
      ),
      Promise.all(
        GUNS.map((token_id) =>
          this.transport.view<string | null>("reservation", { token_id }),
        ),
      ),
      Promise.all(
        roles.slice(1).map((role) =>
          this.transport.view<string>("npc_budget", {
            npc_id: accountId(role),
          }),
        ),
      ),
    ]);
    const active: LiveListing[] = [];
    for (const listing of this.state.listings) {
      if (await this.transport.view("get_listing", { listing_id: listing.id }))
        active.push(listing);
    }
    this.state.listings = active;
    const w = this.state.world;
    const old = new Map(
      [
        ...w.inventory,
        ...w.merchants.flatMap((m) => m.stock),
        ...w.faction.stock,
      ].map((g) => [g.id, g]),
    );
    w.inventory = [];
    w.merchants.forEach((m) => (m.stock = []));
    w.faction.stock = [];
    w.cash = Number(balances[0]);
    w.merchants.forEach((m, i) => {
      m.cash = Number(balances[i + 1]);
      this.state.budgets[m.id] = Number(budgets[i]);
    });
    w.faction.cash = Number(balances[4]);
    this.state.budgets.harbor = Number(budgets[3]);
    tokens.forEach((token, i) => {
      if (!token)
        throw Error("A registered demo gun is missing from the contract");
      const prior = old.get(token.token_id);
      const g: Gun = {
        id: token.token_id,
        model: token.model,
        condition: prior?.condition ?? token.condition,
        owner: token.owner_id,
        history: prior?.history ?? [
          stamp("NEAR testnet", "Ownership read from the deployed contract"),
        ],
      };
      if (reservations[i]) g.reserved = reservations[i]!;
      const listing = active.find((l) => l.gunId === g.id);
      if (
        token.owner_id === accountId("pilot") ||
        listing?.seller === "pilot"
      ) {
        g.owner = "player";
        w.inventory.push(g);
      } else if (token.owner_id === accountId("harbor")) {
        g.owner = "faction";
        w.faction.stock.push(g);
      } else {
        const m = w.merchants.find(
          (m) => token.owner_id === accountId(m.id as Role),
        );
        if (m) {
          g.owner = m.id;
          m.stock.push(g);
        }
      }
    });
    w.listings = active
      .filter((l) => l.seller === "pilot")
      .map((l) => ({
        id: l.id,
        gunId: l.gunId,
        price: l.price,
        seller: "player",
        created: Date.now(),
      }));
  }
  async perform(action: Action) {
    const encoded = JSON.stringify(action);
    const previous = this.db
      .prepare("SELECT action,state FROM live_commands WHERE id=?")
      .get(action.requestId) as any;
    if (previous) {
      if (previous.action !== encoded)
        throw Error("Request ID reused for a different action");
      if (previous.state === "confirmed") return;
      if (previous.state === "failed")
        throw Error(
          "This command was rejected and reconciled. Review current state before creating another command.",
        );
      return this.resume();
    }
    if (this.busy)
      throw Error("Wait for the current on-chain settlement to finish.");
    if (
      this.state.raid &&
      !this.state.raid.finished &&
      action.type !== "abandon"
    )
      throw Error("Finish or abandon the active raid first.");
    this.preparing = true;
    try {
      const w = this.state.world;
      const own = w.inventory.find((g) => g.id === action.gunId && !g.reserved);
      const merchant = w.merchants.find((m) => m.id === action.merchant);
      const job: Job = {
        action,
        state: "pending",
        expires: String(
          (await this.transport.height()) +
            (action.type === "deploy" ? 1800 : 20_000),
        ),
      };
      switch (action.type) {
        case "buy": {
          const gun = merchant?.stock.find(
            (g) => g.id === action.gunId && !g.reserved,
          );
          if (
            !gun ||
            !merchant ||
            quote(merchant, gun, "buy").price !== action.price ||
            w.cash < action.price!
          )
            throw Error("Weapon or quote changed; review the market.");
          break;
        }
        case "sell":
          if (
            !own ||
            !merchant ||
            quote(merchant, own, "sell").price !== action.price ||
            merchant.cash < action.price! ||
            (this.state.budgets[merchant.id] ?? 0) < action.price!
          )
            throw Error(
              "Sale exceeds the current quote, cash or delegated NPC budget.",
            );
          break;
        case "list":
          if (
            !own ||
            !Number.isSafeInteger(action.price) ||
            action.price! < 25 ||
            action.price! > 5000
          )
            throw Error(
              "Select an available weapon and a whole-credit price from 25 to 5,000.",
            );
          break;
        case "cancel":
          if (
            !this.state.listings.some(
              (l) => l.id === action.listingId && l.seller === "pilot",
            )
          )
            throw Error("Listing is unavailable.");
          break;
        case "deploy": {
          const world = structuredClone(w),
            raid = newRaid(world, action.gunId!);
          raid.chainBacked = true;
          // Only pre-existing guns assigned to faction guards can become loot.
          raid.crates = raid.crates.filter((c) => c.type !== "gun");
          job.world = world;
          job.raid = raid;
          job.assigned = raid.enemies.flatMap((e) =>
            e.gunId ? [e.gunId] : [],
          );
          break;
        }
        case "abandon":
          if (!this.state.raid || this.state.raid.finished)
            throw Error("No active raid.");
          job.success = false;
          job.recovered = [];
          job.raid = structuredClone(this.state.raid);
          break;
        case "shift":
          break;
        case "ammo":
          if (w.cash < 90 || w.merchants[2].parts < 1)
            throw Error("Ammunition unavailable or insufficient credits.");
          break;
        case "repair": {
          if (!own) throw Error("Weapon unavailable.");
          const cost = Math.ceil((100 - own.condition) * 1.7),
            parts = Math.ceil((100 - own.condition) / 12);
          if (
            !parts ||
            w.cash < cost ||
            w.parts < parts ||
            w.merchants[1].parts < 2
          )
            throw Error(
              "Repair supplies or credits unavailable, or weapon already repaired.",
            );
          (job as any).repair = { cost, parts };
          break;
        }
        default:
          throw Error(
            "This operation is available in practice mode. The testnet bridge currently settles weapon trades and raid ownership; supplies and wear are server-simulated.",
          );
      }
      this.state.job = job;
      this.db.exec("BEGIN");
      try {
        this.db
          .prepare("INSERT INTO live_commands VALUES(?,?,'pending')")
          .run(action.requestId, encoded);
        this.save();
        this.db.exec("COMMIT");
      } catch (e) {
        this.db.exec("ROLLBACK");
        this.state.job = null;
        throw e;
      }
    } finally {
      this.preparing = false;
    }
    await this.resume();
  }
  async raidFinished() {
    if (this.state.job || !this.state.raid?.finished) return;
    const raid = this.state.raid;
    const action: Action = {
      type: "settle",
      requestId: `raid-result:${raid.id}`,
    };
    if (
      this.db
        .prepare("SELECT id FROM live_commands WHERE id=?")
        .get(action.requestId)
    )
      return;
    this.state.job = {
      action,
      state: "pending",
      expires: "0",
      raid: structuredClone(raid),
      success: raid.outcome === "extracted",
      recovered: raid.outcome === "extracted" ? raid.loot.map((g) => g.id) : [],
    };
    this.db.exec("BEGIN");
    try {
      this.db
        .prepare("INSERT INTO live_commands VALUES(?,?,'pending')")
        .run(action.requestId, JSON.stringify(action));
      this.save();
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    await this.resume();
  }
  async resume() {
    if (this.running) return this.running;
    if (!this.state.job || this.state.job.state === "failed") return;
    this.running = this.process()
      .catch((e) => {
        if (this.state.job) {
          this.state.job.error = (e as Error).message.slice(0, 350);
          if (e instanceof SettlementFailure) this.state.job.state = "failed";
          this.save();
        }
      })
      .finally(() => {
        this.running = null;
      });
    return this.running;
  }
  async reconcile(id: string) {
    if (!this.isOwner(id))
      throw Error("Only the active local pilot can reconcile its command.");
    if (this.running || this.preparing)
      throw Error("Wait for the current settlement check.");
    const job = this.state.job;
    if (!job) return;
    if (job.state !== "failed") {
      await this.resume();
      return;
    }
    if (["settle", "abandon"].includes(job.action.type))
      throw Error(
        "Raid rejection needs operator review; its reservation has not been discarded.",
      );
    this.preparing = true;
    try {
      await this.outbox.resumePending(`${job.action.requestId}:`);
      let recoveryNote =
        "Open listings from this command were released. Confirmed payments were preserved; no reward was issued.";
      if (job.action.type === "deploy") {
        if (!job.raid || this.state.raid?.id === job.raid.id)
          throw Error("Cannot cancel a deployment that entered combat.");
        const raid = await this.transport.view<{
          player: string;
          weapon: string;
          expires_at: string;
          settled: boolean;
        } | null>("get_raid", { raid_id: job.raid.id });
        if (raid) {
          if (
            raid.player !== accountId("pilot") ||
            raid.weapon !== job.action.gunId
          )
            throw Error("Raid custody differs from the failed deployment.");
          if (!raid.settled) {
            const expired =
              (await this.transport.height()) > Number(raid.expires_at);
            await this.outbox.run(
              `${job.action.requestId}:release-raid`,
              expired
                ? {
                    role: "pilot",
                    method: "expire_raid",
                    args: { raid_id: job.raid.id },
                  }
                : {
                    role: "operator",
                    method: "settle_raid",
                    args: {
                      raid_id: job.raid.id,
                      success: true,
                      recovered: [],
                    },
                  },
            );
          }
          const closed = await this.transport.view<{ settled: boolean }>(
            "get_raid",
            { raid_id: job.raid.id },
          );
          if (!closed?.settled)
            throw Error("Deployment cancellation is not confirmed yet.");
          const owned = await this.transport.view<string>("mt_balance_of", {
            account_id: accountId("pilot"),
            token_id: job.action.gunId,
          });
          recoveryNote =
            owned === "1"
              ? "Deployment cancelled before combat. Carried gear released and assigned NPC loot returned; no raid rewards issued."
              : "Expired deployment reconciled under contract expiry rules. Carried gear was lost; NPC loot returned. No raid rewards issued.";
        } else
          recoveryNote =
            "Deployment was rejected before a raid reservation existed. No gear or rewards were issued.";
      }
      const opened = this.state.listings.filter(
        (l) =>
          l.commandId === job.action.requestId ||
          (!l.commandId &&
            ["buy", "sell", "list"].includes(job.action.type) &&
            l.gunId === job.action.gunId),
      );
      for (const listing of opened) {
        const actual = await this.transport.view<{ seller: string } | null>(
          "get_listing",
          { listing_id: listing.id },
        );
        if (!actual) continue;
        if (actual.seller !== accountId(listing.seller))
          throw Error("Listing custody changed; operator review required.");
        await this.outbox.run(`${job.action.requestId}:release:${listing.id}`, {
          role: listing.seller,
          method: "cancel_listing",
          args: { listing_id: listing.id },
        });
      }
      await this.refresh();
      receipt(this.state.world, "Rejected command reconciled", recoveryNote);
      this.db.exec("BEGIN");
      try {
        this.db
          .prepare("UPDATE live_commands SET state='failed' WHERE id=?")
          .run(job.action.requestId);
        this.state.job = null;
        this.save();
        this.db.exec("COMMIT");
      } catch (e) {
        this.db.exec("ROLLBACK");
        this.state.job = job;
        throw e;
      }
    } finally {
      this.preparing = false;
    }
  }
  private async process() {
    const job = this.state.job!;
    const a = job.action;
    await this.outbox.resumePending(`${a.requestId}:`);
    const send = (
      step: string,
      role: Role,
      method: string,
      args: Record<string, unknown>,
    ) => this.outbox.run(`${a.requestId}:${step}`, { role, method, args });
    const open = async (
      step: string,
      role: Role,
      gunId: string,
      price: number,
    ) => {
      const id = String(
        await send(step, role, "list_weapon", {
          token_id: gunId,
          price: String(price),
          expires_at: job.expires,
        }),
      );
      if (!this.state.listings.some((l) => l.id === id)) {
        this.state.listings.push({
          id,
          gunId,
          price,
          seller: role,
          commandId: a.requestId,
        });
        this.save();
      }
      return id;
    };
    if (a.type === "buy" || a.type === "sell" || a.type === "list") {
      const seller = a.type === "buy" ? (a.merchant as Role) : "pilot";
      const listingId = await open("listing", seller, a.gunId!, a.price!);
      if (a.type === "buy")
        await send("payment", "pilot", "fill_listing", {
          listing_id: listingId,
          max_price: String(a.price),
        });
      if (a.type === "sell")
        await send("payment", "operator", "fill_listing_for_npc", {
          listing_id: listingId,
          npc_id: accountId(a.merchant as Role),
          max_price: String(a.price),
        });
    } else if (a.type === "cancel") {
      await send("cancel", "pilot", "cancel_listing", {
        listing_id: a.listingId,
      });
    } else if (a.type === "ammo" || a.type === "repair") {
      const cost = a.type === "ammo" ? 90 : (job as any).repair.cost;
      await this.outbox.run(`${a.requestId}:service-payment`, {
        role: "pilot",
        method: "mt_transfer",
        deposit: "1",
        args: {
          receiver_id: accountId(a.type === "ammo" ? "sable" : "ivo"),
          token_id: "credit",
          amount: String(cost),
          approval: null,
          memo:
            a.type === "ammo"
              ? "Server-simulated ammunition supply"
              : "Server-simulated workshop service",
        },
      });
    } else if (a.type === "shift") {
      // Freeze the procurement plan before its first transaction. A replay must
      // not select different NPCs after a previous payment changed their cash.
      let plan = (
        job as Job & {
          shiftPlan?: Array<{
            id: string;
            role: Role;
            price: number;
            gunId: string;
          }>;
        }
      ).shiftPlan;
      if (!plan) {
        plan = [];
        const cash = Object.fromEntries(
          this.state.world.merchants.map((m) => [
            m.id,
            Math.min(m.cash, this.state.budgets[m.id] ?? 0),
          ]),
        );
        for (const listing of this.state.listings.filter(
          (l) => l.seller === "pilot",
        )) {
          const gun = this.state.world.inventory.find(
            (g) => g.id === listing.gunId,
          );
          const merchant =
            gun &&
            this.state.world.merchants.find(
              (m) =>
                cash[m.id] >= listing.price &&
                quote(m, gun, "sell").price >= listing.price,
            );
          if (merchant) {
            plan.push({
              id: listing.id,
              role: merchant.id as Role,
              price: listing.price,
              gunId: listing.gunId,
            });
            cash[merchant.id] -= listing.price;
          }
        }
        (job as any).shiftPlan = plan;
        this.save();
      }
      for (const listing of plan)
        await send(`fill:${listing.id}`, "operator", "fill_listing_for_npc", {
          listing_id: listing.id,
          npc_id: accountId(listing.role),
          max_price: String(listing.price),
        });
      // NPC rifles are bought into Harbor's funded inventory, never minted.
      const offered = this.state.world.merchants.flatMap((m) =>
        m.stock
          .filter((g) => g.model === "rifle" && !g.reserved)
          .map((g) => ({ g, role: m.id as Role })),
      );
      for (const { g, role } of offered.slice(0, 1)) {
        const price = Math.round(MODELS.rifle.base * (0.5 + g.condition / 200));
        if (
          this.state.world.faction.cash >= price &&
          (this.state.budgets.harbor ?? 0) >= price
        ) {
          const id = await open(`procure-list:${g.id}`, role, g.id, price);
          await send(
            `procure-pay:${g.id}`,
            "operator",
            "fill_listing_for_npc",
            {
              listing_id: id,
              npc_id: accountId("harbor"),
              max_price: String(price),
            },
          );
        }
      }
    } else if (a.type === "deploy") {
      await send("reserve", "pilot", "begin_raid", {
        raid_id: job.raid!.id,
        token_id: a.gunId,
        expires_at: job.expires,
      });
      for (const token_id of job.assigned ?? [])
        await send(`guard:${token_id}`, "operator", "assign_raid_loot", {
          raid_id: job.raid!.id,
          token_id,
          from: accountId("harbor"),
        });
    } else if (a.type === "settle" || a.type === "abandon") {
      const onChain = await this.transport.view<{
        expires_at: string;
        settled: boolean;
      }>("get_raid", { raid_id: job.raid!.id });
      if (!onChain.settled) {
        if ((await this.transport.height()) > Number(onChain.expires_at)) {
          job.success = false;
          job.recovered = [];
          this.save();
          await send("expire", "pilot", "expire_raid", {
            raid_id: job.raid!.id,
          });
        } else
          await send("settle", "operator", "settle_raid", {
            raid_id: job.raid!.id,
            success: !!job.success,
            recovered: job.recovered ?? [],
          });
      }
      const balance = await this.transport.view<string>("mt_balance_of", {
        account_id: accountId("pilot"),
        token_id: job.raid!.gunId,
      });
      job.success = balance === "1";
      this.save();
    }
    // Chain succeeded. Apply the local projection and command completion in one
    // SQLite transaction. A crash beforehand reuses all persisted transaction IDs.
    const before = structuredClone(this.state);
    try {
      if (a.type === "deploy") {
        this.state.world = job.world!;
        this.state.raid = job.raid!;
        this.state.raid.started = Date.now();
        this.state.raid.lastInput = Date.now();
      } else if (a.type === "settle" || a.type === "abandon") {
        const r = structuredClone(job.raid!);
        r.finished = false;
        finish(this.state.world, r, !!job.success);
        this.state.raid = r;
      }
      if (a.type === "ammo") {
        this.state.world.ammo += 60;
        this.state.world.merchants[2].parts--;
      }
      if (a.type === "repair") {
        this.state.world.parts -= (job as any).repair.parts;
        this.state.world.merchants[1].parts -= 2;
        const gun = this.state.world.inventory.find((g) => g.id === a.gunId)!;
        gun.condition = 100;
        gun.history.push(
          stamp(
            "Ivo Okoro",
            "Workshop payment confirmed on NEAR; simulated condition restored",
          ),
        );
      }
      if (a.type !== "deploy") await this.refresh();
      if (a.type === "shift") {
        this.state.world.day++;
        this.state.world.merchants.forEach(
          (m) => (m.demand = Math.min(8, m.demand + 1)),
        );
      }
      receipt(
        this.state.world,
        "NEAR testnet confirmed",
        `${a.type.toUpperCase()} · ${a.gunId ?? job.raid?.id ?? "market"} · ownership and credits read from final chain state`,
      );
      this.state.lastAction = a.type;
      this.state.job = null;
      this.db.exec("BEGIN");
      try {
        this.save();
        this.db
          .prepare("UPDATE live_commands SET state='confirmed' WHERE id=?")
          .run(a.requestId);
        this.db.exec("COMMIT");
      } catch (e) {
        this.db.exec("ROLLBACK");
        throw e;
      }
    } catch (e) {
      this.state = before;
      throw e;
    }
  }
}
