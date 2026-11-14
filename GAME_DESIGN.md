# Games With Real Economies: game loop and technical plan

> Superseded by [MASTER_GAME_DESIGN.md](MASTER_GAME_DESIGN.md). The chosen direction is now a shooting game with a persistent weapons economy. The market-town proposal below is retained as design history.

Status: design proposal, 13 November 2026. The project name and final scope remain the team's decision.

## Player promise

Run a stall in a small frontier town. Gather scarce materials, fulfill town orders, and trade with merchants whose prices, stock, and solvency change because of player activity. The player's decisions should alter the next play session: a flood of iron makes iron cheap; a shortage of wood stalls tools; a bankrupt merchant closes until players recapitalize it.

The main screen should speak in game terms (stock, orders, prices, reputation). Wallets and transactions are visible in an optional details panel.

## Loop on paper

| Cadence | Player action | Immediate feedback | Economic consequence |
| --- | --- | --- | --- |
| Every 30 seconds | Choose a gathering job, inspect merchant prices, accept or reject one offer, or list goods at a player stall. | Inventory, coins, order progress, and the merchant's short reason update. | Supply, demand, merchant cash, and price history move after each completed trade. |
| Every 5 minutes | Pick a production plan: sell raw ore now, use wood to make tools, fulfill a town order, or invest in a merchant. | A clear profit preview and a shortage warning. | Crafting consumes inputs; orders remove goods and create a coin sink; investment restores a merchant's buying capacity. |
| Each session | Set a stall strategy, revisit an earlier shortage, and compare town prices with the prior session. | A short town newspaper shows the largest price moves and closures. | Persistent owned inventory and player listings shape the next town state. |

The first 60 seconds should demonstrate one complete causal chain: gather iron, sell it to the smith, watch the smith's stock rise and iron bid fall, then see a tool offer become cheaper. The demo should later show the opposite chain under a wood shortage.

## Economy rules

- Start with three resources (iron, wood, grain), two crafted goods (tools, bread), three merchants (smith, carpenter, baker), and one shared coin unit. Every item class is a NEP-245 multi token on one contract.
- Merchants have their own NEAR accounts, token balances, and coin balances. Their transaction permissions are limited to the game contract and relevant methods. A merchant with insufficient coins cannot keep buying; a merchant without required inputs cannot craft.
- Price quotes derive from a public, deterministic rules file: base price, current stock versus target stock, recent buy/sell volume, and merchant cash. Clamp prices within stated bounds. Show the exact contributing terms in a tooltip.
- Gathering has limited daily capacity; crafting burns inputs; town orders and upkeep consume goods or coins. These sinks make scarcity possible. No open-ended faucet or arbitrary admin price edits during a live game.
- A trade must recheck stock, balance, and quoted price when executed. Expired quotes fail visibly. Guard against self-trading, unlimited agent spending, and unbounded state growth.
- Player stall listings reserve the listed goods. The seller receives payment only when a buyer fills an order. Cancellation returns unsold stock.
- The fast-forward view applies the same rules to seven days of scripted demand and trading in about one minute. Label simulation clearly unless each step is actually committed on-chain. It should show price, stock, and solvency curves, plus the events that caused changes.

## Chain boundary

1. NEP-245 holds transferable resources, crafted goods, and coin balances. Implement the core balance, supply, transfer, and batch methods; emit `nep245` mint, burn, and transfer events. Add metadata and owner enumeration if wallet and inventory display need them. Amounts are base-10 strings representing `u128` values.
2. Game logic owns gathering limits, recipes, merchant quotes, orders, listings, and atomic settlement. Keep price calculation readable and test it separately. A signed player action or restricted NPC action changes state; the UI can read state without signing.
3. Use email or social onboarding plus gas sponsorship for the seamless path. NEAR Auth supports Google, Apple, email, and passkeys, but its mainnet Auth0 client requires approval. Privy is a documented alternative and creates a NEAR wallet from social login. Pick one after checking access and SDK behavior; prototype against testnet.
4. NEAR Intents is for an optional asset onboarding or cash-out route, not each item trade. The documented 1Click asset IDs are NEP-141 tokens; there is no evidence in the linked 1Click flow that it swaps arbitrary NEP-245 game items. Intents has no testnet, so keep the core demo on testnet and use `dry: true` quotes or tiny mainnet amounts only if the team deliberately enables a real swap.

## Build order

1. Playable local economy with deterministic rules, visible merchant reasoning, and fast-forward. Validate that resource flooding and shortages produce different choices.
2. NEP-245 contract and game settlement in a local NEAR sandbox, then testnet. Test ownership, transfer events, supply conservation, quote expiry, and merchant insolvency.
3. Social login and sponsored transactions. Keep a regular wallet path for testers if onboarding credentials are unavailable.
4. Optional Intents entry or exit flow after the core game is complete. A cross-chain swap should never interrupt the 30-second loop.
5. Reproducible judge instructions and a video showing a complete economic consequence.

## Decisions and evidence

- The [games track prompt](https://github.com/nearai/near-hackathon-prompt-examples/blob/main/tracks/09-games.md) explicitly asks for the 30-second, 5-minute, and session loops before code, plus readable pricing and fast-forward.
- [NEP-245](https://github.com/near/NEPs/blob/master/neps/nep-0245.md) defines the core multi token interface, stringified `u128` amounts, transfer rules, and events. Its [metadata extension](https://github.com/near/NEPs/blob/master/neps/nep-0245/Metadata.md) is marked proposed, so pin the exact interface used.
- [NEAR Auth](https://docs.near.org/web3-apps/tutorials/near-auth), [Privy](https://docs.near.org/web3-apps/tutorials/privy), and [meta transactions](https://docs.near.org/web3-apps/tutorials/meta-transactions) are the documented routes to social login and sponsored gas.
- [NEAR Intents 1Click](https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/making-a-request) describes token discovery, quote, deposit, and status tracking. The [quote API](https://docs.near-intents.org/api-reference/oneclick/request-a-swap-quote) supports `dry: true`.
- The live [hackathon instructions](https://nearhackathon.com/HACKATHON.md) put the deadline at 14 November 2026, 23:59 UTC, permit a testnet-only project, and require a public repository plus a human-published demo post. They require the human's explicit confirmation for publishing, pushing, mainnet spending, and submission.

## Open choices for the team

- Whether the game's visual theme should stay a frontier market town or use another setting.
- Whether coin is only in-game property represented by NEP-245, or whether a later version settles trades in an externally valuable NEP-141 token. The first choice makes the game loop safer to build and demo quickly.
- Which social login provider the team can actually access before the deadline.
