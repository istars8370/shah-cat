# Airdrop staging hosting and verification — 2026-10-29 KST

## Decision and scope

Use the user's existing Windows Server for an isolated staging deployment, provided a restricted runtime account, a valid TLS certificate, and controlled ingress can be established. Incremental VM rental is zero; the existing server's rental, Windows license, traffic, domain and off-host backup costs remain unknown. The supplied Administrator identity is for operator access, not the recommended application identity. Do not purchase a second server automatically.

Fallback: DigitalOcean Basic regular 1 GiB / 1 vCPU / 25 GiB SSD in Singapore (subject to capacity), Ubuntu 24.04, Node LTS, Nginx. Monthly list price is USD 6; weekly VM backup adds 20% (USD 7.20 total), daily adds 30% (USD 7.80 total). Tax, domain, off-host ledger copies and overages are extra. This retains the existing loopback model without a public application port. Memory adequacy is a staging hypothesis until measured on the selected host.

Alternative: AWS Lightsail Linux with public IPv4, 1 GB / 2 vCPU / 40 GB SSD, USD 7/month before snapshots and extras; 2 GB is USD 12. It also supports the loopback/proxy layout, and merits preference if the operator already uses AWS or needs a closer region. No latency benchmark was performed.

Render is operationally convenient for managed TLS, but its public web service requires a listener on 0.0.0.0 and paid persistent storage (USD 0.25/GB/month). It requires a separately public edge or a multi-process container to retain the Node loopback boundary. Its dynamic compute pricing was not reliably extracted from the official price page, so no unverified compute quote is used. It is not selected for this architecture.

Sources checked on 2026-10-29:

- https://www.digitalocean.com/pricing/droplets
- https://docs.digitalocean.com/products/backups/details/pricing/
- https://docs.digitalocean.com/platform/regional-availability/
- https://aws.amazon.com/lightsail/pricing/
- https://render.com/pricing
- https://render.com/docs/disks
- https://render.com/docs/web-services#port-binding

Nginx's Windows build is documented as beta and does not offer Unix-level scalability or a native Windows service. It is acceptable here only as a bounded staging candidate. Do not infer production suitability from this rehearsal. Source: https://nginx.org/en/docs/windows.html

## Deployment boundaries

Node remains 127.0.0.1:4173. Nginx alone listens publicly on 443. Exactly these paths may pass: /apply.html, /apply-ui.js, /dashboard.css, /logo.png, /api/airdrop/public/health, /api/airdrop/public/status, /api/airdrop/public/applications. All other paths return 404, including admin/Treasury, Discord, chain/read-only wallet APIs, environment files and ledgers. No default site or web root is permitted. Raw encoded and dot-segment variants are denied.

POST applications requires the original exact browser Origin and JSON. Nginx must not replace a supplied Origin with a trusted value. Only GET with no Origin receives the fixed staging Origin, permitting same-site page fetches and health probes. Credentials/cookies are stripped at the public proxy. The 20/min/source rate limit, burst 5 and 32 KiB body limit remain active. Do not configure real-IP trust without reviewing the actual upstream topology.

The staging host receives only synthetic application data. No wallet extension, seed, private key, Mainnet endpoint or transaction process is needed. TLS private keys are infrastructure credentials and stay outside the repository; they are not wallet signing keys. Do not copy production/Treasury data to staging.

## Windows preparation

1. Operator logs in using RDP; never send the password or private key in chat. Confirm the OS version, existing IIS/Nginx/listeners, available memory and disk, ingress rules and current backups before making host changes. Public RDP is not proof of application access.
2. Choose a staging hostname and point DNS to the host. Provision a trusted certificate with SAN for that hostname, full chain and renewal plan. DNS-based validation avoids opening port 80. Do not use an insecure TLS bypass. IP-only TLS needs a CA-issued IP certificate; a self-signed rehearsal certificate is not a public deployment certificate.
3. Install a current Node LTS and the current official Nginx Windows mainline, verifying publisher/release provenance. Inspect existing services before choosing ports. Use a dedicated limited runtime account with access only to checkout, Nginx working directories, TLS key and staging state. Do not run the app as Administrator.
4. Place checkout in a versioned release directory. Keep private state outside it, e.g. C:/SHAH-Staging/private/events.jsonl; back up to a separate non-public directory and copy verified backups off-host. Restrict directory ACLs to the runtime identity and designated operators; default Windows ACLs, not POSIX mode bits, determine actual secrecy.
5. Copy deploy/airdrop-staging.runtime.example.json to a private directory outside the checkout. Set environment=staging, exact HTTPS origin, current startsAt (canonical UTC ISO), paths and a fresh random adminToken of at least 32 bytes. Generate it locally; never paste or commit it. Do not reuse a production token.
6. Render the full Nginx config into that private directory with the command below. Ensure prefix/logs and prefix/temp exist. Run nginx -t with the same prefix/config used by the supervisor. Keep the default Nginx config and IIS site from handling the staging hostname. Only enable public 443 after local validation; do not expose 4173.
7. Start the supervisor using the command below. It validates configuration and actual ledger readiness before starting the edge. Ctrl+C closes ingress, drains requests and closes the ledger. It fails closed on process failure. Automatic restart is intentionally not implemented because an unexplained lock must not be removed automatically.
8. For survival across RDP logoff/reboot, register the supervisor as a startup task under the restricted runtime identity and test logoff, reboot and recovery on the actual host. A foreground RDP process alone is not an operational deployment. Forced task termination can leave a lock; stop ingress and verify no writer before a documented operator recovery. Never delete a lock solely because startup failed.

