import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve, join } from "node:path";
import {
  Account,
  JsonRpcProvider,
  KeyPair,
  KeyPairSigner,
  actions,
  nearToYocto,
} from "near-api-js";

// The human approved docs/TESTNET_DEPLOYMENT.json in this chat. No mainnet mode.
const root = resolve(import.meta.dirname, "..");
const plan = JSON.parse(
  await readFile(join(root, "docs/TESTNET_DEPLOYMENT.json"), "utf8"),
);
if (
  plan.network !== "testnet" ||
  plan.contractId !== "aftermarket-f33ee39d.testnet" ||
  plan.rpcUrl !== "https://rpc.testnet.near.org"
)
  throw Error("Not the approved testnet plan");
const wasm = await readFile(join(root, plan.wasmPath));
if (
  createHash("sha256").update(wasm).digest("hex") !==
  "88c49c667165b2718999f9820af52c506d6af24c9a3a16f02379f9233557136f"
)
  throw Error("WASM differs from the approved binary");
// The original endpoint deprecated itself with HTTP 429 during execution.
// This replacement is the public testnet endpoint listed in NEAR's RPC docs.
const rpcUrl = "https://test.rpc.fastnear.com";
const provider = new JsonRpcProvider({ url: rpcUrl });
if ((await provider.viewNodeStatus()).chain_id !== "testnet")
  throw Error("RPC is not testnet");
