# Kubuntu production deployment

This stack runs the Oracle and Crediting Swarm as isolated, non-root containers.
Cloudflare Tunnel is the only public ingress. Tailscale is optional and is used
only for SSH and operator access.

## Data policy

- Cloudflare can process request metadata and bodies while proxying traffic.
- CDP or the configured x402 facilitator receives payment authorization,
  payment requirements, payer address, and settlement metadata.
- The configured Oracle model provider receives Oracle task input.
- Vercel AI Gateway and its selected model provider receive swarm payloads and
  purchased intelligence when `AI_GATEWAY_API_KEY` is configured.
- AgentCash subprocess integrations may send endpoint URLs, pay-to addresses,
  and related public intelligence to the selected AgentCash services.
- Docker keeps bounded local service logs. The application does not promise
  durable request-body storage, but model, facilitator, Cloudflare, and
  AgentCash providers may apply their own retention policies.
- Backups intentionally exclude `.env.production`, Cloudflare credentials,
  wallet material, request bodies, and container logs.

Do not submit secrets, private keys, personal data, or proprietary source code
as Oracle goals or swarm payloads unless every configured provider is approved
to process that data.

## 1. Host bootstrap

Use a supported Kubuntu LTS release with security updates enabled:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git docker.io docker-compose-v2 ufw
sudo systemctl enable --now docker
sudo install -d -m 0755 /opt/x402-oracle
sudo chown "$USER":"$USER" /opt/x402-oracle
git clone https://github.com/kwizzlesurp10-ctrl/x402orcle.git /opt/x402-oracle
git clone https://github.com/kwizzlesurp10-ctrl/x402-crediting-swarm.git /opt/x402-crediting-swarm
```

The Compose file defaults to the sibling path
`/opt/x402-crediting-swarm`. Override `SWARM_BUILD_CONTEXT` if needed.

Build locally; no registry is required:

```bash
cd /opt/x402-oracle/deployment/kubuntu
docker compose --env-file .env.production build
```

## 2. Cloudflare Tunnel

Create one named tunnel and two DNS hostnames, for example:

- `oracle.example.com` -> Oracle
- `swarm.example.com` -> Crediting Swarm

Copy the tunnel credentials JSON into
`cloudflared/credentials.json`. Copy `cloudflared/config.yml.example` to
`cloudflared/config.yml`, replace the tunnel UUID and hostnames, then set both
files to mode `0600`.

Separate hostnames preserve each service's own `/.well-known` discovery
documents and avoid ambiguous path routing.

## 3. Mainnet environment

```bash
cd /opt/x402-oracle/deployment/kubuntu
cp .env.production.example .env.production
chmod 0600 .env.production cloudflared/config.yml cloudflared/credentials.json
```

Set the real HTTPS origins, one receive-only `X402_PAY_TO` address, and CDP
Secret API credentials. Never add `EVM_PRIVATE_KEY`, a seed phrase, or any
buyer wallet key to this host.

Validate before launch:

```bash
./scripts/preflight.sh
```

The preflight fails closed unless the network is Base mainnet, both origins use
HTTPS, credentials exist, both services share the same receive address, and
the Cloudflare configuration has no placeholders.

## 4. Firewall and Tailscale

Cloudflare Tunnel makes outbound connections, so no public inbound web port is
required:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw enable
```

For administration, install Tailscale, enable Tailscale SSH, and restrict SSH
with a tailnet ACL. If conventional SSH is retained, allow port 22 only from
the Tailscale interface or a fixed management address. Do not route the Oracle
or swarm hostnames through Tailscale: external x402 buyers must reach them.

## 5. systemd launch

The units assume the repositories are installed under `/opt`:

```bash
sudo cp systemd/x402-oracle-* /etc/systemd/system/
sudo chmod 0755 scripts/*.sh
sudo systemctl daemon-reload
sudo systemctl enable --now \
  x402-oracle-swarm.service \
  x402-oracle-watchdog.timer \
  x402-oracle-backup.timer
```

Inspect status and bounded container logs:

```bash
systemctl status x402-oracle-swarm.service
journalctl -u x402-oracle-swarm.service -f
docker compose --env-file .env.production logs --since 15m
```

Run the no-spend production checks manually:

```bash
./scripts/smoke.sh
```

The paid canary is never automated. It checks the advertised price against a
default `$0.10` cap and runs only with explicit consent:

```bash
ALLOW_MAINNET_SPEND=I_UNDERSTAND_THIS_SPENDS_USDC \
PAID_CANARY_MAX_USD=0.10 \
./scripts/paid-canary.sh
```

## Recovery and rollback

Nightly backups contain non-secret Compose/Cloudflare configuration, image
identities, and Git revisions. Verify an archive without changing the host:

```bash
sudo ./scripts/restore.sh verify /var/backups/x402-oracle/x402-oracle-TIMESTAMP.tar.gz
```

Restore only after stopping the stack:

```bash
sudo systemctl stop x402-oracle-swarm.service
sudo ./scripts/restore.sh restore /var/backups/x402-oracle/x402-oracle-TIMESTAMP.tar.gz
./scripts/preflight.sh
sudo systemctl start x402-oracle-swarm.service
```

For a code rollback, check out the recorded commits in both repositories,
rebuild both local images, run preflight, and restart the service. Keep
Cloudflare credentials and `.env.production` outside Git.