```powershell
node scripts/render-airdrop-nginx.mjs https://staging.example.com C:/SHAH-Staging/private/fullchain.pem C:/SHAH-Staging/private/privkey.pem C:/SHAH-Staging/private/nginx.conf
node scripts/run-airdrop-staging.mjs C:/SHAH-Staging/private/runtime.json
```

These commands require real private runtime settings and a trusted certificate. The repository example is deliberately incomplete. No cloud purchase, DNS update, firewall modification, task registration or remote installation is performed by generating these files.

## Verification on the selected host

Record the exact release commit, Node/Nginx versions, date, host resources and each PASS/FAIL/BLOCKED result. Keep host IP and private access details in operator records, not public PR logs.

- TLS: external request succeeds with normal certificate and hostname validation; TLS 1.2/1.3 only. Validate expiry, chain and renewal. Never set NODE_TLS_REJECT_UNAUTHORIZED=0.
- Fail-closed proxy: every permitted asset/API succeeds; unknown, admin/Treasury, encoded and trailing slash paths return 404. Wrong or absent POST Origin returns 403; wrong method is denied; unknown Host is closed. Repeat denied requests with a forged localhost Host. Verify port 4173 is externally unreachable and local listener is only 127.0.0.1. Check oversized body and burst rate limits. Stop Node and verify the edge fails without fallback.
- Readiness: run scripts/check-airdrop-readiness.mjs using the private runtime environment. Public health must expose only ready/version. It now opens/verifies the actual ledger; invalid config, corruption or a writer lock cannot yield ready=true.
- Load: run the commands below only on a fresh synthetic staging ledger and with no previous submissions on that UTC day. Up to 150 applications, up to 10 workers; default 3100 ms spacing keeps the public 20/min limit. All 150 must have valid 201 responses. Report p50/p95/max, HTTP status histogram and PASS/REVIEW/REJECT separately. 4xx including 429 fail the probe. No latency SLA has been supplied; record observations rather than inventing a pass threshold.
- Persistence: gracefully stop/restart the Node process and compare complete aggregate status; separately verify actual task restart, RDP logoff and OS reboot. Disk existence alone is insufficient.
- Backup/restore: quiesce ingress and gracefully close the writer; run backup script using the same AIRDROP_LEDGER_PATH used by the app. Verify checksum and hash chain. Restore into a different staging path, start with the same startsAt, compare aggregate status, and test tampered backups fail. Keep at least one verified copy off-host. A same-disk copy is not disaster recovery. Schedule a backup job under a restricted account only after the real directories, retention and off-host destination are known.

```powershell
$env:AIRDROP_LOAD_CONFIRM='STAGING_ONLY'
$env:AIRDROP_LOAD_TARGET='https://staging.example.com'
$env:AIRDROP_LOAD_ORIGIN=$env:AIRDROP_LOAD_TARGET
$env:AIRDROP_LOAD_COUNT='150'
$env:AIRDROP_LOAD_CONCURRENCY='1'
$env:AIRDROP_LOAD_INTERVAL_MS='3100'
node scripts/airdrop-load-staging.mjs
```

## Isolated rehearsal and release gate

scripts/verify-airdrop-staging-local.mjs creates its own private temporary ledger and one-day TLS certificate, runs actual Nginx and Node on loopback, validates TLS with that explicit CA and SAN (no global trust bypass), sends exactly 150 synthetic submissions through the unchanged edge limit, restarts the real Node process, verifies/restores a backup, probes the rate limit without creating extra applications, then verifies backend-down and corrupt-ledger behavior. The script refuses occupied test ports. Set NGINX_BIN and OPENSSL_BIN to installed executables. STAGING_TMP_DIR can select a writable test parent; STAGING_EVIDENCE can save the aggregate report. It does not test the remote machine, public certificate, firewall, reboot, task scheduler, off-host recovery or renewal.

.github/workflows/airdrop-staging.yml repeats the isolated rehearsal on Ubuntu. Passing that job does not establish a deployed Windows service. Production release remains NO-GO until all actual-host gates pass. Mainnet, signing, transaction construction/broadcast, Treasury movement, payout requests and PR merge remain outside this task.
