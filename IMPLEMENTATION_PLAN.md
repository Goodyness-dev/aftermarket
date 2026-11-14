# AFTERMARKET — Implementation Plan

Prepared from MASTER_GAME_DESIGN.md and VISUAL_DIRECTION.md, read in full. Status: proposed execution plan; no game implementation exists in this workspace yet.

## 1. Delivery decision

Build a desktop browser third-person 3D game with one compact raid district and a persistent market. Prove two things early: the port can look convincing in the actual runtime, and one unique gun can complete the player-to-dealer-to-faction-to-player journey without duplication.

Recommended implementation for this workspace: TypeScript, Vite, Babylon.js for 3D, React for menus, a Node.js authoritative service, PostgreSQL for durable operational state, and Rust contracts on NEAR testnet for assets and settlement. Use shared TypeScript schemas and economy rules. Keep the render loop outside React.

Why this recommendation: Node.js is available; no Unreal directory was found at the standard Epic Games installation path, and cargo was not found on PATH. Babylon documents PBR, animation, glTF, browser rendering, and character-controller support. This makes a shareable, code-driven build practical. These observations do not establish the machine's GPU capability or rule out software installed elsewhere; hardware probing has not produced usable results.

There is a real fidelity tradeoff. If native, near-photoreal presentation is the overriding requirement and sufficient development time, a suitable workstation, and coherent licensed assets are available, Unreal is the stronger alternative to evaluate before asset production. Do not promise a browser build will match GTA VI. Use a runtime lighting test as the visual decision gate; if it fails expectations, revise scope or switch runtime before building the full scene. Do not build two clients simultaneously.

## 2. Deadline and scope

The live hackathon instructions checked for this plan give 14 November 2026 at 23:59 UTC as the deadline: 15 November at 00:59 in Lagos. With the client date at 13 November, this is a compressed submission window. The full master design is larger than a credible from-scratch build in that window. Treat the stages below as dependency gates, not a promise that every stage fits before submission.

Minimum convincing submission: one small detailed combat area, one hub counter, one complete raid, three weapon families with simple parameters, three functional dealer policies, a repair action, a funded faction order, one listing flow, and actual testnet ownership/settlement for the unique-gun cycle. Represent secondary merchants through simpler counters if needed. Prefer reducing area and asset count over replacing real settlement with a fake receipt.

The broader game adds richer animation, more routes, more economic contracts, and progression after that cycle works. Social onboarding remains a named dependency on provider access; normal wallet login is an honest fallback. Intents is a later integration unless the mandatory loop is already complete.

## 3. Architecture and ownership

| Component | Responsibility | Authority |
| --- | --- | --- |
| Browser 3D client | Input, camera, animation, sound, interpolation, inventory presentation | Proposes actions; cannot award itself property |
| React overlay | Stash, market, workshop, contracts, pending states, settings | Displays authoritative data |
| Shared domain package | Item schemas, quote math, recipes, NPC policy, deterministic simulation | Rules reused by server and tests; contract independently enforces safety |
| Node game service | Raid simulation, sessions, NPC combat, action validation, extraction outcomes | Trusted gameplay adjudicator, explicitly disclosed |
| Economy worker | Budgeted procurement, repair completion, faction orders, market notifications | Submits allowed operations; cannot bypass contract limits |
| PostgreSQL | Sessions, raid checkpoints, idempotency, operational queues, indexed events | Authoritative for gameplay records; chain remains authoritative for settled property |
| NEAR contract | Asset balances, unique gun ownership, credits, reservations, listings, atomic settlement, receipts/events | Authoritative for settled property |

Use one settlement contract containing the asset ledger and market logic initially. This permits atomic internal movement of goods and credits. It does not remove NEP-245 public interface requirements or the need to test standard transfer callbacks. Keep native NEAR or external settlement assets out of the initial in-game-credit trade path.

Chain writes happen at economic boundaries, not per shot or frame. Session signing and gas sponsorship must use an actual supported provider flow. Every screen distinguishes submitted, confirmed, and failed operations.

## 4. State model and transaction lifecycle

Core records: player, account, item definition, unique weapon instance, stack balance, merchant, quote, listing, funded order, repair job, faction reservation, raid session, raid result, and settlement event.

Each unique weapon has one stable token ID, one owner, condition, model, allowed modifications, and a reservation state. Store compact current state on-chain; build the readable ownership timeline from indexed events. Credits and quantities use integer units; API serialization uses decimal strings. Never use floating-point money.

Weapon states: available -> reserved for listing/repair/raid -> settled to a new owner or released. Reservations must prevent direct transfer, repair, and listing of an item already committed elsewhere. Decide the authorized custody approach before implementing the public token methods; an application-only database flag is insufficient.

Raid lifecycle:

