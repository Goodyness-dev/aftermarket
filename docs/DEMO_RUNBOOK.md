# AFTERMARKET demo and recording

The signature is one rifle circulating through a player, a merchant, a faction and another raid. Show this before discussing blockchain infrastructure.

## Start locally

Requires Node 24. Run `npm ci`, `npm test`, and `npm run build`. In PowerShell:

```powershell
$env:NODE_ENV='production'
$env:PORT='3001'
$env:DATA_DIR='data/production-demo'
$env:NEAR_LIVE_DEMO='1'
npm start
```

Open http://127.0.0.1:3001. Enter Duskport, open the ledger, and choose ENTER LIVE TESTNET PILOT. This is an exclusive local custodial demo; a second browser cannot take over the pilot. The normal practice save stays separate. The prepared testnet keys must already exist outside the project on this PC. No wallet import or private key belongs in the browser.

## Record the actual product

1. Briefly show Duskport, the stash, weapon inspection and the current graphics performance reading in the operator brief. Record the device and graphics setting alongside the measured FPS.
2. In the testnet pilot, show R-042's confirmed owner and the receipt links. Current ownership changes through gameplay; do not assume the original seeded owner is still Harbor.
3. If the pilot owns R-042, list it for 500 credits. Advance one shift for an affordable NPC purchase, then another for Harbor procurement. Show the merchant's finite cash and remaining delegated spending budget in the chain record.
4. Equip DP-0042 and deploy. Wait for reservation/guard assignment confirmation. Kill the guard carrying R-042, recover the dropped rifle, leave the deployment area and return to the green extraction pad. Stand there for three seconds after the opening eight seconds.
5. Wait for settlement confirmation. Show that R-042 is owned by the pilot again, supply is still one, and the receipt opens on testnet. Buy ammunition to demonstrate a real credit payment followed by a simulated supply award.

Suggested narration: “What I sell changes the next patrol. This rifle has a persistent identity: the merchant buys it, Harbor pays to equip a guard, and I can recover that same rifle in the next raid. Weapons and credit payments settle on NEAR testnet; combat runs on the server.”

Keep the recording focused on one complete loop. The existing `TESTNET_LOOP_VERIFIED.json` is a scripted server-engine integration run with 10 confirmed transactions. It is evidence of settlement and conservation, not a substitute for footage of the playable UI. `PRODUCTION_API_VERIFIED.json` records a separate compiled-service credit-payment check.

## Product limits to disclose

The live pilot has two registered guns and shared local custody. Combat, ammunition quantities, salvage and condition are simulated; service credit payments settle on-chain. Practice has the larger generated inventory. There is no production wallet authentication, shared player market, social login, Intents integration or trustless combat verification. Dismantling and practice contract rewards are not supported by the live bridge. The scene uses licensed prototype assets and procedural port geometry.

Actual UI playthrough, screenshots, device FPS measurements and final recording remain required. Do not label the scripted run as human gameplay or claim GTA-level fidelity.

## Interrupted or rejected commands

An uncertain network response leaves the command pending; the worker checks and rebroadcasts the same signed transaction when appropriate. Do not erase the database or outbox to retry it.

An explicitly rejected trade exposes RECONCILE REJECTED COMMAND. The active pilot can release listings created by that command and refresh confirmed state. Previously completed payments are preserved. A rejected deployment that never entered combat can also close its reservation with an empty recovery set, returning assigned NPC loot. If its deadline already passed, contract expiry rules apply and the carried gun can be lost. Rejected settlement of a raid that actually entered combat still requires operator review; reconciliation does not fabricate a replacement result.
