import express from "express";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import { initialWorld, type World, type Raid } from "../domain/game.js";
import { command, tick } from "./engine.js";
import { chainConfig } from "./chain-config.js";
import { LiveGame } from "./live-game.js";

const dataDir = process.env.DATA_DIR ?? "data";
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(join(dataDir, "aftermarket.db"));
db.exec(
  "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS saves (id TEXT PRIMARY KEY, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS requests (session TEXT, id TEXT, PRIMARY KEY(session,id));",
);
type Session = { world: World; raid: Raid | null; live?: boolean };
const live = process.env.NEAR_LIVE_DEMO === "1" ? new LiveGame(db) : null;
const sessions = new Map<string, Session>();
const inputs = new Map<string, any>();
const app = express();
app.use(express.json({ limit: "8kb" }));
app.use("/api", (req, res, next) => {
  if (req.method === "POST" && req.headers.origin) {
    try {
      if (new URL(req.headers.origin).host !== req.headers.host) {
        res
          .status(403)
          .json({ error: "Use the game's own origin for commands." });
        return;
      }
    } catch {
      res.status(403).json({ error: "Invalid command origin." });
      return;
    }
  }
  next();
});
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });
const cookie = (req: any) =>
  String(req.headers.cookie ?? "")
    .split(";")
    .find((s) => s.trim().startsWith("aftermarket="))
    ?.trim()
    .slice(12);
