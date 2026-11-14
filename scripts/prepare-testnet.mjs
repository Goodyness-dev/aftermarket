import { randomBytes, createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve, join } from "node:path";
import { KeyPair, KeyPairEd25519 } from "near-api-js";

// Offline only. This script never contacts a faucet, RPC, wallet, or blockchain.
const root = resolve(import.meta.dirname, "..");
const planPath = join(root, "docs", "TESTNET_DEPLOYMENT.json");
try {
  const existing = JSON.parse(await readFile(planPath, "utf8"));
  if (
    existing.network !== "testnet" ||
    !/^aftermarket-[a-f0-9]{8}\.testnet$/.test(existing.contractId)
  )
    throw Error("Unexpected deployment network/account.");
  const pinnedWasm = await readFile(
    join(
      root,
      "contracts/economy/target/wasm32-unknown-unknown/release/aftermarket_economy.wasm",
    ),
  );
  if (
    createHash("sha256").update(pinnedWasm).digest("hex") !==
    existing.wasmSha256
  )
    throw Error(
      "WASM changed. Review the new binary before replacing the public plan.",
    );
  for (const entry of existing.accounts) {
    if (
      ![
        "owner",
        "operator",
        "mara",
        "ivo",
        "sable",
        "harbor",
        "pilot",
      ].includes(entry.role)
    )
      throw Error("Unexpected account role.");
    const credential = JSON.parse(
      await readFile(
        join(
          homedir(),
          ".near-credentials",
          "testnet",
          existing.contractId,
          `${entry.role}.json`,
        ),
        "utf8",
      ),
    );
    const key = KeyPair.fromString(credential.private_key);
    if (
      credential.account_id !== entry.accountId ||
      key.getPublicKey().toString() !== entry.publicKey
    )
      throw Error("Prepared credential does not match the public plan.");
  }
  console.log(
    `Verified ${existing.contractId}: pinned WASM and all ${existing.accounts.length} prepared keys match. No network requests or signatures made.`,
  );
  process.exit(0);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const wasmPath =
  "contracts/economy/target/wasm32-unknown-unknown/release/aftermarket_economy.wasm";
const wasm = await readFile(join(root, wasmPath));
const contractId = `aftermarket-${randomBytes(4).toString("hex")}.testnet`;
const credentialsDir = join(
  homedir(),
  ".near-credentials",
  "testnet",
  contractId,
);
await mkdir(credentialsDir, { recursive: true, mode: 0o700 });
const accounts = [];
for (const role of [
  "owner",
  "operator",
  "mara",
  "ivo",
  "sable",
  "harbor",
  "pilot",
]) {
  const accountId = role === "owner" ? contractId : `${role}.${contractId}`;
  const key = KeyPairEd25519.fromRandom();
  const publicKey = key.getPublicKey().toString();
  await writeFile(
    join(credentialsDir, `${role}.json`),
    JSON.stringify(
      {
        account_id: accountId,
        public_key: publicKey,
        private_key: key.toString(),
      },
      null,
      2,
    ),
    { flag: "wx", mode: 0o600 },
  );
  accounts.push({ role, accountId, publicKey });
}
const plan = {
  version: 1,
  network: "testnet",
  status: "prepared-offline-awaiting-human-approval",
  contractId,
  ownerId: contractId,
  operatorId: `operator.${contractId}`,
  rpcUrl: "https://rpc.testnet.near.org",
  faucetUrl: "https://helper.testnet.near.org/account",
  wasmPath,
  wasmBytes: wasm.length,
  wasmSha256: createHash("sha256").update(wasm).digest("hex"),
  nativeBudget: {
    maximumTestNear: "8",
    childAccountFundingEach: "0.15",
    storageCreditEach: "0.05",
    realMoneyOrMainnet: false,
  },
  accounts,
  steps: [
    "Request free testnet faucet creation of the owner account with its public key. Stop if funding is insufficient; never buy or bridge funds.",
    "Create six child accounts using their prepared public keys, funding each with 0.15 testnet NEAR.",
    "Deploy exactly the SHA-256-pinned WASM and initialize owner_id and operator_id atomically in one transaction.",
    "Prepay 0.05 testnet NEAR storage credit for each of the seven accounts.",
    "Issue demo credits: pilot 920, Mara 2400, Ivo 1600, Sable 1300, Harbor 2200. These are game credits, not redeemable currency.",
    "Mint unique pistol DP-0042 to pilot and unique rifle R-042 to Harbor. Mint pilot ammo 160 and parts 8.",
    "Delegate NPC spending caps matching their initial game-credit balances. The operator can settle raids and spend only delegated NPC budgets.",
    "Read back balances, token ownership and budgets; record transaction hashes. Configure the read-only ledger panel only after verification.",
  ],
  trust: [
    "This demo keeps all testnet signing keys on this PC, outside the project. It is not independent NPC custody.",
    "The owner can upgrade the contract and change spending caps. The operator is trusted for issuance, loot assignment and raid results.",
    "The local game is not automatically migrated by deploying this contract. A verified settlement bridge is a separate implementation step.",
  ],
};
await mkdir(join(root, "docs"), { recursive: true });
await writeFile(planPath, JSON.stringify(plan, null, 2) + "\n", { flag: "wx" });
console.log(
  `Prepared ${contractId}; ${accounts.length} local keypairs saved outside the repository. No network requests or signatures made.`,
);
console.log(`Public plan: ${planPath}`);
