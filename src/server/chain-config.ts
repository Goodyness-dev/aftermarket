import { readFileSync } from "node:fs";

// Only a successful, independently verified deployment enables the default
// read-only ledger. No credentials or signing client enter the web server.
export function chainConfig() {
  let verifiedContract: string | null = null;
  try {
    const verified = JSON.parse(
      readFileSync(
        new URL("../../docs/TESTNET_VERIFIED.json", import.meta.url),
        "utf8",
      ),
    );
    if (
      verified.status === "verified" &&
      verified.network === "testnet" &&
      verified.contractId === "aftermarket-f33ee39d.testnet" &&
      verified.wasmSha256 ===
        "88c49c667165b2718999f9820af52c506d6af24c9a3a16f02379f9233557136f"
    )
      verifiedContract = verified.contractId;
  } catch {
    // A checkout without a verification record remains local practice.
  }
  const requested = process.env.NEAR_CONTRACT_ID ?? verifiedContract;
  return {
    network: "testnet" as const,
    contractId: requested?.endsWith(".testnet") ? requested : null,
    rpcUrl: process.env.NEAR_RPC_URL ?? "https://test.rpc.fastnear.com",
  };
}
