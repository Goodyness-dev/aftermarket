import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  Account,
  JsonRpcProvider,
  KeyPair,
  KeyPairSigner,
  SignedTransaction,
  actions,
  baseEncode,
  getTransactionLastResult,
} from "near-api-js";

export const CONTRACT = "aftermarket-f33ee39d.testnet";
export const RPC = "https://test.rpc.fastnear.com";
export type Role = "pilot" | "operator" | "mara" | "ivo" | "sable" | "harbor";
export const accountId = (role: Role) => `${role}.${CONTRACT}`;
export type Intent = {
  role: Role;
  method: string;
  args: Record<string, unknown>;
  deposit?: string;
};
export type Prepared = { bytes: string; hash: string; reserve: string };
export type ChainResult = {
  state: "confirmed" | "failed";
  value: unknown;
  logs: string[];
  burnt: string;
};
export interface SettlementTransport {
  prepare(intent: Intent): Promise<Prepared>;
  submit(prepared: Prepared, resumed?: boolean): Promise<ChainResult>;
}
export class SettlementFailure extends Error {}

// A persisted signed transaction is the retry unit. Never generate a second
// transaction just because a request timed out or the process restarted.
export class SettlementOutbox {
  constructor(
    private db: DatabaseSync,
    private transport: SettlementTransport,
  ) {
    db.exec(`CREATE TABLE IF NOT EXISTS chain_transactions (
      id TEXT PRIMARY KEY, intent TEXT NOT NULL, signed TEXT NOT NULL, hash TEXT NOT NULL,
      reserved TEXT NOT NULL, state TEXT NOT NULL, result TEXT, error TEXT);
      CREATE TABLE IF NOT EXISTS chain_budget (id INTEGER PRIMARY KEY CHECK(id=1), reserved TEXT NOT NULL);
      INSERT OR IGNORE INTO chain_budget VALUES(1,'0');`);
  }
  async run(id: string, intent: Intent): Promise<unknown> {
    const encoded = JSON.stringify(intent);
    let row = this.db
      .prepare("SELECT * FROM chain_transactions WHERE id=?")
      .get(id) as any;
    const resumed = !!row;
    if (row && row.intent !== encoded)
      throw new Error("Settlement ID reused for a different operation");
    if (!row) {
      const prepared = await this.transport.prepare(intent);
      const used = BigInt(
        (
          this.db
            .prepare("SELECT reserved FROM chain_budget WHERE id=1")
            .get() as any
        ).reserved,
      );
      // Existing deployment allocation is <5.70 testnet NEAR. Reserve at most
      // another 0.25 here, including worst-case gas and explicit deposits.
      if (used + BigInt(prepared.reserve) > 250000000000000000000000n)
        throw Error("Live demo transaction budget exhausted");
      this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db
          .prepare(
            "INSERT INTO chain_transactions(id,intent,signed,hash,reserved,state) VALUES(?,?,?,?,?,'pending')",
          )
          .run(id, encoded, prepared.bytes, prepared.hash, prepared.reserve);
        this.db
          .prepare("UPDATE chain_budget SET reserved=? WHERE id=1")
          .run((used + BigInt(prepared.reserve)).toString());
        this.db.exec("COMMIT");
      } catch (e) {
        this.db.exec("ROLLBACK");
        throw e;
      }
      row = {
        signed: prepared.bytes,
        hash: prepared.hash,
        reserved: prepared.reserve,
        state: "pending",
      };
    }
    if (row.state === "confirmed") return JSON.parse(row.result).value;
    if (row.state === "failed")
      throw new SettlementFailure(
        "The contract rejected this transaction; no automatic replacement was signed.",
      );
    try {
      const result = await this.transport.submit(
        {
          bytes: row.signed,
          hash: row.hash,
          reserve: row.reserved,
        },
        resumed,
      );
      this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db
          .prepare(
            "UPDATE chain_transactions SET state=?,result=?,error=NULL WHERE id=?",
          )
          .run(result.state, JSON.stringify(result), id);
        const budget = BigInt(
          (
            this.db
              .prepare("SELECT reserved FROM chain_budget WHERE id=1")
              .get() as any
          ).reserved,
        );
        this.db
          .prepare("UPDATE chain_budget SET reserved=? WHERE id=1")
          .run(
            (budget - BigInt(row.reserved) + BigInt(result.burnt)).toString(),
          );
        this.db.exec("COMMIT");
      } catch (e) {
        this.db.exec("ROLLBACK");
        throw e;
      }
      if (result.state === "failed")
        throw new SettlementFailure(
          "The contract rejected this transaction; inspect its receipt.",
        );
      return result.value;
    } catch (e) {
      this.db
        .prepare("UPDATE chain_transactions SET error=? WHERE id=?")
        .run((e as Error).message.slice(0, 500), id);
      throw e;
    }
  }
  receipts() {
    return this.db
      .prepare(
        "SELECT id,hash,state,result FROM chain_transactions ORDER BY rowid DESC LIMIT 30",
      )
      .all()
      .map((r: any) => ({ id: r.id, hash: r.hash, state: r.state }));
  }
  async resumePending(prefix: string) {
    const rows = this.db
      .prepare(
        "SELECT id,intent FROM chain_transactions WHERE state='pending' ORDER BY rowid",
      )
      .all() as any[];
    for (const row of rows)
      if (row.id.startsWith(prefix))
        await this.run(row.id, JSON.parse(row.intent));
  }
}

