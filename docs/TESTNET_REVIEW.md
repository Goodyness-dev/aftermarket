# Approved testnet deployment — completed

Deployed account: **aftermarket-f33ee39d.testnet**. The user approved the proposed deployment on 2026-11-14. All 27 deployment/seeding transactions are confirmed. An independent read-only check verified the deployed code hash, seven account keys, five credit balances, four spending caps, unique weapon ownership and pilot supplies. Owner allocation including contract storage, child funding and fees was approximately **5.6975 testnet NEAR**, below the approved limit of 8. The faucet supplied 10 free testnet NEAR; no mainnet funds were used.

See [confirmed receipts](TESTNET_DEPLOYED.json), [independent verification](TESTNET_VERIFIED.json) and the [contract explorer](https://testnet.nearblocks.io/address/aftermarket-f33ee39d.testnet). The original proposal in TESTNET_DEPLOYMENT.json remains unchanged as the approval record. Its original RPC endpoint deprecated itself during execution; the remaining steps and verification used `https://test.rpc.fastnear.com`, listed in the [official RPC provider documentation](https://docs.near.org/api/rpc/providers). Completed transactions were not replayed.

The exact public keys, account roles, WASM hash and intended operations are in [TESTNET_DEPLOYMENT.json](TESTNET_DEPLOYMENT.json). Preparation is reproducible with `npm run contract:build` then `npm run testnet:prepare`; an existing plan is preserved, not overwritten. The preparation command is entirely offline.

## What approval covers

- Request free testnet funds for the proposed owner/contract account.
- Create operator, Mara, Ivo, Sable, Harbor and pilot child accounts, each with 0.15 testnet NEAR.
- Deploy the pinned 471,212-byte contract and initialize it atomically with the proposed owner and operator.
- Register/prepay 0.05 testnet NEAR storage credit per account, seed the stated game balances and two unique weapons, and delegate the four NPC spending caps.
- Verify confirmed state and record transaction hashes before enabling the ledger's contract reads.

Use at most **8 testnet NEAR** for storage, account funding and transaction fees. Stop if the faucet is unavailable or funding is inadequate. No purchases, bridges, mainnet transactions, public repository publication or hackathon submission are covered.

SHA-256 of reviewed WASM:

```
88c49c667165b2718999f9820af52c506d6af24c9a3a16f02379f9233557136f
```

Recheck this hash immediately before deployment. A changed binary requires a revised review. Refuse an existing account with an unexpected access key or code. Deploy plus `new` must be one transaction; do not leave a publicly uninitialized contract. Check every transaction outcome before continuing. After an ambiguous timeout, inspect chain state before any retry; credit minting must never be blindly repeated.

## Key handling and trust

Seven new Ed25519 keypairs are stored outside the repository at `C:\Users\DELL\.near-credentials\testnet\aftermarket-f33ee39d.testnet\`. Windows access on this directory is restricted to the current user and SYSTEM. The plan contains public keys only. Never copy these files into the game, browser, client environment or repository. These accounts are testnet-only and must not be reused on mainnet.

The owner retains upgrade authority. The separate operator may issue game tokens, authorize loot and settle raids; NPC spending also requires an explicit remaining budget and sufficient balance. All demo keys remain on this PC, so this is not independent NPC custody or trustless combat verification. Game credits have no redemption promise.

## Contract and game status

The Rust contract implements unique weapon and stack balances, NEP-245 core transfer/view methods and receiver callbacks, prepaid storage accounting, atomic weapon listings, bounded delegated NPC purchasing, raid reservations, operator settlement and expiry. Approval extensions and a full NEP-145 storage interface are not implemented. It has compiled for WASM, passed 10 host unit tests, and completed deployment/seeding verification. A deployed full trade/raid lifecycle test remains outstanding.

The browser game remains a private, local SQLite practice world. Connecting a testnet wallet is not server authentication and does not migrate local weapons. The ledger panel now defaults to the verified deployment and can read confirmed ownership of `DP-0042` and `R-042`. A durable bridge linking authenticated player commands, on-chain reservations, NPC purchases and confirmed raid settlements is still required before describing the playable game as on-chain.

Repeat initial-seed verification with `npm run testnet:verify` (read-only, no keys loaded). It checks the initial seeded values and will intentionally fail after legitimate trades change them. Next perform and record a complete listing → NPC purchase → raid reservation → recovery settlement cycle with confirmed receipts before connecting the gameplay bridge. The deployment runner stops on unresolved transaction outcomes and records confirmed steps in `data/deployment/transactions.json`; never erase that journal to retry a deployment.

The local [HACKATHON.md](../HACKATHON.md), under “Never without the human's explicit confirmation,” says: “Sign transactions, spend tokens or deploy to mainnet.” Approval is requested because the deployment includes signing testnet transactions and spending testnet tokens.

Reference APIs: [NEAR API documentation](https://docs.near.org/tools/near-api), [official account helper](https://github.com/near/near-contract-helper). The installed SDK's declarations were checked for the current Account, signer and action APIs.
