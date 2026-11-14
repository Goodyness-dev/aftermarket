# Five-milestone status

The goal is active and incomplete. This checkpoint describes the current vertical slice; the master design contains additional unimplemented features.

| Milestone | Evidence and current status | Remaining work |
| --- | --- | --- |
| Playable settlement | Local custodial pilot supports registered weapon trades/listings, delegated NPC buys, raid reservation/settlement and service credit payments. Durable signed-byte retry and rejected-trade/pre-combat deployment recovery are implemented and tested. | Independent player authentication/custody, general asset registration and resolution of rejected completed-raid settlement. |
| Full chain loop | TESTNET_LOOP_VERIFIED.json records ten confirmed transactions through the server engine: rifle R-042 circulated from guard to player to Mara to Harbor to guard to player. Supply remained one; credit supply stayed 8,420. PRODUCTION_API_VERIFIED.json records a separate real payment and duplicate/forged-command checks. | Human-played footage must complement the scripted integration evidence. |
| Visual/gameplay polish | Port, player/guards, raid HUD, rifle inspection and drag rotation observed in Chrome. Inspection import failure was injected; recovery controls retained the depot, and the held module was restored. Quality controls, state-driven stock cases and FPS instrumentation exist. Point observations: 53 FPS landing, 41 FPS raid brief on high. | Full aiming/firing/extraction browser playthrough, sustained performance and responsive checks, authored realistic art improvements, final recording. Background mouse capture was not established; no successful browser firing check is claimed. |
| Hosting | Compiled production Node service runs locally; Dockerfile, single-replica persistent volume and instructions prepared. | Docker engine fails during secrets-engine socket initialization. Container execution and public hosting remain unverified. No public signer is exposed. |
| Demo/release package | README, demo/hosting runbooks, submission checklist, draft post, MIT source license, asset credits and hashed release manifest prepared. Runtime screenshots are under docs/screenshots. | Video, final review, human submission fields and publication approvals. |

Combat-feedback follow-up: simultaneous guard shots previously shared IDs. IDs now have distinct guard slots and separate event timestamps; old events are filtered instead of replayed as stale tracers/audio. The focused simultaneous-fire test passes and the production build succeeds. Rebuilds update dist; a running server process must be restarted to load changed server JavaScript.

No repository has been pushed/published and no hackathon application has been sent. Testnet credentials remain outside the repository. Regenerate RELEASE_REVIEW.json after final source/document changes.