1. Authenticate the account and request a raid with an owned loadout.
2. Reserve the loadout and faction equipment on-chain; only start after confirmation. The server creates a unique session and known world inventory.
3. The client sends sequenced inputs. The server validates movement, cooldowns, ammunition, damage, loot proximity, and extraction timing. Visual prediction never decides ownership.
4. The server finalizes a bounded outcome exactly once. The initial implementation uses an authorized server account to call settlement with raid ID, result, and deadline. A portable signed-result format can follow when necessary; do not build both authorization paths without a need.
5. The contract checks permission, reservation, replay protection, permitted item origins, and allowed transitions. It applies the outcome or changes nothing.
6. An event consumer updates the indexed view. Retried requests reuse IDs; a durable outbox retries pending submissions. The UI reconciles against confirmed contract state after reload.

Before release, specify timeout behavior for disconnect, server crash, settlement failure, and an abandoned raid. A timeout cannot unlock equipment while a late result can still consume it. Server simulation must stop using expired sessions; the contract must reject expired results. Practice worlds have separate assets and reset authority.

## 5. Build gates

### Gate A — Runtime and visual proof

Deliver a working 3D build with shoulder camera, camera collision, a rigged character, one animated gun, PBR materials, dusk lighting, and one detailed counter beside a combat lane. Load genuine GLB assets, not screenshot planes masquerading as a 3D scene.

Inventory the hardware and asset access. Lock dependency versions after a smoke test. Start an asset register immediately. Validate character skeleton compatibility, gun-to-hand attachment, animation transitions, texture sizes, and collision scale before buying or downloading large packs.

Pass: move and aim around cover without camera clipping; inspect a convincingly lit weapon; capture an in-engine screenshot; record frame times on named hardware. Compare this scene with the visual brief. Target 1080p/60 on suitable hardware and a 720p/30 low setting, but report measured results honestly.

### Gate B — One complete raid

Build a greybox district with one warehouse lane, a flank, two extraction points, a patrol, and a loot container. Implement movement, aim, fire, reload, damage, death, loot, extraction, and a return to the stash. Add the pistol first, then parameterize SMG and rifle differences.

Use simple hitscan weapons initially. Aim from the camera to select a target point, then test muzzle-to-target obstruction so players cannot shoot through nearby cover. Implement server-owned enemies and damage. Start enemy states at patrol, investigate, engage, retreat, and dead; add looting and shipment behavior only after combat works.

Pass: a new player completes a run, sees ammunition costs and recovered loot, and can start again. Shooting, cover, and extraction work without relying on camera tricks or scripted footage.

### Gate C — Market and NPC businesses

Implement quote math in one readable rules file, using stock, available cash, condition, recent demand, and funded orders. Start with buy, sell, repair, and listing/cancellation. Add dismantling after conservation tests exist. Generate quote explanations from actual terms.

Mara buys and fulfills faction orders. Ivo consumes parts to repair guns. Sable manages ammo supply and procurement. Each has a separate account, spendable balance, reserved obligations, and bounded inventory. Process deterministic ticks in stable order. Persist tick IDs to prevent repeated production or order payment after worker restart.

Pass: flooding rifles reduces bids or exhausts cash; a parts shortage blocks repair; replenishment permits repair; an NPC can buy an affordable player listing. Prices and inventory must have visible consequences over five runs.

### Gate D — NEAR asset and market integration

Install or provision Rust and the required contract toolchain; prove a minimal sandbox build early enough to expose Windows/toolchain issues. Implement unique and stackable NEP-245 assets, in-game credits, events, reservations, listing escrow, buy/sell settlement, and funded orders. Document supported optional interfaces precisely.

Test standard transfer authorization, attached-deposit behavior, batch length validation, callback failure/refunds, replay protection, and storage accounting. Function-call key gas allowance is not a spend limit, and ordinary restricted keys cannot attach the deposit required by public token transfer methods. Use contract-enforced authorization for the game's zero-deposit operations; do not weaken standard transfer security to avoid a popup.

Pass: two accounts trade a gun against credits on testnet; receipt and ownership are verifiable; stale quotes, two simultaneous buyers, and retried settlements cannot spend or duplicate assets. Browser refresh shows the same confirmed balances.

### Gate E — The returning rifle

Connect a broker sale to faction procurement, reserve that exact rifle for a guard, spawn its correct visual model and identity, then recover and settle it through extraction. Add the previous-owner indication and short history panel. Replay the complete journey with fresh IDs rather than editing state.

Pass: the same token ID appears throughout; the broker and faction pay real in-game balances; the gun cannot simultaneously be listed, assigned, and looted in another raid. This is the primary judge demonstration.

### Gate F — Visual finish and onboarding

Replace greybox geometry progressively with the consistent port kit. Finish the Exchange's main counter and the shortest raid route first. Match materials and dusk lighting across both. Add merchant idle/work motions, spatial sounds, restrained impacts, settings, and accessible HUD contrast.

Drive shelving, repair trays, and delivery cases from confirmed state through a bounded visual mapping. Add social/email login and sponsored transactions if provider credentials and recovery flow are available. Validate the actual signing experience; provider login alone does not prove popup-free transactions.

Pass: actual playable arrival, trade, and returning-rifle moments look coherent, run responsively, and agree with economic state. Record real runtime footage.

### Gate G — Packaging and submission readiness

Create a production client build, persistent backend deployment configuration, migrations, health endpoint, and reproducible seeded practice scenario. A static frontend host cannot run the authoritative service or database. Keep server signing keys out of client bundles and logs.

