# Persistent hosting

## Cloud deployment independent of the developer PC

### Railway

`railway.json` selects the existing Node 24 Dockerfile and `/api/health` check. In an eligible Railway workspace, create a new project from `Goodyness-dev/aftermarket`, use one replica and generate an HTTP public domain targeting the platform's PORT. Docker defaults already bind to 0.0.0.0 with NEAR_LIVE_DEMO=0. Never upload local testnet keys. Attach one volume at `/app/data` for retained practice saves; verify that the container's node user can write the mount before calling storage persistent. Without a volume, saves are ephemeral. Keep application sleeping/serverless mode disabled if continuous service is required. Provisioning and usage consume the account's available credits or paid budget; the config file does not grant free capacity. The first inspected workspace reported Trial expired, so no service was created there.

The user is selecting an eligible hosting account. There is no verified cloud game URL yet. See [Oracle setup](ORACLE_HOSTING.md) for the prepared Always Free VM alternative; account verification and capacity remain prerequisites.

The public repository is https://github.com/Goodyness-dev/aftermarket. `render.yaml` defines a free Node 24 web service, including the real backend, WebSockets, production build and health check. Open https://render.com/deploy?repo=https://github.com/Goodyness-dev/aftermarket, sign in to your own Render account, review the free service, and deploy. This is a deployment setup link, not an already deployed game URL. Retain the service's actual `onrender.com` URL after Render reports Live.

The free service works independently of this PC, but sleeps after 15 idle minutes and wakes on a request. Its practice saves are ephemeral and can reset on restarts/redeploys; no persistent progress is promised on that plan. For retained saves and no idle sleep, choose a paid instance and persistent disk only after approving the current price, set DATA_DIR to the writable disk mount, and keep one replica. No paid resources have been authorized or created.

Public mode deliberately uses NEAR_LIVE_DEMO=0. It supports playable practice and confirmed testnet reads; the existing custodial testnet pilot stays local. Hosting alone does not add independent player signing or authentication.

The temporary trycloudflare.com demo runs from this PC and stops when the PC/server/tunnel stops. It is not a substitute for the cloud deployment above.

## Recording without posting

Open the running game's `/?record=1` URL. Click RECORD THIS TAB, select the tab showing AFTERMARKET in the browser capture chooser, then click Share. Play the demo and click STOP & SAVE DEMO. The browser downloads AFTERMARKET-gameplay-economy.webm. Recording has no microphone and uploads nothing. If the browser does not support tab recording, record the game with a local screen recorder. The human reviews the video and posts it on X themselves.

The app needs a long-running Node 24 service with WebSocket support and persistent disk. A static upload of `dist` cannot serve raids or saves.

`npm run build` produces browser assets in `dist` and executable server JavaScript in `build`. `NODE_ENV=production npm start` runs the compiled server without tsx. Set `HOST=0.0.0.0`, the platform's `PORT`, and `DATA_DIR` to a mounted persistent directory for public practice hosting. Use one replica: the session cache and game loop are currently process-local.

The Dockerfile uses a separate build stage, an unprivileged runtime user and a health check. `compose.yaml` mounts a named data volume and exposes port 3000 on local loopback. Docker's daemon was unavailable during preparation; the container build still needs validation. The compiled Node server itself has passed the recorded production API check.

Public hosting keeps `NEAR_LIVE_DEMO=0`. The server refuses to expose the custodial pilot on a non-loopback bind address. It can still show confirmed contract reads. Production wallet authentication and per-player signing/ownership are required before exposing live settlement to independent public players. Do not upload the local credential directory or copy signing keys into the image.

Back up SQLite with its backup API or stop the service before copying the database; copying only the main database while WAL writes are active can omit recent changes. Preserve the signed-transaction outbox and command records with the game database. On restart, pending operations reconcile the same signed bytes.

The repository has been published with explicit user approval. Permanent cloud deployment still requires the hosting account and a successful Live status; the blueprint alone does not prove deployment. Any charged hosting plan requires its own spending authorization.

Docker validation attempt: `docker desktop start --timeout 30` opened an unexpected-error dialog. Docker could not initialize its secrets-engine Unix socket because the socket rename was inaccessible. The engine API remained unavailable. No factory reset, credential change, configuration change or diagnostic upload was performed. Container execution remains unverified until Docker's startup problem is resolved; the local Node service continues independently.
