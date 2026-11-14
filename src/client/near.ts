import type { NearConnector } from "@hot-labs/near-connect";

export type ChainConfig = {
  network: "testnet";
  contractId: string | null;
  rpcUrl: string;
  liveDemoAvailable?: boolean;
};
let connector: NearConnector | undefined;
export async function connectTestnet() {
  const { NearConnector } = await import("@hot-labs/near-connect");
  connector ??= new NearConnector({ network: "testnet", autoConnect: false });
  const wallet = await connector.connect();
  const accounts = await wallet.getAccounts({ network: "testnet" });
  if (!accounts.length)
    throw Error("The wallet did not return a testnet account.");
  return accounts[0].accountId;
}
export async function disconnectTestnet() {
  await connector?.disconnect();
}
export async function contractView<T>(
  config: ChainConfig,
  method: string,
  args: Record<string, unknown>,
): Promise<T> {
  if (!config.contractId)
    throw Error("The contract is not deployed/configured yet.");
  const response = await fetch(config.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "aftermarket-view",
      method: "query",
      params: {
        request_type: "call_function",
        finality: "final",
        account_id: config.contractId,
        method_name: method,
        args_base64: btoa(unescape(encodeURIComponent(JSON.stringify(args)))),
      },
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw Error("Testnet RPC is unavailable.");
  const data = await response.json();
  if (data.error)
    throw Error(
      data.error.cause?.name ?? data.error.message ?? "Contract query failed.",
    );
  return JSON.parse(
    new TextDecoder().decode(new Uint8Array(data.result.result)),
  ) as T;
}
