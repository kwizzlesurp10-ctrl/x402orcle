#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  printf 'usage: %s verify|restore ARCHIVE\n' "$0" >&2
  exit 2
}

[[ "$#" == 2 ]] || usage
mode="$1"
archive="$(realpath "$2")"
checksum_file="${archive}.sha256"
deployment_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
temporary_dir="$(mktemp -d)"
trap 'rm -rf "${temporary_dir}"' EXIT

[[ -f "${archive}" && -f "${checksum_file}" ]] || {
  printf 'restore: archive or checksum is missing\n' >&2
  exit 1
}
(
  cd "$(dirname "${archive}")"
  sha256sum --check "$(basename "${checksum_file}")"
)
tar --extract --gzip --file "${archive}" --directory "${temporary_dir}"

[[ -f "${temporary_dir}/x402-oracle/docker-compose.yml" ]] || {
  printf 'restore: archive does not contain docker-compose.yml\n' >&2
  exit 1
}
[[ -f "${temporary_dir}/x402-oracle/config.yml" ]] || {
  printf 'restore: archive does not contain Cloudflare config.yml\n' >&2
  exit 1
}

if [[ "${mode}" == "verify" ]]; then
  printf 'restore: checksum and archive structure are valid\n'
  exit 0
fi
[[ "${mode}" == "restore" ]] || usage

timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
cp --archive "${deployment_dir}/docker-compose.yml" "${deployment_dir}/docker-compose.yml.before-${timestamp}"
cp --archive "${deployment_dir}/cloudflared/config.yml" "${deployment_dir}/cloudflared/config.yml.before-${timestamp}"
install -m 0644 "${temporary_dir}/x402-oracle/docker-compose.yml" "${deployment_dir}/docker-compose.yml"
install -m 0600 "${temporary_dir}/x402-oracle/config.yml" "${deployment_dir}/cloudflared/config.yml"
printf 'restore: restored non-secret configuration; run preflight before restart\n'
