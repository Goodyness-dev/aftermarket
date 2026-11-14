import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { DemoRecorder } from "./DemoRecorder";
import type { createGame } from "./scene";
import {
  MODELS,
  quote,
  distance,
  type World,
  type Raid,
  type Gun,
  type Model,
} from "../domain/game";
import "./style.css";
const WeaponViewer = React.lazy(() =>
  import("./WeaponViewer").then((module) => ({ default: module.WeaponViewer })),
);
import { ChainPanel } from "./ChainPanel";
import { InspectionBoundary } from "./InspectionBoundary";
type Snapshot = {
  world: World;
  raid: Raid | null;
  mode: string;
  serverTime: number;
  chain?: {
    live: boolean;
    pending: boolean;
    state: string;
    error?: string;
    accountId: string;
    receipts: { id: string; hash: string; state: string }[];
  } | null;
};
let latest: Snapshot | null = null;
let panelValue = "landing";
let pausedValue = false;
let mutedValue = false;
let qualityValue: "low" | "standard" | "high" = "high";
let selectedModel: Model = "rifle";
const money = (n: number) => n.toLocaleString("en-US");
function Icon({ name }: { name: string }) {
  return (
    <span className="icon">
      {(
        {
          cross: "✛",
          arrow: "↗",
          box: "▣",
          dot: "◈",
          gun: "⌁",
          check: "✓",
          close: "×",
        } as Record<string, string>
      )[name] ?? name}
    </span>
  );
}
function GunArt({ model, large = false }: { model: Model; large?: boolean }) {
  return (
    <svg
      className={`gun-art ${large ? "large" : ""}`}
      viewBox="0 0 360 140"
      aria-label={MODELS[model].name}
    >
      <defs>
        <linearGradient id={"steel" + model} x2="0" y2="1">
          <stop stopColor="#a6aca1" />
          <stop offset=".4" stopColor="#596862" />
          <stop offset="1" stopColor="#263730" />
        </linearGradient>
      </defs>
      {model === "pistol" ? (
        <g fill={`url(#steel${model})`} stroke="#b3ba9f" strokeWidth="1">
          <path d="M100 42h155v28H155l-10 48h-42l15-54h-18z" />
          <path d="M151 70h39v22h-44" fill="none" strokeWidth="4" />
          <rect x="252" y="48" width="20" height="13" />
          <path d="M108 45h139M125 75l-8 30" />
        </g>
      ) : (
        <g fill={`url(#steel${model})`} stroke="#98a38f" strokeWidth="1">
          <path d="M22 52h60l25-14h118l7 11h73v15h-77l-10 13h-48l-8 40h-30l7-43h-29l-13 34H85l7-39-19-2-46 16z" />
          <rect x="277" y="47" width="58" height="7" />
          <rect x="164" y="24" width="38" height="14" />
          <path d="M108 44h110M235 52h40M39 60h32M145 83h20" />
          <path d="M126 76h-19v18h13" fill="none" strokeWidth="3" />
          {model === "smg" && <rect x="239" y="42" width="38" height="27" />}
        </g>
      )}
    </svg>
  );
}
function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<ReturnType<typeof createGame> | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [panel, setPanel] = useState("landing");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [requestPending, setPending] = useState(false);
  const pending = requestPending || !!snap?.chain?.pending;
  const [merchantId, setMerchant] = useState("mara");
  const [selected, setSelected] = useState("");
  const [listPrice, setListPrice] = useState("400");
  const [connected, setConnected] = useState(false);
  const [help, setHelp] = useState(false);
  const [inspect, setInspect] = useState<Gun | null>(null);
  const [muted, setMuted] = useState(false);
  const [quality, setQuality] = useState<"low" | "standard" | "high">(() => {
    try {
      const saved = localStorage.getItem("aftermarket-quality");
      return saved === "low" || saved === "standard" ? saved : "high";
    } catch {
      return "high";
    }
  });
  const [performanceStats, setPerformanceStats] = useState({
    fps: 0,
    meshes: 0,
  });
  qualityValue = quality;
  useEffect(() => {
    const update = (event: Event) =>
      setPerformanceStats((event as CustomEvent).detail);
    window.addEventListener("aftermarket:performance", update);
    return () => window.removeEventListener("aftermarket:performance", update);
  }, []);
  pausedValue = help || !!inspect;
  mutedValue = muted;
  useEffect(() => {
    panelValue = panel;
    if (panel !== "raid" && document.pointerLockElement)
      document.exitPointerLock();
  }, [panel]);
  useEffect(() => {
    let ws: WebSocket;
    let disposed = false;
    let retry: ReturnType<typeof setTimeout>;
    const connect = () => {
      ws = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/game`,
      );
      game.current?.connect(ws);
      ws.onopen = () => setConnected(true);
      ws.onmessage = (e) => {
        latest = JSON.parse(e.data);
      };
      ws.onclose = () => {
        setConnected(false);
        if (!disposed) retry = setTimeout(connect, 1500);
      };
    };
    fetch("/api/state")
      .then((r) => r.json())
      .then((s) => {
        latest = s;
        setSnap(s);
        setSelected(s.world.inventory[0]?.id ?? "");
        connect();
      })
      .catch(() => setError("Could not reach the game server."));
    void import("./scene")
      .then(({ createGame }) => {
        if (disposed) return;
        game.current = createGame(
          canvas.current!,
          () => ({
            raid: latest?.raid ?? null,
            active:
              panelValue === "raid" && !!latest?.raid && !latest.raid.finished,
            panel: panelValue,
            shooting: false,
            selected: selectedModel,
            paused: pausedValue,
            muted: mutedValue,
            world: latest?.world,
            quality: qualityValue,
          }),
          () => setReady(true),
        );
        if (ws) game.current.connect(ws);
      })
      .catch(() => setError("The 3D engine could not load. Refresh to retry."));
    const timer = setInterval(() => {
      if (latest) setSnap({ ...latest });
    }, 150);
    return () => {
      disposed = true;
      clearTimeout(retry);
      clearInterval(timer);
      ws?.close();
      game.current?.dispose();
    };
  }, []);
  useEffect(() => {
    if (panel === "raid" && snap?.raid?.finished) setPanel("debrief");
  }, [snap?.raid?.finished, panel]);
  useEffect(() => {
    if (snap?.chain?.live && snap.raid && !snap.raid.finished) {
      game.current?.reset();
      setPanel("raid");
    }
  }, [snap?.raid?.id, snap?.chain?.live]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  async function action(type: string, extra: Record<string, unknown> = {}) {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          ...extra,
          requestId: crypto.randomUUID(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      latest = data;
      setSnap(data);
      if (type === "deploy" && data.raid && !data.chain?.pending) {
        game.current?.reset();
        setPanel("raid");
      } else if (type === "abandon") setPanel("stash");
      else setToast(data.world.receipts[0]?.detail ?? "Saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  async function changeMode(mode: "enter" | "exit" | "reconcile") {
    if (requestPending || (pending && mode !== "reconcile")) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/live/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      latest = data;
      setSnap(data);
      setSelected(data.world.inventory[0]?.id ?? "");
      game.current?.reset();
      setPanel(data.raid && !data.raid.finished ? "raid" : "stash");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  const w = snap?.world;
  const r = snap?.raid;
  const merchant = w?.merchants.find((m) => m.id === merchantId);
  const selectedGun =
    w?.inventory.find((g) => g.id === selected) ??
    w?.inventory.find((g) => !g.reserved);
  selectedModel = selectedGun?.model ?? "rifle";
  const enter = () => {
    setPanel(snap?.raid && !snap.raid.finished ? "raid" : "stash");
  };
  const go = (p: string) => {
    setError("");
    setPanel(p);
  };
  const nearLoot = r?.crates.find((c) => !c.taken && distance(r, c) < 2.6);
  const card = (g: Gun, side: "owned" | "dealer") => (
    <button
      key={g.id}
      className={`weapon-card ${selected === g.id ? "chosen" : ""}`}
      onClick={() => setSelected(g.id)}
    >
      <div className="card-top">
        <span>{MODELS[g.model].label}</span>
        <span>{g.condition}%</span>
      </div>
      <GunArt model={g.model} />
      <h3>{MODELS[g.model].name}</h3>
      <div className="serial">
        {g.id}
        <span>
          {g.reserved ? "RESERVED" : side === "dealer" ? "IN STOCK" : "OWNED"}
        </span>
      </div>
      {side === "dealer" && merchant && (
        <div className="card-price">
          {money(quote(merchant, g, "buy").price)} <small>CR</small>
        </div>
      )}
    </button>
  );
  return (
    <div className={`app ${panel === "landing" ? "landing" : ""}`}>
      <canvas ref={canvas} id="game" aria-label="Duskport 3D game scene" />
      <div className="vignette" />
      {panel !== "raid" && (
        <header>
          <button className="wordmark" onClick={() => go("landing")}>
            <span className="brand-symbol">
              A<span>/</span>
            </span>
            AFTERMARKET<span className="edition">DUSKPORT / 09</span>
          </button>
          <div className="top-right">
            <span className="live-dot" />
            {connected ? "DEPOT ONLINE" : "CONNECTING"}
            <span className="separator" />
            {snap?.chain?.live ? "NEAR TESTNET PILOT" : "LOCAL PRACTICE"}
            <button className="help-btn" onClick={() => setHelp(!help)}>
              ?
            </button>
          </div>
        </header>
      )}
      {panel === "landing" ? (
        <>
          <div className="location">
            <span className="tiny-line" /> COASTAL FREE ZONE{" "}
            <b>06° 27′ N / 03° 23′ E</b>
          </div>
          <main className="hero">
            <div className="eyebrow">
              <span />
              THE CITY DOESN’T SLEEP. NEITHER DOES THE MARKET.
            </div>
            <h1>
              EVERY GUN
              <br />
              HAS A <em>PRICE.</em>
            </h1>
            <p>
              Fight for your inventory.
              <br />
              Trade to shape the next battlefield.
            </p>
            <div className="hero-actions">
              <button
                className="primary enter"
                disabled={!w || !ready}
                onClick={enter}
              >
                {ready ? "ENTER DUSKPORT" : "PREPARING DISTRICT"}
                <Icon name="arrow" />
              </button>
              <button className="text-btn" onClick={() => setHelp(true)}>
                THE OPERATOR’S BRIEF <span>↗</span>
              </button>
            </div>
            <div className="hero-foot">
              <span>01 / THE EXCHANGE</span>
              <i /> A LIVING WEAPONS ECONOMY
            </div>
          </main>
          <aside className="dispatch">
            <div className="eyebrow">◉ LIVE FROM THE DISTRICT</div>
            <h3>
              Demand doesn’t
              <br />
              wait for daylight.
            </h3>
            <p>
              Harbor Authority is buying rifles.
              <br />
              What you sell today arms tomorrow’s patrol.
            </p>
            <div className="dispatch-bottom">
              <span>RIFLE PROCUREMENT</span>
              <strong>ACTIVE ↗</strong>
            </div>
          </aside>
          <footer>
            <span>AN EXTRACTION SHOOTER / AN ECONOMY WITH CONSEQUENCES</span>
            <span>
              PROTOTYPE 0.1 <i /> SERVER-AUTHORITATIVE PRACTICE
            </span>
          </footer>
        </>
      ) : panel === "raid" && r ? (
        <>
          <div className="raid-top">
            <div>
              <span className="eyebrow">FREIGHT NINE / LIVE OPERATION</span>
              <h2>RECOVER. SURVIVE. EXTRACT.</h2>
            </div>
            <button className="quiet" onClick={() => setHelp(true)}>
              CONTROLS / ESC TO RELEASE MOUSE
            </button>
          </div>
          <div className="objective">
            <span className="accent">◈ RECOVERY CONTRACT</span>
            <p>
              {snap?.chain?.live
                ? "Recover Harbor's registered rifle from its guard."
                : "Recover a rifle from the lost shipment."}
            </p>
            <small>
              {r.loot.some((g) => g.model === "rifle")
                ? "SHIPMENT SECURED · REACH EXTRACTION"
                : "SEARCH THE CENTRAL FREIGHT LANE"}
            </small>
          </div>
          <div className="crosshair">
            <i />
            <i />
          </div>
          {nearLoot && (
            <div className="interact">
              <kbd>E</kbd>
              <div>
                <b>
                  {nearLoot.type === "gun"
                    ? `${MODELS[nearLoot.gun!.model].name} / ${nearLoot.gun!.id}`
                    : nearLoot.type === "parts"
                      ? `${nearLoot.amount} salvage parts`
                      : `${nearLoot.amount} ammunition`}
                </b>
                <small>RECOVER TO RAID INVENTORY</small>
              </div>
            </div>
          )}
          {r.extract > 0 && (
            <div className="extracting">
              <span>EXTRACTION IN PROGRESS</span>
              <progress max="3" value={r.extract} />
              <small>Hold this position · {Math.ceil(3 - r.extract)}s</small>
            </div>
          )}
          <div className="raid-bottom">
            <div className="health">
              <span>OPERATOR CONDITION</span>
              <strong>
                {r.hp}
                <small> / 100</small>
              </strong>
              <progress max="100" value={r.hp} />
            </div>
            <div className="raid-loot">
              <span>RECOVERED</span>
              <b>
                {r.loot.length} WEAPONS <i /> {r.parts} PARTS
              </b>
              <small>{r.kills} HOSTILES DOWN</small>
            </div>
            <div className="ammunition">
              <span>{MODELS[r.model].name}</span>
              <strong>
                {r.reloadUntil ? "…" : String(r.mag).padStart(2, "0")}
                <small> / {r.reserve}</small>
              </strong>
              <label>
                {r.reloadUntil ? "RELOADING" : "R / RELOAD"}
                <span>WASD / MOVE · E / LOOT</span>
              </label>
            </div>
          </div>
          <div className="mouse-tip">
            {document.pointerLockElement
              ? ""
              : "CLICK THE SCENE TO AIM · ESC TO RELEASE"}
          </div>
        </>
      ) : panel === "debrief" && r ? (
        <div className="debrief">
          <span className="eyebrow">OPERATION COMPLETE / FREIGHT NINE</span>
          <h1>{r.hp > 0 && r.extract >= 3 ? "YOU MADE IT." : "GEAR LOST."}</h1>
          <p>
            {r.hp > 0 && r.extract >= 3
              ? "The real work starts at the counter."
              : "Your stash is safe. Rebuild your loadout and go again."}
          </p>
          <div className="debrief-stats">
            <div>
              <b>{r.kills}</b>HOSTILES DOWN
            </div>
            <div>
              <b>{r.loot.length}</b>WEAPONS RECOVERED
            </div>
            <div>
              <b>{r.parts}</b>SALVAGE PARTS
            </div>
          </div>
          <button className="primary" onClick={() => go("stash")}>
            RETURN TO THE EXCHANGE <Icon name="arrow" />
          </button>
        </div>
      ) : w ? (
        <>
          <div className="dashboard">
            <nav>
              {["stash", "market", "workshop", "contracts", "history"].map(
                (p) => (
                  <button
                    className={panel === p ? "active" : ""}
                    onClick={() => go(p)}
                    key={p}
                  >
                    {
                      (
                        {
                          stash: "01 / STASH",
                          market: "02 / MARKET",
                          workshop: "03 / WORKSHOP",
                          contracts: "04 / CONTRACTS",
                          history: "05 / LEDGER",
                        } as Record<string, string>
                      )[p]
                    }
                  </button>
                ),
              )}
              <div className="balances">
                <span>
                  AVAILABLE CREDITS{" "}
                  <b>
                    {money(w.cash)} <small>CR</small>
                  </b>
                </span>
                <span>
                  PARTS <b>{w.parts}</b>
                </span>
                <span>
                  AMMO <b>{w.ammo}</b>
                </span>
              </div>
            </nav>
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  THE EXCHANGE / SHIFT {String(w.day).padStart(2, "0")}
                </span>
                <h1>
                  {
                    (
                      {
                        stash: "YOUR NEXT MOVE.",
                        market: "EVERYTHING CIRCULATES.",
                        workshop: "BUILT TO GO AGAIN.",
                        contracts: "FOLLOW THE DEMAND.",
                        history: "EVERY GUN HAS A STORY.",
                      } as Record<string, string>
                    )[panel]
                  }
                </h1>
              </div>
              <span className="standing">
                ◈ {w.reputation} STANDING
                <br />
                <small>{w.completed} SUCCESSFUL EXTRACTIONS</small>
              </span>
            </div>
            {panel === "stash" && (
              <div className="workspace">
                <section className="inventory-area">
                  <div className="section-title">
                    <h2>
                      YOUR ARSENAL <span>{w.inventory.length}</span>
                    </h2>
                    <small>SELECT A WEAPON TO PREPARE YOUR RUN</small>
                  </div>
                  <div className="weapon-grid">
                    {w.inventory.map((g) => card(g, "owned"))}
                  </div>
                  {!w.inventory.length && (
                    <div className="empty">
                      Your carried gear was lost. Request a recovery kit to get
                      back out there.
                      <button
                        className="secondary"
                        onClick={() => action("recovery")}
                      >
                        REQUEST RECOVERY KIT
                      </button>
                    </div>
                  )}
                  <div className="supply-bar">
                    <div>
                      <b>Run low, not empty.</b>
                      <p>60 rounds from Sable’s supply counter.</p>
                    </div>
                    <button
                      className="secondary"
                      disabled={pending}
                      onClick={() => action("ammo")}
                    >
                      RESUPPLY / 90 CR
                    </button>
                  </div>
                </section>
                <aside className="detail-panel">
                  <span className="eyebrow">DEPLOYMENT LOADOUT</span>
                  {selectedGun ? (
                    <>
                      <GunArt model={selectedGun.model} large />
                      <h2>{MODELS[selectedGun.model].name}</h2>
                      <p className="serial">
                        {selectedGun.id} · {selectedGun.condition}% CONDITION
                      </p>
                      <div className="data-row">
                        <span>Weapon family</span>
                        <b>{MODELS[selectedGun.model].label}</b>
                      </div>
                      <div className="data-row">
                        <span>Magazine capacity</span>
                        <b>{MODELS[selectedGun.model].mag} ROUNDS</b>
                      </div>
                      <div className="data-row">
                        <span>Reservation</span>
                        <b>
                          {selectedGun.reserved
                            ? "LISTED / LOCKED"
                            : "AVAILABLE"}
                        </b>
                      </div>
                      <div className="risk-note">
                        Carried equipment is lost on death. Your depot stash
                        stays safe.
                      </div>
                      <button
                        className="secondary inspect-button"
                        onClick={() => setInspect(selectedGun)}
                      >
                        INSPECT WEAPON IN 3D ↗
                      </button>
                      <button
                        className="primary"
                        disabled={pending || !!selectedGun.reserved}
                        onClick={() =>
                          action("deploy", { gunId: selectedGun.id })
                        }
                      >
                        DEPLOY TO FREIGHT NINE <Icon name="arrow" />
                      </button>
                    </>
                  ) : (
                    <p>Select a weapon to deploy.</p>
                  )}
                  <div className="tiny-caption">
                    4–6 MIN RAID / PVE / TWO EXTRACTION POINTS
                  </div>
                </aside>
              </div>
            )}
            {panel === "market" && merchant && (
              <>
                <div className="merchant-tabs">
                  {w.merchants.map((m) => (
                    <button
                      key={m.id}
                      className={merchant.id === m.id ? "selected" : ""}
                      onClick={() => {
                        setMerchant(m.id);
                        setSelected("");
                      }}
                    >
                      <span className="merchant-avatar">{m.name[0]}</span>
                      <span>
                        <b>{m.name}</b>
                        <small>{m.role}</small>
                      </span>
                      <i>↗</i>
                    </button>
                  ))}
                </div>
                <div className="workspace market">
                  <section>
                    <div className="section-title">
                      <h2>
                        ON THE COUNTER <span>{merchant.stock.length}</span>
                      </h2>
                      <small>{money(merchant.cash)} CR PURCHASING CASH</small>
                    </div>
                    <div className="weapon-grid">
                      {merchant.stock.map((g) => (
                        <div key={g.id}>
                          {card(g, "dealer")}
                          <button
                            className="buy-btn"
                            disabled={pending}
                            onClick={() =>
                              action("buy", {
                                merchant: merchant.id,
                                gunId: g.id,
                                price: quote(merchant, g, "buy").price,
                              })
                            }
                          >
                            BUY / {money(quote(merchant, g, "buy").price)} CR{" "}
                            <span>↗</span>
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="section-title sell-title">
                      <h2>SELL FROM YOUR STASH</h2>
                      <small>QUOTES REACT TO STOCK AND DEMAND</small>
                    </div>
                    {w.inventory
                      .filter((g) => !g.reserved)
                      .map((g) => (
                        <div className="sell-row" key={g.id}>
                          <GunArt model={g.model} />
                          <div>
                            <b>{MODELS[g.model].name}</b>
                            <small>
                              {g.id} · {g.condition}%
                            </small>
                          </div>
                          <div className="quote-reason">
                            {quote(merchant, g, "sell").reason}
                          </div>
                          <button
                            className="secondary"
                            disabled={pending || g.id.startsWith("LOAN")}
                            onClick={() =>
                              action("sell", {
                                merchant: merchant.id,
                                gunId: g.id,
                                price: quote(merchant, g, "sell").price,
                              })
                            }
                          >
                            SELL / {money(quote(merchant, g, "sell").price)} CR
                          </button>
                        </div>
                      ))}
                  </section>
                  <aside className="detail-panel">
                    <span className="eyebrow">DISTRICT PROCUREMENT</span>
                    <h2>
                      Your sale arms
                      <br />
                      the next patrol.
                    </h2>
                    <p>
                      Advance the shift to let merchants fill eligible listings
                      and supply the Harbor Authority from their actual stock.
                    </p>
                    <div className="data-row">
                      <span>Faction treasury</span>
                      <b>{money(w.faction.cash)} CR</b>
                    </div>
                    <div className="data-row">
                      <span>Rifles procured</span>
                      <b>{w.faction.stock.length}</b>
                    </div>
                    <button
                      className="primary"
                      disabled={pending}
                      onClick={() => action("shift")}
                    >
                      ADVANCE SHIFT <Icon name="arrow" />
                    </button>
                    <div className="listing-form">
                      <h3>PLAYER LISTING</h3>
                      <select
                        aria-label="Weapon to list"
                        value={selectedGun?.id ?? ""}
                        onChange={(e) => setSelected(e.target.value)}
                      >
                        {w.inventory
                          .filter((g) => !g.reserved)
                          .map((g) => (
                            <option value={g.id} key={g.id}>
                              {g.id} / {MODELS[g.model].name}
                            </option>
                          ))}
                      </select>
                      <label>
                        ASKING PRICE / CR
                        <input
                          type="number"
                          min="25"
                          max="5000"
                          value={listPrice}
                          onChange={(e) => setListPrice(e.target.value)}
                        />
                      </label>
                      <button
                        className="secondary"
                        disabled={
                          pending || !selectedGun || !!selectedGun.reserved
                        }
                        onClick={() =>
                          action("list", {
                            gunId: selectedGun?.id,
                            price: Number(listPrice),
                          })
                        }
                      >
                        LIST WEAPON
                      </button>
                    </div>
                    {w.listings.map((l) => (
                      <div className="listing" key={l.id}>
                        <span>
                          {l.gunId} / {l.price} CR
                        </span>
                        <button
                          onClick={() => action("cancel", { listingId: l.id })}
                        >
                          CANCEL
                        </button>
                      </div>
                    ))}
                  </aside>
                </div>
              </>
            )}
            {panel === "workshop" && (
              <div className="workspace">
                <section>
                  <div className="section-title">
                    <h2>IVO’S WORKBENCH</h2>
                    <small>
                      PARTS ARE CONSUMED / NO INSTANT VALUE CREATION
                    </small>
                  </div>
                  {w.inventory
                    .filter((g) => !g.reserved)
                    .map((g) => (
                      <div className="repair-card" key={g.id}>
                        <GunArt model={g.model} large />
                        <div>
                          <span className="eyebrow">{g.id}</span>
                          <h2>{MODELS[g.model].name}</h2>
                          <p>Condition {g.condition}% → 100%</p>
                          <progress value={g.condition} max="100" />
                          <div className="repair-actions">
                            <button
                              className="primary"
                              disabled={pending || g.condition === 100}
                              onClick={() => action("repair", { gunId: g.id })}
                            >
                              REPAIR / {Math.ceil((100 - g.condition) * 1.7)} CR
                              + {Math.ceil((100 - g.condition) / 12)} PARTS
                            </button>
                            <button
                              className="quiet"
                              disabled={pending || g.id.startsWith("LOAN")}
                              onClick={() =>
                                action("dismantle", { gunId: g.id })
                              }
                            >
                              DISMANTLE
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </section>
                <aside className="detail-panel">
                  <span className="eyebrow">REPAIR & REBUILD</span>
                  <h2>
                    Good equipment
                    <br />
                    deserves another run.
                  </h2>
                  <p>
                    Ivo’s repairs consume your salvage and workshop materials.
                    Each rebuild becomes part of the weapon’s permanent local
                    history.
                  </p>
                  <div className="data-row">
                    <span>Your salvage</span>
                    <b>{w.parts} PARTS</b>
                  </div>
                  <div className="data-row">
                    <span>Workshop supplies</span>
                    <b>{w.merchants[1].parts}</b>
                  </div>
                </aside>
              </div>
            )}
            {panel === "contracts" && (
              <div className="workspace">
                <section>
                  <article className="contract-card">
                    <span className="eyebrow">01 / DEPOT RECOVERY OFFICE</span>
                    <div className="contract-icon">↗</div>
                    <h2>The missing shipment.</h2>
                    <p>
                      A rifle shipment disappeared in Freight Nine. Recover any
                      rifle and extract alive. Keep the weapon; the depot pays
                      for locating the route.
                    </p>
                    <div className="contract-reward">
                      <b>240 CR</b>
                      <span>+15 STANDING</span>
                    </div>
                    <button
                      className="primary"
                      disabled={pending || !w.contractDone || w.contractClaimed}
                      onClick={() => action("claim")}
                    >
                      {w.contractClaimed
                        ? "CONTRACT COMPLETED"
                        : w.contractDone
                          ? "CLAIM RECOVERY FEE"
                          : "RECOVER A RIFLE TO COMPLETE"}
                    </button>
                  </article>
                </section>
                <aside className="detail-panel">
                  <span className="eyebrow">HARBOR AUTHORITY</span>
                  <h2>
                    The city buys
                    <br />
                    what it needs.
                  </h2>
                  <p>
                    Sell rifles to the broker and advance a shift. Funded
                    faction procurement equips real guards in your next raid.
                  </p>
                  <div className="data-row">
                    <span>Available treasury</span>
                    <b>{money(w.faction.cash)} CR</b>
                  </div>
                  {w.faction.stock.map((g) => (
                    <div key={g.id} className="data-row">
                      <span>{g.id}</span>
                      <b>{g.reserved ? "DEPLOYED" : "READY FOR GUARD"}</b>
                    </div>
                  ))}
                </aside>
              </div>
            )}
            {panel === "history" && (
              <>
                <ChainPanel
                  live={!!snap?.chain?.live}
                  pending={pending}
                  onModeChange={changeMode}
                />
                {snap?.chain?.receipts.length ? (
                  <div className="chain-receipts">
                    {snap.chain.receipts.slice(0, 8).map((tx) => (
                      <a
                        key={tx.id}
                        href={`https://testnet.nearblocks.io/txns/${tx.hash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span>
                          {tx.id.split(":").at(-1)} / {tx.state}
                        </span>
                        <b>{tx.hash.slice(0, 16)}… ↗</b>
                      </a>
                    ))}
                  </div>
                ) : null}
                <div className="workspace">
                  <section>
                    <div className="section-title">
                      <h2>
                        {snap?.chain?.live
                          ? "TESTNET PILOT ACTIVITY"
                          : "CONFIRMED LOCAL ACTIVITY"}
                      </h2>
                      <small>
                        {snap?.chain?.live
                          ? "CREDITS AND WEAPON OWNERSHIP SETTLE ON NEAR"
                          : "PRIVATE PRACTICE SAVE"}
                      </small>
                    </div>
                    {w.receipts.length ? (
                      w.receipts.map((v) => (
                        <div className="receipt" key={v.id}>
                          <Icon name="check" />
                          <div>
                            <b>{v.label}</b>
                            <p>{v.detail}</p>
                          </div>
                          <time>
                            {new Date(v.at).toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                        </div>
                      ))
                    ) : (
                      <div className="empty">
                        Your first trade starts the ledger.
                      </div>
                    )}
                  </section>
                  <aside className="detail-panel">
                    <span className="eyebrow">WEAPON PROVENANCE</span>
                    {w.inventory.map((g) => (
                      <div className="provenance" key={g.id}>
                        <h3>
                          {g.id} / {MODELS[g.model].name}
                        </h3>
                        {g.history.map((h, i) => (
                          <div key={i}>
                            <span>○</span>
                            <p>
                              <b>{h.who}</b>
                              <small>{h.action}</small>
                            </p>
                          </div>
                        ))}
                      </div>
                    ))}
                  </aside>
                </div>
              </>
            )}
          </div>
          <div className="statusbar">
            <span>
              <i /> ALL CHANGES SAVED TO LOCAL SERVER
            </span>
            <span>
              {snap?.chain?.live
                ? "NEAR TESTNET / CUSTODIAL PILOT"
                : "PRIVATE PRACTICE / OPEN LEDGER FOR TESTNET"}
            </span>
          </div>
        </>
      ) : null}
      {(error || toast) && (
        <div className={`notification ${error ? "error" : ""}`} role="status">
          <span>{error ? "!" : "✓"}</span>
          {error || toast}
          <button
            onClick={() => {
              setError("");
              setToast("");
            }}
          >
            ×
          </button>
        </div>
      )}
      {snap?.chain?.live && (
        <div className="live-mode-note">
          NEAR TESTNET DEMO · CUSTODIAL PILOT · WEAPONS + CREDITS ON-CHAIN ·
          COMBAT, AMMO + WEAR SIMULATED
        </div>
      )}
      {pending && (
        <div className="pending">
          {snap?.chain?.pending
            ? "WAITING FOR NEAR CONFIRMATION…"
            : "PROCESSING…"}
          {snap?.chain?.error && <small>{snap.chain.error}</small>}
          {snap?.chain?.state === "failed" && (
            <button
              className="secondary"
              disabled={requestPending}
              onClick={() => changeMode("reconcile")}
            >
              RECONCILE REJECTED COMMAND
            </button>
          )}
        </div>
      )}
      {inspect && (
        <InspectionBoundary onClose={() => setInspect(null)}>
          <React.Suspense
            fallback={<div className="pending">LOADING WEAPON INSPECTION…</div>}
          >
            <WeaponViewer gun={inspect} onClose={() => setInspect(null)} />
          </React.Suspense>
        </InspectionBoundary>
      )}
      {help && (
        <div className="modal-backdrop">
          <div className="brief">
            <button className="close" onClick={() => setHelp(false)}>
              ×
            </button>
            <span className="eyebrow">WELCOME TO DUSKPORT</span>
            <h2>
              What you sell today
              <br />
              changes tomorrow’s fight.
            </h2>
            <p>
              Equip a weapon in your stash. Enter Freight Nine, recover
              equipment and reach either green extraction pad. Stand there for
              three seconds after the opening eight seconds. Leave the
              deployment area first. Opening this brief stops your inputs, but
              the live raid continues.
            </p>
            <div className="controls">
              <span>
                <kbd>W A S D</kbd> MOVE
              </span>
              <span>
                <kbd>MOUSE</kbd> AIM / CLICK TO FIRE
              </span>
              <span>
                <kbd>R</kbd> RELOAD
              </span>
              <span>
                <kbd>E</kbd> RECOVER LOOT
              </span>
              <span>
                <kbd>ESC</kbd> RELEASE CURSOR
              </span>
            </div>
            <button
              className="secondary audio-toggle"
              onClick={() => setMuted(!muted)}
            >
              {muted ? "ENABLE SOUND" : "MUTE SOUND"}
            </button>
            <label className="quality-control">
              GRAPHICS QUALITY{" "}
              <select
                value={quality}
                onChange={(event) => {
                  const next = event.target.value as typeof quality;
                  setQuality(next);
                  try {
                    localStorage.setItem("aftermarket-quality", next);
                  } catch {}
                }}
              >
                <option value="low">LOW / FASTER</option>
                <option value="standard">STANDARD</option>
                <option value="high">HIGH / CINEMATIC</option>
              </select>
            </label>
            <small className="performance-readout">
              {performanceStats.fps
                ? `${performanceStats.fps} FPS · ${performanceStats.meshes} ACTIVE MESHES · LIVE DEVICE READING`
                : "Waiting for renderer performance reading…"}
            </small>
            <p>
              Sell recovered guns, repair worn equipment, or list at your own
              price. Advance the market shift to let dealers supply faction
              guards. You may find your old gun again.
            </p>
            <small>
              {snap?.chain?.live
                ? "The custodial demo pilot settles registered weapon ownership and credit payments on NEAR testnet. The server holds demo keys and verifies combat. Ammo, salvage and condition are simulated; wallet connection is for inspection, not production account authentication."
                : "This private practice world saves on this machine. Open the ledger to inspect NEAR ownership or enter the separately labeled testnet pilot when enabled. Practice progress is kept separately."}
            </small>
            {r && !r.finished && (
              <button
                className="danger"
                onClick={() => {
                  setHelp(false);
                  action("abandon");
                }}
              >
                ABANDON RAID / LOSE CARRIED EQUIPMENT
              </button>
            )}
            <button className="primary" onClick={() => setHelp(false)}>
              UNDERSTOOD <Icon name="arrow" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<><App /><DemoRecorder /></>);
