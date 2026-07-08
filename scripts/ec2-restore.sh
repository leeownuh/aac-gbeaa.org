#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.three-tier.yml}"
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-aac-gbeaa}"
APP_VOLUME="${APP_VOLUME:-${PROJECT_NAME}_app_data}"
BACKUP_DIR="${1:-}"

if [ -z "$BACKUP_DIR" ]; then
  echo "Usage: CONFIRM_RESTORE=YES $0 backups/ec2/YYYYMMDDTHHMMSSZ" >&2
  exit 1
fi

if [ "${CONFIRM_RESTORE:-}" != "YES" ]; then
  echo "ERROR: restore is destructive. Re-run with CONFIRM_RESTORE=YES." >&2
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "ERROR: $COMPOSE_FILE not found. Run this from the repo root." >&2
  exit 1
fi

if [ ! -f "${BACKUP_DIR}/postgres.sql" ] || [ ! -f "${BACKUP_DIR}/app-data.tar.gz" ]; then
  echo "ERROR: backup must contain postgres.sql and app-data.tar.gz." >&2
  exit 1
fi

if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

POSTGRES_DB="${POSTGRES_DB:-aac_gbeaa}"
POSTGRES_USER="${POSTGRES_USER:-aac}"

echo "Verifying backup checksums..."
(cd "$BACKUP_DIR" && sha256sum -c SHA256SUMS)

echo "Stopping web and app containers..."
docker compose -f "$COMPOSE_FILE" stop web app

echo "Restoring app data volume..."
docker run --rm \
  -v "${APP_VOLUME}:/data" \
  -v "$(pwd)/${BACKUP_DIR}:/backup:ro" \
  alpine:3.20 \
  sh -c 'rm -rf /data/* /data/.[!.]* /data/..?* 2>/dev/null || true; tar -xzf /backup/app-data.tar.gz -C /data'

echo "Restoring PostgreSQL database..."
cat "${BACKUP_DIR}/postgres.sql" | docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1

echo "Starting stack..."
docker compose -f "$COMPOSE_FILE" up -d

echo "Restore complete. Verify:"
echo "  curl -fsS http://localhost/api/ready"
echo "  docker compose -f $COMPOSE_FILE ps"
