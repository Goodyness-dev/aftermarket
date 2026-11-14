# Oracle Always Free deployment

Status: prepared, not provisioned. No Oracle account or VM has been created by the agent. Signup, identity/card verification and account terms belong to the user. Do not upgrade to paid resources or choose a shape without the Always Free eligibility label.

1. Sign up at https://www.oracle.com/cloud/free/ and complete verification. Pick a home region with available capacity; it determines where Always Free compute can be created.
2. Create an Ubuntu 24.04 compute instance. Select an Always Free-eligible AMD micro or Ampere A1 shape and stay within the console's current Always Free CPU, RAM and boot-volume allocations. Keep enough free quota for the boot volume. Do not accept a paid fallback when free capacity is unavailable.
3. Enable a public IPv4 address. Retain your own SSH key; never put a private key in this repository. Allow inbound TCP 80 from the internet in the VM's network security list. Keep SSH limited to your own IP. Do not expose the SQLite file, Docker daemon or a testnet signer.
4. In the advanced initialization/user-data field, paste the contents of `scripts/oracle-cloud-init.yaml`. It installs Docker, clones this public repository, builds Node 24, and starts one practice server with a persistent Docker volume. A 4 GiB swap file supports the low-memory build. The script is for a fresh VM, not a destructive update of an existing server.
5. Wait for cloud-init to finish. Visit `http://<the instance public IPv4>/api/health`; expect `ok: true`. Open the same IP in your browser and verify deployment, firing, extraction and trade. A build/start failure must be resolved before calling this a live deployment.

Useful SSH diagnostics: `cloud-init status --long`, `sudo tail -n 80 /var/log/cloud-init-output.log`, `sudo systemctl status aftermarket`, and `sudo journalctl -u aftermarket -n 80`. If local health succeeds but the public IP does not, inspect both Oracle's security list and the Ubuntu image's firewall. Only open the game's port; do not flush firewall rules. No health check or firewall change has been verified on an actual VM yet.

The initial demo uses HTTP. Add a domain and a TLS reverse proxy before treating it as production hosting or using browser capture/wallet functionality that requires a secure origin. Public practice uses only an opaque local-save cookie; never send real credentials through HTTP. The local testnet pilot remains on the developer PC and is not deployed.

One VM runs continuously without an application idle-sleep policy, but Oracle can reclaim idle Always Free instances. Capacity and signup are not guaranteed. The local Docker volume survives application/container restarts; it is lost if the VM/disk is deleted. Back up SQLite consistently. Do not claim indefinite availability or durable player progress without VM verification and backups.

Official references: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm and https://www.oracle.com/cloud/free/faq/.
