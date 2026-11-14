import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { WebSocket } from "ws";

test(
  "HTTP and WebSocket lifecycle preserves saves and rejects client-side rewards",
  { timeout: 30000 },
  async (t) => {
    const dir = mkdtempSync(join(tmpdir(), "aftermarket-test-"));
    const port = 32100 + Math.floor(Math.random() * 1000),
      base = `http://127.0.0.1:${port}`;
    let child: ChildProcess,
      logs = "";
    async function boot() {
      child = spawn(
        process.execPath,
        ["--import", "tsx", "src/server/index.ts"],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            NODE_ENV: "production",
            PORT: String(port),
            DATA_DIR: dir,
          },
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        },
      );
      child.stdout?.on("data", (b) => (logs += b.toString()));
      child.stderr?.on("data", (b) => (logs += b.toString()));
      for (let i = 0; i < 100; i++) {
        try {
          const r = await fetch(base + "/api/health");
          if (r.ok) return;
        } catch {}
        if (child.exitCode !== null) throw Error(logs);
        await delay(100);
      }
      throw Error("Test server did not become ready: " + logs);
    }
    async function stop() {
      if (child && child.exitCode === null) {
        const closed = new Promise<void>((r) => child.once("exit", () => r()));
        child.kill();
        await closed;
      }
    }
    t.after(async () => {
      await stop();
      const root = resolve(tmpdir());
      if (!resolve(dir).startsWith(join(root, "aftermarket-test-")))
        throw Error("Unsafe cleanup path");
      rmSync(dir, { recursive: true, force: true });
    });
    await boot();
    const initial = await fetch(base + "/api/state"),
      cookie = initial.headers.get("set-cookie")!.split(";")[0];
    let snap: any = await initial.json();
    async function action(payload: any) {
      const res = await fetch(base + "/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ requestId: crypto.randomUUID(), ...payload }),
      });
      return { status: res.status, body: (await res.json()) as any };
    }
    const req = crypto.randomUUID(),
      first = await action({ type: "ammo", requestId: req }),
      retry = await action({ type: "ammo", requestId: req });
    assert.equal(first.status, 200);
    assert.equal(retry.body.world.cash, first.body.world.cash);
    assert.equal(retry.body.world.ammo, first.body.world.ammo);
    const gun = snap.world.inventory[0].id;
    const listed = await action({ type: "list", gunId: gun, price: 5000 });
    assert.equal(listed.status, 200);
    assert.equal((await action({ type: "deploy", gunId: gun })).status, 400);
    await action({
      type: "cancel",
      listingId: listed.body.world.listings[0].id,
    });
    const deployed = await action({ type: "deploy", gunId: gun });
    assert.equal(deployed.status, 200);
    const ws = new WebSocket(`ws://127.0.0.1:${port}/game`, {
      headers: { Cookie: cookie, Origin: base },
    });
    t.after(() => ws.close());
    await new Promise<void>((r, reject) => {
      ws.once("open", () => r());
      ws.once("error", reject);
    });
    let last: any;
    ws.on("message", (data) => (last = JSON.parse(data.toString())));
    ws.send(
      JSON.stringify({
        seq: 1,
        forward: 1,
        strafe: 0,
        yaw: 0,
        shoot: false,
        reload: false,
        interact: false,
        x: 999,
        cash: 999999,
        success: true,
        loot: ["fake"],
      }),
    );
    await delay(400);
    assert.ok(last.raid.z > -11 && last.raid.z < -8);
    assert.equal(last.raid.x, 0);
    assert.equal(last.world.cash, first.body.world.cash);
    assert.equal(last.raid.finished, false);
    assert.equal(last.raid.loot.length, 0);
    const z = last.raid.z;
    ws.send(JSON.stringify({ seq: 0, forward: 1, strafe: 0, yaw: 0 }));
    await delay(400);
    assert.equal(last.raid.z, z, "stale input must not restart movement");
    ws.close();
    const abandoned = await action({ type: "abandon" });
    assert.equal(abandoned.status, 200);
    const saved = abandoned.body.world;
    assert.equal(saved.inventory.length, 0);
    await stop();
    await boot();
    const restored = await fetch(base + "/api/state", { headers: { cookie } });
    snap = await restored.json();
    assert.deepEqual(snap.world, saved);
    assert.equal(snap.raid, null);
  },
);
