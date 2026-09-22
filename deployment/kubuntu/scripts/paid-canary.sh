#!/usr/bin/env bash
set -Eeuo pipefail

deployment_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="${deployment_dir}/.env.production"

[[ "${ALLOW_MAINNET_SPEND:-}" == "I_UNDERSTAND_THIS_SPENDS_USDC" ]] || {
  printf 'paid-canary: set ALLOW_MAINNET_SPEND=I_UNDERSTAND_THIS_SPENDS_USDC to continue\n' >&2
  exit 2
}

set -a
# shellcheck disable=SC1090
source "${env_file}"
set +a

maximum_usd="${PAID_CANARY_MAX_USD:-0.10}"
quoted_maximum="$(printf '%s' "${maximum_usd}" | sed 's/[^0-9.]//g')"
advertised_price="$(
  curl --fail --silent --show-error --max-time 15 "${PUBLIC_BASE_URL}/openapi.json" |
    node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const s=JSON.parse(d);process.stdout.write(s.paths['/api/consult/oracle_ask'].post['x-payment-info'].price.amount)})"
)"

node -e "
  const price = Number(process.argv[1]);
  const maximum = Number(process.argv[2]);
  if (!Number.isFinite(price) || !Number.isFinite(maximum) || price > maximum) process.exit(1);
" "${advertised_price}" "${quoted_maximum}" || {
  printf 'paid-canary: advertised price %s exceeds cap %s\n' "${advertised_price}" "${maximum_usd}" >&2
  exit 1
}

printf 'paid-canary: spending up to $%s on Base mainnet\n' "${quoted_maximum}"
npx --yes agentcash@latest fetch \
  "${PUBLIC_BASE_URL}/api/consult/oracle_ask" \
  -m POST \
  -b '{"question":"Return a one-line production canary response.","audience":"operator"}'
