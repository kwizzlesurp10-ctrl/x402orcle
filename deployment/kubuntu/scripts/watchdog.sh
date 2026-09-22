#!/usr/bin/env bash
set -Eeuo pipefail

deployment_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="${deployment_dir}/.env.production"
compose=(docker compose --env-file "${env_file}" -f "${deployment_dir}/docker-compose.yml")
restarted=false

for service in oracle swarm; do
  container_id="$("${compose[@]}" ps --quiet "${service}")"
  health="$(
    docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
      "${container_id}" 2>/dev/null || printf 'missing'
  )"
  if [[ "${health}" != "healthy" ]]; then
    printf 'watchdog: recreating %s (state=%s)\n' "${service}" "${health}" >&2
    "${compose[@]}" up --detach --no-deps --force-recreate "${service}"
    restarted=true
  fi
done

if [[ "${restarted}" == "true" ]]; then
  sleep 20
fi

"${deployment_dir}/scripts/smoke.sh" "${env_file}"