const byRole = Object.fromEntries(plan.accounts.map((a) => [a.role, a]));
const clients = {};
for (const a of plan.accounts) {
  const credential = JSON.parse(
    await readFile(
      join(
        homedir(),
        ".near-credentials/testnet",
        plan.contractId,
        `${a.role}.json`,
      ),
      "utf8",
    ),
  );
  const key = KeyPair.fromString(credential.private_key);
  if (
    credential.account_id !== a.accountId ||
    key.getPublicKey().toString() !== a.publicKey
  )
    throw Error("Credential mismatch");
  clients[a.role] = new Account(a.accountId, provider, new KeyPairSigner(key));
}
const dir = join(root, "data/deployment");
await mkdir(dir, { recursive: true });
const journalPath = join(dir, "transactions.json");
let journal;
try {
  journal = JSON.parse(await readFile(journalPath, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  journal = { contractId: plan.contractId, reservedYocto: "0", steps: [] };
}
if (journal.contractId !== plan.contractId)
  throw Error("Journal belongs to another deployment");
if (journal.steps.some((s) => s.state !== "confirmed"))
  throw Error(
    "An earlier transaction needs reconciliation; do not blindly replay it.",
  );
const save = () =>
  writeFile(journalPath, JSON.stringify(journal, null, 2) + "\n");
const view = (methodName, args) =>
  provider.callFunction({
    contractId: plan.contractId,
    method: methodName,
    args,
    blockQuery: { finality: "final" },
  });
const budget = nearToYocto("8");
const storageByteCost = 10n ** 19n;
async function transact(
  id,
  role,
  receiverId,
  txActions,
  { deposit = 0n, storageBytes = 4096, gas = 60_000_000_000_000n } = {},
) {
  if (journal.steps.some((s) => s.id === id)) return;
  // Conservative reservation includes all deposits, maximum gas at twice current
  // price, and estimated new storage. It intentionally double-counts some costs.
  const gasResponse = await provider.sendJsonRpc("gas_price", [null]);
  journal.rpcUrl = rpcUrl;
  const reserve =
    deposit +
    BigInt(storageBytes) * storageByteCost +
    gas * BigInt(gasResponse.gas_price) * 2n;
  if (BigInt(journal.reservedYocto) + reserve > budget)
    throw Error("Approved 8 testnet NEAR budget would be exceeded");
  const entry = {
    id,
    role,
    receiverId,
    state: "pending",
    reservedYocto: reserve.toString(),
    startedAt: new Date().toISOString(),
  };
  journal.steps.push(entry);
  journal.reservedYocto = (BigInt(journal.reservedYocto) + reserve).toString();
  await save();
  const outcome = await clients[role].signAndSendTransaction({
    receiverId,
    actions: txActions,
    waitUntil: "FINAL",
    throwOnFailure: true,
    retries: 0,
  });
  if (
    !outcome.status ||
    typeof outcome.status !== "object" ||
    !("SuccessValue" in outcome.status)
  )
    throw Error(`Non-final result for ${id}; reconcile before resuming`);
  entry.state = "confirmed";
  entry.hash = outcome.transaction.hash;
  entry.finishedAt = new Date().toISOString();
  entry.burntYocto = [
    outcome.transaction_outcome,
    ...(outcome.receipts_outcome ?? []),
  ]
    .reduce((n, r) => n + BigInt(r.outcome.tokens_burnt), 0n)
    .toString();
  entry.logs = (outcome.receipts_outcome ?? []).flatMap((r) => r.outcome.logs);
  await save();
  console.log(`${id}: ${entry.hash}`);
}
const gas = 60_000_000_000_000n;
const call = (id, role, method, args, deposit = 0n) =>
  transact(
    id,
    role,
    plan.contractId,
    [actions.functionCall(method, args, gas, deposit)],
    { deposit },
  );

// The faucet was called once separately; inspect its recorded successful result.
const faucet = JSON.parse(
  await readFile(join(dir, "faucet-response.json"), "utf8"),
);
if (
  faucet.transaction?.receiver_id !== plan.contractId ||
  !("SuccessValue" in faucet.status)
)
  throw Error("No successful approved faucet creation recorded");
for (const a of plan.accounts) {
  if (
    a.role !== "owner" &&
    !journal.steps.some((s) => s.id === `account:${a.role}`)
  )
    continue;
  const key = await clients[a.role].getAccessKey(a.publicKey);
  if (key.permission !== "FullAccess")
    throw Error("Unexpected account access permission");
}
const rootState = await clients.owner.getState();
if (
  !journal.steps.some((s) => s.id === "deploy") &&
  rootState.codeHash !== "11111111111111111111111111111111"
)
  throw Error("Unexpected existing contract");
if (!journal.steps.length && rootState.balance.available < nearToYocto("8"))
  throw Error("Insufficient free testnet funding");

for (const a of plan.accounts.filter((a) => a.role !== "owner")) {
  await transact(
    `account:${a.role}`,
    "owner",
    a.accountId,
    [
      actions.createAccount(),
      actions.transfer(nearToYocto("0.15")),
      actions.addFullAccessKey(
        await clients[a.role].getSigner().getPublicKey(),
      ),
    ],
    { deposit: nearToYocto("0.15") },
  );
}
await transact(
  "deploy",
  "owner",
  plan.contractId,
  [
    actions.deployContract(wasm),
    actions.functionCall(
      "new",
      { owner_id: plan.ownerId, operator_id: plan.operatorId },
      gas,
      0n,
    ),
  ],
  { storageBytes: wasm.length + 10_000 },
);
for (const a of plan.accounts)
  await call(
    `storage:${a.role}`,
    "owner",
    "fund_storage",
    { account_id: a.accountId },
    nearToYocto("0.05"),
  );
for (const [role, amount] of Object.entries({
  pilot: "920",
  mara: "2400",
  ivo: "1600",
  sable: "1300",
  harbor: "2200",
})) {
  await call(`credit:${role}`, "operator", "mint", {
    receiver_id: byRole[role].accountId,
    token_id: "credit",
    amount,
    model: null,
    condition: null,
  });
}
for (const [token_id, role, model] of [
  ["DP-0042", "pilot", "pistol"],
  ["R-042", "harbor", "rifle"],
])
  await call(`gun:${token_id}`, "operator", "mint", {
    receiver_id: byRole[role].accountId,
    token_id,
    amount: "1",
    model,
    condition: 100,
  });
for (const [token_id, amount] of [
  ["ammo", "160"],
  ["parts", "8"],
])
  await call(`stack:${token_id}`, "operator", "mint", {
    receiver_id: byRole.pilot.accountId,
    token_id,
    amount,
    model: null,
    condition: null,
  });
for (const [role, amount] of Object.entries({
  mara: "2400",
  ivo: "1600",
  sable: "1300",
  harbor: "2200",
}))
  await call(`budget:${role}`, "owner", "set_npc_budget", {
    npc_id: byRole[role].accountId,
    amount,
  });

const verified = {
  contractId: plan.contractId,
  wasmSha256: plan.wasmSha256,
  faucetHash: faucet.transaction.hash,
  verifiedAt: new Date().toISOString(),
  balances: {},
  budgets: {},
  tokens: await view("mt_token", { token_ids: ["DP-0042", "R-042"] }),
  supply: await view("mt_batch_supply", {
    token_ids: ["credit", "DP-0042", "R-042", "ammo", "parts"],
  }),
};
for (const [role, expected] of Object.entries({
  pilot: "920",
  mara: "2400",
  ivo: "1600",
  sable: "1300",
  harbor: "2200",
})) {
  const balance = await view("mt_balance_of", {
    account_id: byRole[role].accountId,
    token_id: "credit",
  });
  if (balance !== expected) throw Error(`Balance verification failed: ${role}`);
  verified.balances[role] = balance;
  if (role !== "pilot") {
    const cap = await view("npc_budget", { npc_id: byRole[role].accountId });
    if (cap !== expected) throw Error(`Budget mismatch: ${role}`);
    verified.budgets[role] = cap;
  }
}
if (
  verified.tokens[0]?.owner_id !== byRole.pilot.accountId ||
  verified.tokens[1]?.owner_id !== byRole.harbor.accountId ||
  JSON.stringify(verified.supply) !==
    JSON.stringify(["8420", "1", "1", "160", "8"])
)
  throw Error("Ownership or supply mismatch");
verified.transactions = journal.steps;
verified.conservativeReservedYocto = journal.reservedYocto;
await writeFile(
  join(root, "docs/TESTNET_DEPLOYED.json"),
  JSON.stringify(verified, null, 2) + "\n",
);
console.log(
  "Verified testnet deployment; public receipts saved to docs/TESTNET_DEPLOYED.json",
);
