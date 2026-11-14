# AFTERMARKET

Working title, subject to the team's choice. Original game concept and implementation blueprint. This document describes proposed behavior; it is not a claim that the game has been implemented.

Visual direction: see [VISUAL_DIRECTION.md](VISUAL_DIRECTION.md). The selected presentation is now grounded modern third-person 3D in a coastal port district. This supersedes the earlier top-down art proposal while retaining the compact raid and economy design.

## The promise

A tactical extraction shooter where every recovered weapon can become your next upgrade, another player's purchase, or an NPC faction's next shipment. You survive raids and build a weapons business in a city whose conflicts consume the things you sell.

Signature moment: sell a recovered, serial-numbered rifle to a dealer; the dealer supplies an NPC squad; encounter that same rifle on a soldier in a later raid. Recover it and see its ownership history. Equipment circulates through an economy the player can see and influence.

Pitch: Fight for your inventory. Trade to shape the next battlefield.

## Design influences

| Reference | Principle we adapt | Our implementation |
| --- | --- | --- |
| Escape from Tarkov | Equipment risk, persistent stash, NPC dealers and player listings | Each raid has a visible loadout cost and potential orders to fulfill; successful extraction settles recovered property. |
| ZERO Sievert | Compact raids, a readable combat loop, and a trading hub | Adapt the compact structure to third-person 3D with a small, detailed modern district; see VISUAL_DIRECTION.md. |
| Arena Breakout | The loot, extract, trade cycle and weapon customization | Quick sell, comparison of bids, saved loadouts, and previews of upgrade and replacement costs. |
| S.T.A.L.K.E.R.: Call of Pripyat | Trading, repair, equipment modification | A gunsmith business buys worn guns and parts, quotes repair work, and sells refurbished equipment. |
| The Forever Winter | NPC groups pursue objectives and fight each other | Supply and scavenger squads have missions, carry actual gear, and can be observed, intercepted, or protected. |
| Hunt: Showdown | Bounties and the cost of losing equipment | Optional bounty objectives create a reason to risk staying longer; losing carried equipment changes the next loadout. |

These are design influences, not a claim that the reference games implement our NPC budgets or item circulation. Use original art, maps, names, and fiction.

## What the player does

The player is a scavenger and independent weapons supplier operating from a neutral depot. Two competing factions buy supplies there. The depot contains a stash, three named merchants, player listings, a contract board, and a workshop.

1. Inspect today's shortages and funded contracts. Choose a target: recover pistols, retrieve ammunition supplies, protect a shipment, or pursue a bounty.
2. Equip a loadout. See replacement cost, ammunition, carrying capacity, and the item categories needed for the selected contract.
3. Enter a 4–6 minute raid. Scout, shoot, loot, and decide whether additional profit is worth the risk. NPC squads also collect supplies and move toward their own objectives.
4. Extract. Choose which guns to keep, sell immediately, repair, dismantle, or list at a chosen price. Inspect a receipt with ammunition spent, repairs, proceeds, and net change in inventory value.
5. Merchants spend their proceeds, consume parts, fulfill faction orders, and adjust their bids. Those purchases affect later squad equipment.
6. Pick the next opportunity created by the changed economy.

Every 30 seconds: choose cover, target, loot, route, or whether to withdraw. Every five minutes: complete a raid and make a consequential inventory decision. Every session: progress toward a business specialization and see a prior sale influence the world.

## Combat foundation

