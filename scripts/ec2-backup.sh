#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.three-tier.yml}"
BACKUP_ROOT="${BACKUP_ROOT:-backups/ec2}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-aac-gbeaa}"
APP_VOLUME="${APP_VOLUME:-${PROJECT_NAME}_app_data}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "ERROR: $COMPOSE_FILE not found. Run this from the repo root." >&2
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

mkdir -p "$BACKUP_DIR"

echo "Creating PostgreSQL dump..."
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
  > "${BACKUP_DIR}/postgres.sql"

echo "Archiving app data volume..."
docker run --rm \
  -v "${APP_VOLUME}:/data:ro" \
  -v "$(pwd)/${BACKUP_DIR}:/backup" \
  alpine:3.20 \
  tar -czf /backup/app-data.tar.gz -C /data .

cat > "${BACKUP_DIR}/manifest.txt" <<EOF
timestamp_utc=${TIMESTAMP}
compose_file=${COMPOSE_FILE}
project_name=${PROJECT_NAME}
postgres_db=${POSTGRES_DB}
postgres_user=${POSTGRES_USER}
app_volume=${APP_VOLUME}
git_commit=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)
host=$(hostname)
EOF

(cd "$BACKUP_DIR" && sha256sum postgres.sql app-data.tar.gz manifest.txt > SHA256SUMS)

if [ -n "${BACKUP_S3_URI:-}" ]; then
  if ! command -v aws >/dev/null 2>&1; then
    echo "ERROR: BACKUP_S3_URI is set but aws CLI is not installed." >&2
    exit 1
  fi

  echo "Uploading backup to ${BACKUP_S3_URI%/}/${TIMESTAMP}/ ..."
  aws s3 sync "$BACKUP_DIR" "${BACKUP_S3_URI%/}/${TIMESTAMP}/" --only-show-errors
fi

echo "Removing local backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -print -exec rm -rf {} \;

echo "Backup complete: ${BACKUP_DIR}"
