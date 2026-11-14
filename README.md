# AFTERMARKET

A third-person extraction shooter prototype with a persistent local weapons economy. Recover guns, trade with budgeted merchants, repair equipment, list your own offers, and encounter faction guards carrying weapons purchased from the market.

## Run

Public source: [Goodyness-dev/aftermarket](https://github.com/Goodyness-dev/aftermarket). The repository includes Railway/Docker deployment configuration and an Oracle Always Free VM setup. Cloud practice hosting needs an eligible account, available compute and a verified deployment; no permanent hosted URL is claimed yet. See [hosting details](docs/HOSTING.md).

Requires Node.js 24 or newer (uses the bundled `node:sqlite` module).

```sh
npm install
npm run dev
```

Open http://localhost:3000. The game binds to loopback only. Local saves live in `data/aftermarket.db`, outside source control. The opaque HttpOnly browser cookie identifies a practice save. This is not production account authentication.

```sh
npm test
npm run build
```

For a local production preview set `NODE_ENV=production` before `npm start`. The Node service is required; serving only `dist/` will not provide raids or saves.

## Play

Enter Duskport, select your pistol, and deploy. Click the scene to capture the mouse; WASD moves, mouse aims, click fires, R reloads, E recovers nearby loot, and Escape releases the cursor. Recover the shipment rifle near the central lane. Reach either green extraction pad and stand there for three seconds. Extraction opens after the first eight seconds of a raid. Losing a raid loses carried equipment, not the depot stash.

At the Exchange, compare dealer quotes and sell recovered equipment. Advance a market shift to process affordable player listings and funded faction procurement. Faction-owned rifles are assigned to guards in the next raid. Recover the same gun and inspect its history in the ledger. Your practice world is private to your save; this version is not a shared multiplayer market.

## Implemented

- Babylon.js 3D port district with dusk image-based lighting, local PBR maps, shoulder camera, and an imported skinned walking character.
- Animated soldier characters, weapon inspection with a rotatable rifle model, synthesized combat audio and local fonts.
- Server-controlled movement, combat, ammunition, enemy patrols, loot, raid reservations, death and extraction.
- Three weapon families, persistent stash, three dealers, stock/cash-sensitive quotes, repairs, dismantling, ammunition purchases, player listings/cancellation, faction orders and weapon history.
- Durable SQLite saves and idempotent HTTP commands. Client cannot report kills, set cash, teleport, or declare a successful extraction.
- Tests covering trade conservation, listing locks, price validation, repairs, replayed extraction, weapon circulation, movement collision, ammo conservation, budget exhaustion, and recovery-kit restrictions.
- HTTP/WebSocket integration checks covering duplicate commands, reservation locks, invalid client claims and persistence across server restart.
- A separate Rust economy contract with unique weapons, stack balances, listings, NPC spending caps, raid custody/settlement and receiver-refund handling; 10 host unit tests and a successful WASM build.
- A testnet wallet connection and read-only contract inspection panel, configured for the verified [testnet deployment](https://testnet.nearblocks.io/address/aftermarket-f33ee39d.testnet). Read `R-042` to see Harbor's unique rifle. See [deployment details and trust assumptions](docs/TESTNET_REVIEW.md).

## Current limits / honest status

The game has two modes. Private practice settles generated inventory locally. The optional loopback-only custodial testnet pilot settles registered weapon ownership, credit payments, listings, delegated NPC purchases and raid reservations/results at `aftermarket-f33ee39d.testnet`. The returning-rifle loop passed with 10 confirmed transactions, unique supply one and conserved credit supply 8,420; see [loop evidence](docs/TESTNET_LOOP_VERIFIED.json). A compiled production HTTP check verified a real ammunition payment, command idempotency and rejection of forged rewards; see [API evidence](docs/PRODUCTION_API_VERIFIED.json). Combat, ammunition quantities, salvage and condition remain server-simulated. The pilot is a shared local demo account whose keys stay on this PC; wallet connection does not authenticate it. Production player authentication, social login, gas sponsorship and NEAR Intents are not integrated.

Follow [the demo runbook](docs/DEMO_RUNBOOK.md) to enable the testnet pilot, and [hosting instructions](docs/HOSTING.md) for the persistent Node service. The testnet loop is scripted integration evidence, not recorded human gameplay. Public practice hosting must keep the custodial signing mode disabled.

The scene is a prototype: player and guards use an animated Quaternius soldier, the inspection rifle is an imported model, and most environment geometry and held weapons are procedural. The latest character and inspection changes still need a complete visual playthrough. No GTA-level fidelity or measured 60 FPS claim is made. Gameplay uses a flat-ground simulation with line-of-sight checks and simple patrol AI; production anti-cheat and network latency handling need further development. Supply is bounded per generated raid, not a fully closed global economy. The recovery contract has a one-time practice reward.

Build and test the separate contract with `npm run contract:build` and `npm run contract:test`. Install Rust stable and its `wasm32-unknown-unknown` target first; Windows host tests also require the MSVC C++ build tools. The helper script uses the dependency's official prebuilt NASM objects. `npm run testnet:verify` checks current ownership and conserved supplies without loading credentials or signing. Its optional `--initial-seed` flag checks historical seed values and is expected to fail after trades. The server enables default contract reads only when its verified deployment record is present. See the review document before any mutating network operation.

Engine/renderer: Babylon.js. UI: React. Backend: Express/WebSocket on Node. Save storage: SQLite, used instead of the planned PostgreSQL service for a self-contained local milestone. Local worlds isolate players; a shared market and production authentication need a subsequent architecture pass.

## Sources and rights

See [asset credits](docs/ASSET_CREDITS.md) and [asset manifest](assets/manifest.json) for licenses and creator attribution. The animation and material sources are third-party baseline assets; gameplay and economy code were created for this project with AI assistance. No earlier application code was present in the workspace.

Source code is licensed under MIT; assets and dependencies retain their own licenses. `npm run release:review` prepares a file-hash manifest and a limited credential-literal scan for publication review, excluding saves, dependencies, private environment files and build outputs. It does not publish anything.

Design references are in MASTER_GAME_DESIGN.md and VISUAL_DIRECTION.md. Execution milestones are in IMPLEMENTATION_PLAN.md. The repository was published with user approval. No hackathon application has been sent.
