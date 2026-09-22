#!/usr/bin/env bash
set -Eeuo pipefail

deployment_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repository_dir="$(cd "${deployment_dir}/../.." && pwd)"
backup_dir="${X402_BACKUP_DIR:-/var/backups/x402-oracle}"
retention_days="${X402_BACKUP_RETENTION_DAYS:-14}"
timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
archive="${backup_dir}/x402-oracle-${timestamp}.tar.gz"
manifest="$(mktemp)"
trap 'rm -f "${manifest}"' EXIT

install -d -m 0700 "${backup_dir}"

{
  printf 'created_at=%s\n' "${timestamp}"
  printf 'oracle_commit=%s\n' "$(git -C "${repository_dir}" rev-parse HEAD)"
  if [[ -d "${repository_dir}/../x402-crediting-swarm/.git" ]]; then
    printf 'swarm_commit=%s\n' "$(git -C "${repository_dir}/../x402-crediting-swarm" rev-parse HEAD)"
  fi
  docker image inspect x402-oracle:local x402-crediting-swarm:local \
    --format '{{.RepoTags}} {{.Id}}' 2>/dev/null || true
} >"${manifest}"

tar --create --gzip --file "${archive}" \
  --transform='s|.*/|x402-oracle/|' \
  "${deployment_dir}/docker-compose.yml" \
  "${deployment_dir}/cloudflared/config.yml" \
  "${manifest}"
sha256sum "${archive}" >"${archive}.sha256"

find "${backup_dir}" -type f -name 'x402-oracle-*' -mtime "+${retention_days}" -delete
printf 'backup: wrote %s\n' "${archive}"
