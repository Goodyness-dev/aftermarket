import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { Account, JsonRpcProvider, baseEncode, nearToYocto } from "near-api-js";

// Read-only verification. No credentials are loaded and no transactions signed.
const root = resolve(import.meta.dirname, "..");
const plan = JSON.parse(
  await readFile(join(root, "docs/TESTNET_DEPLOYMENT.json"), "utf8"),
);
if (
  plan.network !== "testnet" ||
  plan.rpcUrl !== "https://rpc.testnet.near.org"
)
  throw Error("Testnet only");
const rpcUrl = "https://test.rpc.fastnear.com";
const provider = new JsonRpcProvider({ url: rpcUrl });
if ((await provider.viewNodeStatus()).chain_id !== "testnet")
  throw Error("RPC is not testnet");
const view = (methodName, args) =>
  provider.callFunction({
    contractId: plan.contractId,
    method: methodName,
    args,
    blockQuery: { finality: "final" },
  });
const expectedHash = baseEncode(Buffer.from(plan.wasmSha256, "hex"));
const accounts = {};
for (const a of plan.accounts) {
  const client = new Account(a.accountId, provider);
  const state = await client.getState();
  const key = await client.getAccessKey(a.publicKey);
  if (key.permission !== "FullAccess")
    throw Error(`Unexpected access permission: ${a.role}`);
  if (a.role === "owner" && state.codeHash !== expectedHash)
    throw Error("Deployed code hash differs from approved WASM");
  accounts[a.role] = {
    accountId: a.accountId,
    availableYocto: state.balance.available.toString(),
    storageBytes: state.storageUsage,
    codeHash: state.codeHash,
  };
}
const byRole = Object.fromEntries(
  plan.accounts.map((a) => [a.role, a.accountId]),
);
const balances = {},
  budgets = {};
const initialSeed = process.argv.includes("--initial-seed");
for (const [role, expected] of Object.entries({
  pilot: "920",
  mara: "2400",
  ivo: "1600",
  sable: "1300",
  harbor: "2200",
})) {
  const balance = await view("mt_balance_of", {
    account_id: byRole[role],
    token_id: "credit",
  });
  if (initialSeed && balance !== expected)
    throw Error(`Initial credit balance mismatch: ${role}`);
  balances[role] = balance;
  if (role !== "pilot") {
    const cap = await view("npc_budget", { npc_id: byRole[role] });
    if (initialSeed && cap !== expected)
      throw Error(`Initial NPC spending cap mismatch: ${role}`);
    budgets[role] = cap;
  }
}
const tokens = await view("mt_token", { token_ids: ["DP-0042", "R-042"] });
const supply = await view("mt_batch_supply", {
  token_ids: ["credit", "DP-0042", "R-042", "ammo", "parts"],
});
const pilotStacks = await view("mt_batch_balance_of", {
  account_id: byRole.pilot,
  token_ids: ["DP-0042", "ammo", "parts"],
});
if (
  initialSeed &&
  (tokens[0]?.owner_id !== byRole.pilot ||
    tokens[1]?.owner_id !== byRole.harbor)
)
  throw Error("Weapon owner mismatch");
if (JSON.stringify(supply) !== JSON.stringify(["8420", "1", "1", "160", "8"]))
  throw Error("Supply mismatch");
if (
  initialSeed &&
  JSON.stringify(pilotStacks) !== JSON.stringify(["1", "160", "8"])
)
  throw Error("Pilot inventory mismatch");
if (
  Object.values(balances).reduce((sum, value) => sum + BigInt(value), 0n) !==
  8420n
)
  throw Error("Credit conservation failed");
for (const token of tokens) {
  if (
    !token?.owner_id ||
    !plan.accounts.some((a) => a.accountId === token.owner_id)
  )
    throw Error("Unexpected registered gun owner");
  if (
    (await view("mt_balance_of", {
      account_id: token.owner_id,
      token_id: token.token_id,
    })) !== "1"
  )
    throw Error("Unique owner balance mismatch");
}
const rootAllocatedYocto =
  nearToYocto("10") - BigInt(accounts.owner.availableYocto);
if (rootAllocatedYocto > nearToYocto("8"))
  throw Error("Approved budget exceeded");
const report = {
  rpcUrl,
  verificationScope: initialSeed
    ? "initial seed"
    : "current ownership and conserved supply after gameplay",
  status: "verified",
  network: "testnet",
  contractId: plan.contractId,
  verifiedAt: new Date().toISOString(),
  codeHash: expectedHash,
  wasmSha256: plan.wasmSha256,
  rootAllocatedYocto: rootAllocatedYocto.toString(),
  accounts,
  balances,
  budgets,
  tokens,
  supply,
  pilotStacks,
};
await writeFile(
  join(root, "docs/TESTNET_VERIFIED.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  `Verified ${plan.contractId}: deployed code, 7 access keys, 5 credit balances, 4 NPC caps, 2 unique owners and pilot supplies.`,
);
console.log(
  `Owner allocation including storage, child funding and fees: ${Number(rootAllocatedYocto) / 1e24} testnet NEAR (cap 8).`,
);
