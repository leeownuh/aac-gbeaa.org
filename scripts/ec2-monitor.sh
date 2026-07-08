#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.three-tier.yml}"
HEALTH_URL="${HEALTH_URL:-http://localhost/api/ready}"
DISK_PATH="${DISK_PATH:-/}"
DISK_WARN_PERCENT="${DISK_WARN_PERCENT:-80}"
BACKUP_ROOT="${BACKUP_ROOT:-backups/ec2}"
BACKUP_MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-30}"

failures=0

check_fail() {
  echo "FAIL: $*"
  failures=$((failures + 1))
}

check_ok() {
  echo "OK: $*"
}

if curl -fsS --max-time 10 "$HEALTH_URL" >/dev/null; then
  check_ok "readiness endpoint ${HEALTH_URL}"
else
  check_fail "readiness endpoint ${HEALTH_URL}"
fi

if docker compose -f "$COMPOSE_FILE" ps --status running >/dev/null 2>&1; then
  stopped="$(docker compose -f "$COMPOSE_FILE" ps --services --filter status=exited 2>/dev/null || true)"
  if [ -n "$stopped" ]; then
    check_fail "containers not running: ${stopped//$'\n'/, }"
  else
    check_ok "compose services are running"
  fi
else
  check_fail "docker compose status unavailable"
fi

unhealthy="$(docker ps --filter health=unhealthy --format '{{.Names}}' || true)"
if [ -n "$unhealthy" ]; then
  check_fail "unhealthy containers: ${unhealthy//$'\n'/, }"
else
  check_ok "no unhealthy containers"
fi

disk_percent="$(df -P "$DISK_PATH" | awk 'NR==2 { gsub("%", "", $5); print $5 }')"
if [ "${disk_percent:-0}" -ge "$DISK_WARN_PERCENT" ]; then
  check_fail "disk usage ${disk_percent}% on ${DISK_PATH}, threshold ${DISK_WARN_PERCENT}%"
else
  check_ok "disk usage ${disk_percent}% on ${DISK_PATH}"
fi

if [ -d "$BACKUP_ROOT" ]; then
  latest_backup="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n 1 | cut -d' ' -f2- || true)"
  if [ -n "$latest_backup" ]; then
    latest_epoch="$(stat -c %Y "$latest_backup")"
    now_epoch="$(date +%s)"
    age_hours="$(( (now_epoch - latest_epoch) / 3600 ))"
    if [ "$age_hours" -gt "$BACKUP_MAX_AGE_HOURS" ]; then
      check_fail "latest backup is ${age_hours}h old: ${latest_backup}"
    else
      check_ok "latest backup is ${age_hours}h old: ${latest_backup}"
    fi
  else
    check_fail "no backups found in ${BACKUP_ROOT}"
  fi
else
  check_fail "backup root missing: ${BACKUP_ROOT}"
fi

if [ "$failures" -gt 0 ]; then
  echo "Monitoring completed with ${failures} failure(s)."
  exit 2
fi

echo "Monitoring completed successfully."