export class NearTransport implements SettlementTransport {
  readonly provider = new JsonRpcProvider({ url: RPC });
  private clients = new Map<Role, Account>();
  private checked = false;
  async check() {
    if (this.checked) return;
    if ((await this.provider.viewNodeStatus()).chain_id !== "testnet")
      throw Error("Refusing a non-testnet RPC");
    const state = await new Account(CONTRACT, this.provider).getState();
    if (state.codeHash !== "ACtLBABghdJcVBvM656Q9mRGnbCb9sT3zzekd5vPfUhc")
      throw Error("Contract code differs from the reviewed deployment");
    this.checked = true;
  }
  async client(role: Role) {
    await this.check();
    let client = this.clients.get(role);
    if (!client) {
      const credential = JSON.parse(
        await readFile(
          join(
            homedir(),
            ".near-credentials/testnet",
            CONTRACT,
            `${role}.json`,
          ),
          "utf8",
        ),
      );
      if (credential.account_id !== accountId(role))
        throw Error("Unexpected signing account");
      const key = KeyPair.fromString(credential.private_key);
      if (key.getPublicKey().toString() !== credential.public_key)
        throw Error("Credential public key mismatch");
      client = new Account(
        accountId(role),
        this.provider,
        new KeyPairSigner(key),
      );
      this.clients.set(role, client);
    }
    return client;
  }
  async prepare(intent: Intent): Promise<Prepared> {
    if (
      ![
        "list_weapon",
        "fill_listing",
        "fill_listing_for_npc",
        "cancel_listing",
        "begin_raid",
        "assign_raid_loot",
        "settle_raid",
        "expire_raid",
        "mt_transfer",
      ].includes(intent.method)
    )
      throw Error("This bridge cannot mint, upgrade or transfer native funds");
    if (
      intent.deposit &&
      intent.deposit !== "0" &&
      !(intent.method === "mt_transfer" && intent.deposit === "1")
    )
      throw Error("Unexpected native deposit");
    if (
      intent.method === "mt_transfer" &&
      (intent.role !== "pilot" ||
        intent.args.token_id !== "credit" ||
        ![accountId("ivo"), accountId("sable")].includes(
          String(intent.args.receiver_id),
        ))
    )
      throw Error("Unsupported service payment");
    const client = await this.client(intent.role);
    const gas = 60_000_000_000_000n;
    const gasPrice = await this.provider.viewGasPrice();
    const signed = await client.createSignedTransaction({
      receiverId: CONTRACT,
      actions: [
        actions.functionCall(
          intent.method,
          intent.args,
          gas,
          BigInt(intent.deposit ?? "0"),
        ),
      ],
    });
    return {
      bytes: Buffer.from(signed.encode()).toString("base64"),
      hash: baseEncode(
        createHash("sha256").update(signed.transaction.encode()).digest(),
      ),
      reserve: (
        gas * BigInt(gasPrice.gas_price) * 2n +
        BigInt(intent.deposit ?? "0")
      ).toString(),
    };
  }
  async submit(prepared: Prepared, resumed = true): Promise<ChainResult> {
    const signed = SignedTransaction.decode(
      Buffer.from(prepared.bytes, "base64"),
    );
    if (
      signed.transaction.receiverId !== CONTRACT ||
      !signed.transaction.signerId.endsWith(`.${CONTRACT}`)
    )
      throw Error("Unexpected persisted transaction target");
    let outcome;
    try {
      if (!resumed) {
        outcome = await this.provider.sendTransactionUntil(signed, "FINAL");
      } else {
        outcome = await this.provider.viewTransactionStatus({
          txHash: prepared.hash,
          accountId: signed.transaction.signerId,
          waitUntil: "NONE",
        });
      }
    } catch (e) {
      // A timeout is not proof of absence. Only an explicit unknown-transaction
      // response permits rebroadcast, always using identical signed bytes.
      const unknown =
        /UNKNOWN_TRANSACTION|doesn't exist|does not exist|UnknownTransaction/i.test(
          (e as Error).message + " " + (e as Error).constructor.name,
        );
      if (!unknown) throw e;
      outcome = await this.provider.sendTransactionUntil(signed, "FINAL");
    }
    if (typeof outcome.status !== "object" || !outcome.status)
      throw Error("Transaction has not reached a terminal result");
    const state =
      "SuccessValue" in outcome.status
        ? "confirmed"
        : "Failure" in outcome.status
          ? "failed"
          : null;
    if (!state) throw Error("Transaction outcome remains pending");
    return {
      state,
      value:
        state === "confirmed"
          ? getTransactionLastResult(outcome)
          : outcome.status,
      logs: (outcome.receipts_outcome ?? []).flatMap((r) => r.outcome.logs),
      burnt: [outcome.transaction_outcome, ...(outcome.receipts_outcome ?? [])]
        .reduce((n, r) => n + BigInt(r.outcome.tokens_burnt), 0n)
        .toString(),
    };
  }
  async view<T>(method: string, args: Record<string, unknown>): Promise<T> {
    await this.check();
    return (await this.provider.callFunction({
      contractId: CONTRACT,
      method,
      args,
      blockQuery: { finality: "final" },
    })) as T;
  }
  async height() {
    await this.check();
    return (await this.provider.viewBlock({ finality: "final" })).header.height;
  }
}
