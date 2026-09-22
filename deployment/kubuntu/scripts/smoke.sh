#!/usr/bin/env bash
set -Eeuo pipefail

deployment_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="${1:-${deployment_dir}/.env.production}"

set -a
# shellcheck disable=SC1090
source "${env_file}"
set +a

require_status() {
  local expected="$1"
  local url="$2"
  local method="${3:-GET}"
  local body="${4:-}"
  local headers
  headers="$(mktemp)"
  trap 'rm -f "${headers}"' RETURN

  local -a request_args=(
    --silent
    --show-error
    --max-time
    15
    --dump-header
    "${headers}"
    --output
    /dev/null
    --request
    "${method}"
  )
  if [[ -n "${body}" ]]; then
    request_args+=(--header "content-type: application/json" --data "${body}")
  fi

  local status
  curl "${request_args[@]}" "${url}" || return 1
  status="$(awk 'toupper($1) ~ /^HTTP/ { code=$2 } END { print code }' "${headers}")"
  [[ "${status}" == "${expected}" ]] || {
    printf 'smoke: expected %s from %s, got %s\n' "${expected}" "${url}" "${status}" >&2
    return 1
  }

  if [[ "${expected}" == "402" ]]; then
    grep -Eiq '^payment-required:' "${headers}" || {
      printf 'smoke: %s did not return PAYMENT-REQUIRED\n' "${url}" >&2
      return 1
    }
  fi
}

require_status 200 "${PUBLIC_BASE_URL}/api/health"
require_status 200 "${PUBLIC_BASE_URL}/openapi.json"
require_status 200 "${PUBLIC_BASE_URL}/.well-known/x402"
require_status 402 "${PUBLIC_BASE_URL}/api/consult/complete_oracle_task" POST \
  '{"goal":"mainnet no-spend readiness probe","constraints":"do not execute"}'
require_status 200 "${SWARM_PUBLIC_URL}/api/swarm"
require_status 402 "${SWARM_PUBLIC_URL}/api/swarm" POST \
  '{"payload":{"endpoint_url":"https://example.com/api"}}'

printf 'smoke: all no-spend checks passed\n'
