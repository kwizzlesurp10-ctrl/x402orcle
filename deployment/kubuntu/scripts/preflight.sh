#!/usr/bin/env bash
set -Eeuo pipefail

deployment_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="${1:-${deployment_dir}/.env.production}"
compose_file="${deployment_dir}/docker-compose.yml"
cloudflared_config="${deployment_dir}/cloudflared/config.yml"
cloudflared_credentials="${deployment_dir}/cloudflared/credentials.json"

fail() {
  printf 'preflight: %s\n' "$1" >&2
  exit 1
}

[[ -f "${env_file}" ]] || fail "missing ${env_file}"
[[ "$(stat -c '%a' "${env_file}")" =~ ^[46]00$ ]] || fail "${env_file} must be mode 0400 or 0600"
[[ -f "${cloudflared_config}" ]] || fail "missing rendered Cloudflare config"
[[ -f "${cloudflared_credentials}" ]] || fail "missing Cloudflare tunnel credentials"
[[ "$(stat -c '%a' "${cloudflared_credentials}")" =~ ^[46]00$ ]] || fail "Cloudflare credentials must be mode 0400 or 0600"

set -a
# shellcheck disable=SC1090
source "${env_file}"
set +a

[[ "${PUBLIC_BASE_URL:-}" == https://* ]] || fail "PUBLIC_BASE_URL must use HTTPS"
[[ "${SWARM_PUBLIC_URL:-}" == https://* ]] || fail "SWARM_PUBLIC_URL must use HTTPS"
[[ "${PUBLIC_BASE_URL}" != "${SWARM_PUBLIC_URL}" ]] || fail "Oracle and swarm need distinct public origins"
[[ "${X402_NETWORK:-}" == "eip155:8453" ]] || fail "production network must be Base mainnet eip155:8453"
[[ "${X402_PAY_TO:-}" =~ ^0x[0-9a-fA-F]{40}$ ]] || fail "X402_PAY_TO must be an EVM receive address"
[[ "${X402_PAY_TO}" != "0x0000000000000000000000000000000000000000" ]] || fail "replace the placeholder receive address"
[[ -n "${X402_FACILITATOR_URL:-}" ]] || fail "X402_FACILITATOR_URL is required"
[[ -n "${CDP_API_KEY_ID:-}" ]] || fail "CDP_API_KEY_ID is required"
[[ -n "${CDP_API_KEY_SECRET:-}" ]] || fail "CDP_API_KEY_SECRET is required"

if grep -Eq '(^|_)(EVM_)?PRIVATE_KEY=' "${env_file}"; then
  fail "seller environment must not contain wallet private keys"
fi

if grep -Eq 'REPLACE_WITH|example\.com' "${cloudflared_config}"; then
  fail "render the Cloudflare tunnel config before launch"
fi

docker compose --env-file "${env_file}" -f "${compose_file}" config --quiet
printf 'preflight: production configuration is valid\n'
