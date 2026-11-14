# Persistent hosting

The app needs a long-running Node 24 service with WebSocket support and persistent disk. A static upload of `dist` cannot serve raids or saves.

`npm run build` produces browser assets in `dist` and executable server JavaScript in `build`. `NODE_ENV=production npm start` runs the compiled server without tsx. Set `HOST=0.0.0.0`, the platform's `PORT`, and `DATA_DIR` to a mounted persistent directory for public practice hosting. Use one replica: the session cache and game loop are currently process-local.

The Dockerfile uses a separate build stage, an unprivileged runtime user and a health check. `compose.yaml` mounts a named data volume and exposes port 3000 on local loopback. Docker's daemon was unavailable during preparation; the container build still needs validation. The compiled Node server itself has passed the recorded production API check.

Public hosting keeps `NEAR_LIVE_DEMO=0`. The server refuses to expose the custodial pilot on a non-loopback bind address. It can still show confirmed contract reads. Production wallet authentication and per-player signing/ownership are required before exposing live settlement to independent public players. Do not upload the local credential directory or copy signing keys into the image.

Back up SQLite with its backup API or stop the service before copying the database; copying only the main database while WAL writes are active can omit recent changes. Preserve the signed-transaction outbox and command records with the game database. On restart, pending operations reconcile the same signed bytes.

No public hosting service has been provisioned or published. Repository publication/push and any charged hosting plan require the corresponding authorization. The local production preview is the current reviewable deployment target.

Docker validation attempt: `docker desktop start --timeout 30` opened an unexpected-error dialog. Docker could not initialize its secrets-engine Unix socket because the socket rename was inaccessible. The engine API remained unavailable. No factory reset, credential change, configuration change or diagnostic upload was performed. Container execution remains unverified until Docker's startup problem is resolved; the local Node service continues independently.
