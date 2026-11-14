import { DatabaseSync } from "node:sqlite";
import { mkdir, writeFile } from "node:fs/promises";
import { LiveGame } from "../src/server/live-game.js";
import { accountId, CONTRACT } from "../src/server/settlement.js";
import { driveRecovery } from "../tests/raid-driver.js";

// Explicitly invoked, bounded testnet integration run. It uses the actual
// authoritative engine with scripted inputs, not browser footage or real players.
await mkdir("data", { recursive: true });
const db = new DatabaseSync("data/live-verification.db");
db.exec(
  "CREATE TABLE IF NOT EXISTS verification_progress(id INTEGER PRIMARY KEY CHECK(id=1),stage INTEGER); INSERT OR IGNORE INTO verification_progress VALUES(1,0)",
);
const game = new LiveGame(db);
await game.enter("scripted-testnet-verification");
await game.resume();
if (game.state.job)
  throw Error(
    `Existing settlement needs reconciliation: ${game.state.job.error}`,
  );
let stage = Number(
  (
    db
      .prepare("SELECT stage FROM verification_progress WHERE id=1")
      .get() as any
  ).stage,
);
async function step(
  number: number,
  label: string,
  operation: () => Promise<void>,
) {
  if (stage >= number) return;
  await operation();
  if (game.state.job)
    throw Error(
      `Settlement pending: ${game.state.job.error ?? game.state.job.action.type}`,
    );
  db.prepare("UPDATE verification_progress SET stage=? WHERE id=1").run(number);
  stage = number;
  console.log(`${number}/8 ${label}`);
}
await step(
  1,
  "Reserve pilot pistol and deploy Harbor's existing R-042 to its guard",
  () =>
    game.perform({
      type: "deploy",
      gunId: "DP-0042",
      requestId: "verified-loop:initial-deploy",
    }),
);
await step(
  2,
  "Scripted movement/combat extracts R-042; operator settles the actual engine outcome",
  async () => {
    driveRecovery(game.state.world, game.state.raid!, "R-042");
    await game.raidFinished();
    if (
      !game.state.world.inventory.some((g) => g.id === "R-042" && !g.reserved)
    )
      throw Error("First recovery was not confirmed");
  },
);
await step(3, "Escrow the recovered rifle in a 500-credit player listing", () =>
  game.perform({
    type: "list",
    gunId: "R-042",
    price: 500,
    requestId: "verified-loop:player-listing",
  }),
);
await step(
  4,
  "Mara spends her own delegated budget to buy the player's rifle",
  () =>
    game.perform({ type: "shift", requestId: "verified-loop:npc-purchase" }),
);
await step(
  5,
  "Harbor buys that exact rifle from Mara for the next patrol",
  () =>
    game.perform({
      type: "shift",
      requestId: "verified-loop:harbor-procurement",
    }),
);
await step(6, "Reserve the same pistol and assign R-042 to a guard again", () =>
  game.perform({
    type: "deploy",
    gunId: "DP-0042",
    requestId: "verified-loop:returning-deploy",
  }),
);
await step(
  7,
  "Recover the returning rifle and confirm its second extraction",
  async () => {
    driveRecovery(game.state.world, game.state.raid!, "R-042");
    await game.raidFinished();
  },
);
await step(
  8,
  "Verify ownership, conserved credits and unique supply",
  async () => {
    const token = await game.transport.view<any[]>("mt_token", {
      token_ids: ["R-042"],
    });
    const supply = await game.transport.view<string>("mt_supply", {
      token_id: "R-042",
    });
    const credits = await game.transport.view<string>("mt_supply", {
      token_id: "credit",
    });
    if (
      token[0]?.owner_id !== accountId("pilot") ||
      supply !== "1" ||
      credits !== "8420"
    )
      throw Error("Final on-chain conservation check failed");
  },
);
const transactions = db
  .prepare("SELECT id,hash,state,result FROM chain_transactions ORDER BY rowid")
  .all()
  .map((row: any) => ({
    id: row.id,
    hash: row.hash,
    state: row.state,
    result: JSON.parse(row.result),
  }));
const report = {
  status: "verified",
  network: "testnet",
  contractId: CONTRACT,
  kind: "scripted-server-engine integration; not human play footage",
  verifiedAt: new Date().toISOString(),
  tokenId: "R-042",
  initialOwner: accountId("harbor"),
  finalOwner: accountId("pilot"),
  path: [
    "Harbor guard",
    "pilot extraction",
    "player listing escrow",
    "Mara NPC purchase",
    "Harbor procurement",
    "Harbor guard",
    "pilot extraction",
  ],
  uniqueSupply: "1",
  totalCreditSupply: "8420",
  pilotCredits: game.state.world.cash,
  npcBudgets: game.state.budgets,
  transactions,
  gasBudgetUsedYocto: (
    db.prepare("SELECT reserved FROM chain_budget WHERE id=1").get() as any
  ).reserved,
};
await writeFile(
  "docs/TESTNET_LOOP_VERIFIED.json",
  JSON.stringify(report, null, 2) + "\n",
);
game.exit("scripted-testnet-verification");
db.close();
console.log(
  `Full returning-rifle loop verified with ${transactions.length} confirmed transactions. No assets or credits minted.`,
);