- Three initial weapon families: pistol (cheap, economical), SMG (mobile, ammunition hungry), rifle (range and accuracy, larger replacement cost). Each must have a viable role; expensive gear should not guarantee victory.
- Readable cover, clear enemy telegraphs, deliberate reloads, ammunition limits, and distinct hit feedback. Good movement and aiming must remain rewarding even with the cheapest weapon.
- One industrial district with a warehouse, workshop, freight yard, and two extraction points. Shuffle patrol routes, supply objectives, and containers between runs while keeping landmarks learnable.
- NPC behavior begins with patrol, investigate sound, engage, take cover, retreat, loot, and extract. Carriers prioritize their delivery; scavengers avoid costly fights; guards protect a valuable shipment.
- Carry weight and limited slots make loot selection meaningful. A damaged rifle may be worth less per slot than the scarce parts needed to repair it.
- Preview the run's loss rules. Normal raids lose carried property on death. Uncollected equipment enters a bounded salvage process or is destroyed; it cannot be duplicated into both a refund and enemy loot.
- Provide a basic starter kit and practice runs so defeat never prevents playing. Loaned recovery equipment cannot be sold, dismantled, transferred, or used to generate guaranteed value through an alternate account.

## The larger economy

### Three businesses

| Merchant | Business | What changes their decisions |
| --- | --- | --- |
| Mara, the broker | Buys extracted guns; sells to players and faction quartermasters | Available money, stock age, recent sales, funded faction demand |
| Ivo, the gunsmith | Repairs and refurbishes guns; buys worn equipment and salvage | Parts, workshop capacity, repair backlog, required margin |
| Sable, the supplier | Buys and sells ammunition and consumables; arranges deliveries | Reserves, route danger, delivery success, recent consumption |

Each has a separate NEAR account and tracked balances, inventory, reserved funds, liabilities, and a small set of rules. They cannot buy with money they do not have. Orders reserve both goods and payment as appropriate. Insufficient cash pauses purchases; insufficient parts pauses production. A business can post a funded procurement contract or sell excess stock to recover. Do not silently refill its wallet.

Show explanations such as: "Buying rifle parts above yesterday's price: 2 left, 6 repairs waiting." The explanation must be generated from the same values used for the quote. LLM dialogue is optional flavor; deterministic policies and contract checks enforce spending and settlement.

### Six decisions for recovered equipment

1. Use it in the next raid.
2. Accept an immediate NPC bid.
3. Place an escrowed player listing with a chosen price and expiry.
4. Pay for repair and then keep or sell it.
5. Dismantle it into fewer, useful materials.
6. Deliver it against a funded supply contract.

The interface compares net proceeds, fees, repair cost, and waiting time. Listing an item does not guarantee a buyer. NPCs may fill qualifying listings within budget, so the prototype does not depend on a large player population.

### Price formation

Version one uses transparent rules, integer arithmetic, and bounded changes. A reference price is only a starting point. Desired stock, recent net consumption, outstanding funded orders, condition, and available cash determine quotes. Player listing prices are chosen by their sellers.

Suggested model for tuning: reference value × condition factor × bounded scarcity factor × bounded demand factor. Dealer sell quotes include a spread over their buy quotes. Display the resulting quantity-specific quote with expiry and a maximum accepted total; revalidate it at settlement. A large order walks through available stock and price levels, rather than buying unlimited units at one favorable price.

Repair quotes must account for materials and labor. Dismantling yields less than the replacement recipe requires. Tests must search for profitable buy-repair-sell and buy-dismantle-craft loops that generate unlimited currency without consuming scarce inputs or time. Cross-market arbitrage can be legitimate when constrained by stock, logistics, and risk.

### Supply, demand, and destruction

Supply: bounded scavenging yields, salvage, workshop production, and explicit scheduled shipments. A new weapon gets an authorized origin record. Supply cannot appear simply because a browser requests it.

Demand: player loadouts, funded faction procurement, repairs, and contract fulfillment. Faction budgets draw from explicit treasury allocations and simulated territory income; any issuance has a recorded source and cap. Keep the first season's treasuries pre-funded and transfers auditable.

Consumption: ammunition fired, parts consumed in repairs, and materials consumed by production. Currency fees either burn or move to a named treasury; display which. A transfer between participants is not a currency sink. A dropped gun is not destroyed unless the salvage rules actually remove it.

