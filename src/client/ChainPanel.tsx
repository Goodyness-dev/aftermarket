import { useEffect, useState } from "react";
import {
  connectTestnet,
  disconnectTestnet,
  contractView,
  type ChainConfig,
} from "./near";

export function ChainPanel({
  live = false,
  pending = false,
  onModeChange,
}: {
  live?: boolean;
  pending?: boolean;
  onModeChange?: (mode: "enter" | "exit") => void;
}) {
  const [config, setConfig] = useState<ChainConfig | null>(null),
    [account, setAccount] = useState(""),
    [token, setToken] = useState("R-042"),
    [result, setResult] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setError("Could not load the network configuration."));
  }, []);
  async function connect() {
    setBusy(true);
    setError("");
    try {
      setAccount(await connectTestnet());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function inspect() {
    if (!config) return;
    setBusy(true);
    setError("");
    try {
      const [tokens, supply] = await Promise.all([
        contractView<unknown[]>(config, "mt_token", { token_ids: [token] }),
        contractView<string | null>(config, "mt_supply", { token_id: token }),
      ]);
      setResult(JSON.stringify({ token: tokens[0], supply }, null, 2));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="chain-panel">
      <div>
        <span className="eyebrow">NEAR / TESTNET OWNERSHIP</span>
        <h2>Verify the ledger.</h2>
        <p>
          {live
            ? "The demo pilot's weapon ownership and credit payments settle on NEAR testnet. This local server holds the demo signing keys; combat, ammunition and wear are simulated. Wallet connection below is for inspection and does not replace pilot custody."
            : "Practice saves stay local. Inspect the separate deployed contract below, or enter the custodial testnet pilot to trade registered weapons and settle raid ownership. Your practice inventory is kept separately."}
        </p>
      </div>
      <div className="chain-fields">
        {config?.liveDemoAvailable && onModeChange && (
          <button
            className="primary"
            disabled={pending}
            onClick={() => onModeChange(live ? "exit" : "enter")}
          >
            {live ? "RETURN TO PRIVATE PRACTICE" : "ENTER LIVE TESTNET PILOT"} ↗
          </button>
        )}
        <div className="data-row">
          <span>Contract</span>
          <b>{config?.contractId ?? "DEPLOYMENT AWAITING APPROVAL"}</b>
        </div>
        <div className="data-row">
          <span>Network</span>
          <b>TESTNET ONLY</b>
        </div>
        <button
          className="secondary"
          disabled={busy}
          onClick={
            account
              ? async () => {
                  await disconnectTestnet();
                  setAccount("");
                }
              : connect
          }
        >
          {account ? `DISCONNECT ${account}` : "CONNECT TESTNET WALLET"}
        </button>
        {account && <p>Connected: {account}</p>}
        <label>
          ON-CHAIN WEAPON ID
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            maxLength={80}
          />
        </label>
        <button
          className="secondary"
          disabled={busy || !config?.contractId || !token}
          onClick={inspect}
        >
          READ CONFIRMED OWNERSHIP ↗
        </button>
        {error && (
          <p role="alert" className="chain-error">
            {error}
          </p>
        )}
        {result && (
          <>
            <pre>{result}</pre>
            <a
              href={`https://testnet.nearblocks.io/address/${config?.contractId}`}
              target="_blank"
              rel="noreferrer"
            >
              OPEN CONTRACT EXPLORER ↗
            </a>
          </>
        )}
      </div>
    </section>
  );
}