function practice(id: string): Session {
  let s = sessions.get(id);
  if (!s) {
    const row = db
      .prepare("SELECT payload FROM saves WHERE id=?")
      .get(id) as any;
    s = row ? JSON.parse(row.payload) : { world: initialWorld(), raid: null };
    sessions.set(id, s!);
  }
  return s!;
}
function get(id: string): Session {
  const local = practice(id);
  return live?.isOwner(id)
    ? { world: live.state.world, raid: live.state.raid, live: true }
    : local;
}
function save(id: string) {
  if (live?.isOwner(id)) {
    live.save();
    return;
  }
  db.prepare(
    "INSERT INTO saves VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
  ).run(id, JSON.stringify(get(id)));
}
function view(s: Session) {
  return {
    world: s.world,
    raid: s.raid,
    mode: s.live
      ? "NEAR testnet pilot · custodial demo · weapon/credit settlement on-chain · combat simulated"
      : "Local practice · server-authoritative · off-chain",
    chain: s.live ? live!.status() : null,
    serverTime: Date.now(),
  };
}
app.get("/api/state", (req, res) => {
  let id = cookie(req);
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) {
    id = crypto.randomUUID();
    res.cookie("aftermarket", id, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 30 * 864e5,
    });
  }
  const s = get(id);
  save(id);
  res.json(view(s));
});
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, settlement: "local-sqlite", chainConnected: false }),
);
app.get("/api/config", (_req, res) =>
  res.json({ ...chainConfig(), liveDemoAvailable: !!live }),
);
app.post("/api/live/:mode", async (req, res) => {
  const id = cookie(req);
  if (!live) {
    res.status(404).json({ error: "The local testnet demo is disabled." });
    return;
  }
  if (!id || !sessions.has(id)) {
    res.status(401).json({ error: "Load the depot first." });
    return;
  }
  try {
    if (req.params.mode === "enter") {
      if (practice(id).raid && !practice(id).raid!.finished)
        throw Error(
          "Finish your practice raid before entering the testnet pilot.",
        );
      await live.enter(id);
    } else if (req.params.mode === "exit") live.exit(id);
    else if (req.params.mode === "reconcile") await live.reconcile(id);
    else throw Error("Unknown testnet mode action.");
    res.json(view(get(id)));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
app.post("/api/action", async (req, res) => {
  const id = cookie(req);
  if (!id || !sessions.has(id)) {
    res.status(401).json({ error: "Load the depot first." });
    return;
  }
  const a = req.body;
  if (typeof a?.requestId !== "string" || a.requestId.length > 80) {
    res.status(400).json({ error: "A request ID is required." });
    return;
  }
  const s = get(id);
  if (s.live) {
    try {
      await live!.perform(a);
      res.json(view(get(id)));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
    return;
  }
  if (
    db
      .prepare("SELECT id FROM requests WHERE session=? AND id=?")
      .get(id, a.requestId)
  ) {
    res.json(view(s));
    return;
  }
  const before = structuredClone(s);
  try {
    if (
      ["sell", "list", "dismantle"].includes(a.type) &&
      String(a.gunId).startsWith("LOAN")
    )
      throw Error("Recovery weapons cannot be sold, listed or dismantled.");
    s.raid = command(s.world, s.raid, a);
    db.exec("BEGIN");
    save(id);
    db.prepare("INSERT INTO requests VALUES (?,?)").run(id, a.requestId);
    db.exec("COMMIT");
    inputs.delete(id);
    res.json(view(s));
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {}
    sessions.set(id, before);
    res.status(400).json({ error: (e as Error).message });
  }
});
server.on("upgrade", (req, socket, head) => {
  if (req.url?.split("?")[0] !== "/game") return;
  const id = cookie(req),
    origin = req.headers.origin;
  const host = req.headers.host;
  let validOrigin = false;
  try {
    validOrigin = !origin || new URL(origin).host === host;
  } catch {}
  if (!id || !sessions.has(id) || !validOrigin) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    (ws as any).sessionId = id;
    wss.emit("connection", ws, req);
  });
});
wss.on("connection", (ws: any) => {
  ws.on("message", (data: Buffer) => {
    try {
      if (data.length > 2048) return;
      const a = JSON.parse(data.toString());
      if (
        ![a.forward, a.strafe, a.yaw].every(Number.isFinite) ||
        !Number.isSafeInteger(a.seq) ||
        a.seq < 0
      )
        return;
      const s = get(ws.sessionId);
      if (!s.raid || a.seq <= s.raid.seq) return;
      s.raid.seq = a.seq;
      s.raid.lastInput = Date.now();
      inputs.set(ws.sessionId, {
        forward: Math.max(-1, Math.min(1, a.forward)),
        strafe: Math.max(-1, Math.min(1, a.strafe)),
        yaw: a.yaw % (Math.PI * 2),
        shoot: !!a.shoot,
        reload: !!a.reload,
        interact: !!a.interact,
      });
    } catch {}
  });
  ws.on("error", () => {});
});
setInterval(() => {
  const now = Date.now();
  for (const [id] of sessions) {
    const s = get(id);
    if (s.raid && !s.raid.finished) {
      if (s.live && live!.busy) continue;
      const input = now - s.raid.lastInput < 250 ? inputs.get(id) : null;
      tick(
        s.live ? structuredClone(s.world) : s.world,
        s.raid,
        input ?? {
          forward: 0,
          strafe: 0,
          yaw: s.raid.yaw,
          shoot: false,
          reload: false,
          interact: false,
        },
        0.05,
        now,
      );
      if (s.raid.finished) {
        save(id);
        if (s.live)
          void live!
            .raidFinished()
            .catch((e) =>
              console.error("Raid settlement pending:", (e as Error).message),
            );
      }
    }
  }
  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify(view(get((ws as any).sessionId))));
  }
}, 50);
setInterval(() => {
  for (const [id] of sessions) save(id);
}, 1500).unref();
setInterval(() => {
  if (live?.state.job) void live.resume();
  else if (live?.state.raid?.finished) void live.raidFinished();
}, 3000).unref();
if (process.env.NODE_ENV === "production") {
  app.use(express.static("dist"));
  app.get("/{*splat}", (_req, res) =>
    res.sendFile("index.html", { root: process.cwd() + "/dist" }),
  );
} else {
  const { createServer: createVite } = await import("vite");
  const vite = await createVite({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
if (live && !["127.0.0.1", "localhost", "::1"].includes(host))
  throw Error(
    "The custodial pilot demo must bind to loopback. Public hosting serves practice and confirmed ledger reads.",
  );
server.listen(port, host, () =>
  console.log(`AFTERMARKET running at http://127.0.0.1:${port}`),
);