Prepare README setup instructions, trust assumptions, implementation status, asset credits, verified contract ID/network, demo walkthrough, and known limitations. Collect required human submission details and prepare the exact payload. Follow HACKATHON.md for publication, push, mainnet, and submission confirmations. The user publishes the demo post.

## 6. Asset production checklist

Acquire or create: one rigged player; two faction appearances sharing a compatible skeleton; three merchant appearances; a pistol, SMG, and rifle; a small animation set; warehouse/container modules; counter/workbench props; crates/supplies; PBR texture sets; dusk environment lighting; original signs; licensed audio.

First import one complete sample of each risky asset category. Check the actual distribution license and attribution. Missing assets are explicit dependencies; realistic characters and animations do not emerge from procedural boxes or a concept image.

Use consistent human scale, texel density, material roughness, skeletons, and lighting. Budget detail near hands, guns, faces, and counters. Use a backdrop skyline, instancing, LODs, compressed textures, and restrained shadow casters. The first art review compares three runtime screenshots: hub, combat, inspection.

## 7. Proposed repository layout

```text
apps/client/          Babylon scene, input, animation, React overlays
apps/server/          Auth, authoritative raids, market API, event stream
packages/domain/      Schemas, item definitions, economy rules, NPC policies
packages/simulation/  Seeded economy scenarios and invariant checks
contracts/economy/    Rust NEP-245 ledger, market, reservations, settlement
assets/manifest.json  Paths, licenses, scale, texture and animation notes
tests/                Contract integration and complete-loop verification
docs/                 Architecture, API contract, deployment, demo script
```

Use a single backend process for the first deployment, with persisted jobs and clean internal modules. Scale workers separately only after observed load justifies it. The deployed database must support transactional operational updates and survive restarts.

## 8. Verification that matters

Economy invariants: no negative balances; money changes only from recorded transfers/issuance/burn; item supply changes only from permitted origins/recipes/destruction; repairs consume actual inputs; all quotes respect budgets and reserved obligations.

Concurrency and recovery: competing listing fills, duplicate input/result messages, reload during settlement, worker restart during production, disconnect during extraction, and timeout racing a late result. Reconcile chain events idempotently and treat chain state as final for settled property.

Gameplay and presentation: camera near walls, firing around cover, reload cancellation, extraction interruption, enemy visibility, input latency, animation timing, supported resolutions, low settings, and frame-time spikes under the maximum intended encounter.

Balance: run deterministic long simulations with varying supply and demand, then five human-playable raids. Examine dead merchants, excessive inflation, resource exhaustion, dominant weapon choices, faction snowballing, and whether selling everything is always optimal. Fast-forward simulation must remain labeled and isolated from persistent player property.

## 9. Immediate execution order

1. Establish the project skeleton and actual engine/toolchain smoke tests.
2. Acquire the smallest coherent asset sample and build the dusk counter/combat-lane test.
3. In the same initial milestone, prove a minimal asset transfer and settlement contract in sandbox; do not postpone discovering toolchain blockers until art is finished.
4. Complete a short authoritative raid, stash, and simple dealer trade end to end.
5. Add the real reservation/settlement lifecycle and the returning rifle.
6. Expand to all three dealer policies, listings, repairs, and differentiated guns; polish the completed route.
7. Freeze additions early enough to reproduce the judge walkthrough, package, record, and complete the user-controlled publication/submission steps.

Expected first reviewable result: a running third-person scene and a verified minimal settlement test, accompanied by measured performance and an explicit list of missing assets/provider dependencies. Completion of the full blueprint depends on these gates; no GTA-scale or competition outcome is guaranteed.

## Sources checked

Implementation checkpoint (2026-11-14): the local authoritative raid/trade loop and SQLite persistence are implemented, with 13 passing economy/API checks. Animated character assets, PBR maps, rifle inspection and synthesized audio are integrated, but the latest visual changes still need a complete playthrough and measured performance. The separate Rust contract builds to WASM and passes 10 host unit tests. After explicit user approval, it was deployed and seeded at `aftermarket-f33ee39d.testnet` with 27 confirmed transactions, seven accounts and independent verification of the reviewed code hash, balances, ownership and NPC spending caps. Owner allocation was approximately 5.6975 free testnet NEAR, below the approved cap of 8. The ledger panel defaults to this verified contract; see `docs/TESTNET_REVIEW.md`. Gameplay-to-chain settlement, the deployed trade/raid lifecycle test, shared markets, production authentication and authored world art remain outstanding. These results do not mark the later gates complete.

- Master design: MASTER_GAME_DESIGN.md
- Art direction: VISUAL_DIRECTION.md
- Babylon capabilities: https://www.babylonjs.com/specifications/
- Babylon character controller: https://doc.babylonjs.com/features/featuresDeepDive/physics/characterController/
- Unreal hardware guidance: https://dev.epicgames.com/documentation/en-us/unreal-engine/hardware-and-software-specifications-for-unreal-engine
- Live hackathon rules/deadline: https://nearhackathon.com/HACKATHON.md
