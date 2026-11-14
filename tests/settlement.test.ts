import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  SettlementOutbox,
  SettlementFailure,
  type SettlementTransport,
  type Intent,
  type Prepared,
  type ChainResult,
} from "../src/server/settlement.js";

const intent: Intent = {
  role: "pilot",
  method: "list_weapon",
  args: { token_id: "DP-0042", price: "100", expires_at: "1000" },
};
const prepared: Prepared = {
  bytes: "persisted-signed-bytes",
  hash: "same-transaction-hash",
  reserve: "12000000000000000000000",
};
const confirmed: ChainResult = {
  state: "confirmed",
  value: "42",
  logs: [],
  burnt: "100",
};

test("a worker restart after broadcast retries identical signed bytes and returns one payment result", async () => {
  const db = new DatabaseSync(":memory:");
  let signs = 0,
    broadcasts = 0;
  const transport: SettlementTransport = {
    async prepare() {
      signs++;
      return prepared;
    },
    async submit(tx) {
      assert.deepEqual(tx, prepared);
      // Simulate the chain accepting a transaction while its HTTP response is lost.
      broadcasts++;
      if (broadcasts === 1) throw Error("response lost after acceptance");
      return confirmed;
    },
  };
  await assert.rejects(
    new SettlementOutbox(db, transport).run("command:payment", intent),
    /response lost/,
  );
  assert.equal(
    (db.prepare("SELECT state FROM chain_transactions").get() as any).state,
    "pending",
  );
  const restarted = new SettlementOutbox(db, transport);
  assert.equal(await restarted.run("command:payment", intent), "42");
  assert.equal(await restarted.run("command:payment", intent), "42");
  assert.equal(signs, 1);
  assert.equal(broadcasts, 2);
  assert.equal(
    (db.prepare("SELECT reserved FROM chain_budget").get() as any).reserved,
    confirmed.burnt,
  );
  db.close();
});

test("an operation ID cannot change recipient or price after its signature is saved", async () => {
  const db = new DatabaseSync(":memory:");
  const outbox = new SettlementOutbox(db, {
    async prepare() {
      return prepared;
    },
    async submit() {
      return confirmed;
    },
  });
  await outbox.run("one", intent);
  await assert.rejects(
    outbox.run("one", { ...intent, args: { ...intent.args, price: "9000" } }),
    /different operation/,
  );
  db.close();
});

test("explicit contract failure is terminal and cannot create an automatic replacement transaction", async () => {
  const db = new DatabaseSync(":memory:");
  let signs = 0,
    submits = 0;
  const outbox = new SettlementOutbox(db, {
    async prepare() {
      signs++;
      return prepared;
    },
    async submit() {
      submits++;
      return { ...confirmed, state: "failed", value: "Insufficient balance" };
    },
  });
  await assert.rejects(outbox.run("one", intent), SettlementFailure);
  await assert.rejects(
    new SettlementOutbox(db, {
      async prepare() {
        throw Error("must not sign");
      },
      async submit() {
        throw Error("must not broadcast");
      },
    }).run("one", intent),
    SettlementFailure,
  );
  assert.equal(signs, 1);
  assert.equal(submits, 1);
  db.close();
});

test("the persistent bridge gas budget blocks additional broadcasts", async () => {
  const db = new DatabaseSync(":memory:");
  let submits = 0;
  const outbox = new SettlementOutbox(db, {
    async prepare() {
      return { ...prepared, reserve: "200000000000000000000000" };
    },
    async submit() {
      submits++;
      return { ...confirmed, burnt: "200000000000000000000000" };
    },
  });
  await outbox.run("one", intent);
  await assert.rejects(outbox.run("two", intent), /budget exhausted/);
  assert.equal(submits, 1);
  db.close();
});