Healthy circulation needs destruction and fresh bounded supply. Otherwise inventories grow forever or one faction eventually owns everything. Track money supply, item supply, consumption, merchant solvency, and stock concentration across long simulations before tuning prices.

## The signature circulation mechanic

Every durable gun has an identity, model, condition, fitted components, current owner, and compact provenance. Stackable resources use shared token types; individual guns use unique token IDs with supply one.

Example proposed event chain:

1. The player extracts rifle R-042 and sells it to Mara for 180 credits.
2. Mara has an outstanding order from a faction and sells the rifle for 230 credits.
3. That faction assigns R-042 to its next supply guard. Inventory is reserved before the raid begins.
4. The player sees a subtle "Previously traded" mark when inspecting it after defeating the guard.
5. Extraction transfers the gun to its new owner and updates its history. Death or disconnect follows an explicit recovery rule, preserving a single owner.

These numbers illustrate the mechanic; they are not balance targets. Production must use real validated transfers. Do not fake the ownership history with UI-only entries.

## Reasons to return

- Changing opportunity: visible shortages, completed shipments, player listings, and faction contracts create a new decision each session.
- Identity: specialize as a salvage runner, gunsmith, dealer, or faction supplier. Unlock workbench options, reputation, and useful information rather than stacking permanent damage advantages.
- Personal history: favorite guns accumulate a traceable history. Merchants remember completed orders through reputation and offer appropriate work.
- World consequences: supplies affect equipment availability and which routes a faction can guard. Limit snowballing with upkeep, contested logistics, and demand from multiple buyers.
- Mastery: learn routes, weapon handling, and the economics of profitable runs.
- Recovery: affordable kits and attainable objectives let players recover from losses. Do not confiscate a player's stash for being offline or require a daily login streak.
- Longer term: seasons can introduce a different supply scenario while preserving earned cosmetics and historical records. Decide any competitive reset policy explicitly before release.

An endless loop means repeatable meaningful choices, not unlimited content on day one. If combat or trading feels repetitive after five runs, more currencies will not solve that problem.

## Hackathon build: the smallest convincing version

Must ship: one map; three gun families; responsive third-person 3D combat; enemy patrol and combat; extraction and loss; persistent inventory; three NPC businesses; buy/sell and repair; limited stock and cash; visible quote reasons; two funded faction orders; one player listing flow; one gun that completes the sale-to-faction-to-raid circulation; verified NEAR ownership and settlement.

Target a single-player PvE raid experience connected to a shared market. Keep the first demo's world small and explicit. Networked PvP, huge maps, complex weapon attachments, loans, insurance, property speculation, and a player-run exchange are later work. Multiple anonymous real-time clients and valuable persistent assets require server authority; never claim client-only loot is secure ownership.

If scope must shrink, simplify graphics and reduce weapon variants before dropping the signature ownership loop or responsive combat. If social login credentials are unavailable, present the functioning wallet flow honestly and list social onboarding as unfinished.

## NEAR integration and trust boundary

- NEP-245 represents unique guns and stackable materials. State clearly which core and optional interfaces are implemented; include transfer, callback/refund behavior where applicable, and standard events. Persistent weapon condition cannot be trusted to arbitrary client updates.
- A game settlement contract validates listings, balances, item ownership, payment, and authorized raid results. A single transaction should settle both sides of an internal item/credit trade or fail. Protect quotes against replay and stale state.
- Combat runs outside the chain. An authoritative service validates the raid and signs a bounded, expiring result with a unique raid ID. The contract accepts each result once. This service is a disclosed trust dependency; blockchain ownership does not make combat trustless.
- NPC policy services use narrowly scoped permissions and contract-enforced budgets. Function-call key gas allowance is not a token spending limit. NEP-245 methods requiring a one-yocto deposit cannot be called directly by zero-deposit function-call keys; design the authorized game settlement flow accordingly.
- Email/social onboarding and gas sponsorship make ordinary play smooth. Account recovery, session signing, and actual provider access must be tested before claiming frictionless login.
- Start on testnet with an explicitly in-game credit balance. No promised redemption value. NEAR Intents can later fund or withdraw a supported settlement asset; arbitrary game guns are not presumed to be supported by 1Click. A quote preview is not a completed integration or a testnet swap.
- Use an optional asset-history panel to show actual account IDs and transaction receipts. Keep normal gameplay language focused on inventory, purchases, and contracts.

## Judge demonstration

A 3–4 minute reproducible scenario, with a resettable practice world separate from persistent player assets:

1. Show a supplier's depleted rifle-ammo stock and the reason for a high quote.
2. Equip an inexpensive kit, choose a funded recovery contract, and play a short raid.
3. Extract parts and a uniquely identified rifle. Complete a real trade and display the receipt.
4. Have the gunsmith consume parts and complete a repair; show the inventory and budget changes.
5. Show the broker fulfill a faction order with the recovered rifle.
6. Start the next encounter and identify that rifle on its new holder.
7. Show a compressed economy simulation exposing shortages, filled orders, price changes, and business cash. Label replay/simulation and live settlement accurately.

The demo's claim: player combat produces supply; NPC businesses spend and transform it; their economic choices affect later combat. This must work without manual database edits between steps.

## Acceptance gates

- A new player can shoot, loot, and extract without a tutorial lecture; the first meaningful buy/sell choice happens within the opening minutes.
- A five-run playtest produces at least three distinct economic decisions, rather than always selling everything to the same dealer.
- Flooding a category lowers bids or exhausts purchasing capacity. Consuming stock raises scarcity until replenishment arrives. No balance becomes negative.
- Listings reserve property; simultaneous fills cannot duplicate it; cancellation returns only unsold inventory; expired quotes fail before payment changes.
- Retry, disconnect, and repeated raid submission cannot duplicate loot or credit. All minting and burning has an authorized cause.
- Identical initial state and event sequence reproduce economic results. Long-run simulations reveal dead markets, unbounded inflation, and runaway faction dominance.
- Contract balances, UI inventory, item history, and actual transaction receipts agree. Local simulations are identified as such.

## Build sequence

1. Make one complete local raid with satisfying movement, aiming, enemies, loot, and extraction.
2. Connect the stash and three businesses; tune five runs before extending content.
3. Implement authoritative outcomes, NEP-245 assets, settlement, listings, and NPC budget enforcement; verify in sandbox and testnet.
4. Connect faction demand and the unique weapon circulation scenario.
5. Complete onboarding, receipt display, sound, map clarity, and the judge walkthrough.
6. Recheck live hackathon requirements; prepare reproducible README, demo recording, and the final submission payload with the user.

## Reference material

- Escape from Tarkov: https://store.steampowered.com/app/3932890/Escape_from_Tarkov/
- ZERO Sievert: https://store.steampowered.com/app/1782120/ZERO_Sievert/
- Arena Breakout official loot/trade tutorial: https://www.youtube.com/watch?v=9u9rLj_sLAY
- Arena Breakout Infinite: https://www.arenabreakoutinfinite.com/en/
- S.T.A.L.K.E.R. manual available from: https://store.steampowered.com/app/41700/STALKER_Call_of_Pripyat/
- The Forever Winter: https://store.steampowered.com/app/2828860/The_Forever_Winter/
- Hunt: https://www.huntshowdown.com/player-guide/en_US
- Games track: https://github.com/nearai/near-hackathon-prompt-examples/blob/main/tracks/09-games.md
- Live rules: https://nearhackathon.com/HACKATHON.md
- NEP-245: https://github.com/near/NEPs/blob/master/neps/nep-0245.md
- Access keys: https://docs.near.org/protocol/accounts-contracts/access-keys
- Social onboarding: https://docs.near.org/web3-apps/tutorials/near-auth
- Relayers: https://docs.near.org/web3-apps/tutorials/meta-transactions
- Intents: https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/making-a-request
