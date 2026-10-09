#!/usr/bin/env bash
#
# Back up the Postgres database running in docker compose.
#
# Usage (on the EC2 box):
#   bash scripts/backup-postgres.sh              # prod
#   ENVIRONMENT=staging bash scripts/backup-postgres.sh
#
# Cron, daily at 03:15 server time:
#   15 3 * * * bash /opt/rental-platform/scripts/backup-postgres.sh >> /opt/rental-platform/backups/backup.log 2>&1
#
# Optional:
#   RETENTION_DAYS=14          how long to keep local backups
#   BACKUP_S3_BUCKET=my-bucket also copy each backup to S3 (needs the AWS CLI
#                              and an instance role allowed to s3:PutObject)

set -euo pipefail

ENVIRONMENT="${ENVIRONMENT:-prod}"
PROJECT_DIR="${PROJECT_DIR:-/opt/rental-platform}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

case "$ENVIRONMENT" in
  prod)
    COMPOSE_FILE="$PROJECT_DIR/docker-compose.prod.yml"
    BACKUP_DIR="$PROJECT_DIR/backups"
    ;;
  staging)
    COMPOSE_FILE="$PROJECT_DIR/docker-compose.staging.yml"
    BACKUP_DIR="$PROJECT_DIR/backups-staging"
    ;;
  *)
    echo "Unknown ENVIRONMENT: $ENVIRONMENT (use prod or staging)" >&2
    exit 1
    ;;
esac

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
cd "$PROJECT_DIR"

# Only one backup at a time (cron + manual run overlapping).
exec 9>"$BACKUP_DIR/.backup.lock"
if ! flock -n 9; then
  echo "Another backup is already running." >&2
  exit 1
fi

TIMESTAMP="$(date -u +'%Y-%m-%d_%H-%M-%S')"
BACKUP_FILE="$BACKUP_DIR/${ENVIRONMENT}_${TIMESTAMP}.sql.gz"
TMP_FILE="$BACKUP_FILE.partial"

# Remove the partial file if anything below fails.
trap 'rm -f "$TMP_FILE"' EXIT

echo "[$(date -u +%FT%TZ)] Starting $ENVIRONMENT backup: $BACKUP_FILE"

# POSTGRES_USER / POSTGRES_DB come from the container's own env (the
# .env.<environment> file), so they always match the running database.
docker compose -f "$COMPOSE_FILE" exec -T postgres sh -c '
  pg_dump \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges
' | gzip -9 > "$TMP_FILE"

# A real dump is never tiny and must be a valid gzip ending with the
# pg_dump completion marker.
if ! gzip -t "$TMP_FILE"; then
  echo "Backup is not a valid gzip file." >&2
  exit 1
fi

if ! gzip -dc "$TMP_FILE" | tail -n 5 | grep -q "PostgreSQL database dump complete"; then
  echo "Backup looks incomplete (no 'dump complete' marker)." >&2
  exit 1
fi

mv "$TMP_FILE" "$BACKUP_FILE"
trap - EXIT

SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
echo "[$(date -u +%FT%TZ)] Backup complete: $BACKUP_FILE ($SIZE)"

# Off-server copy, so a lost instance doesn't take the backups with it.
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  S3_KEY="postgres/$ENVIRONMENT/$(basename "$BACKUP_FILE")"
  aws s3 cp "$BACKUP_FILE" "s3://$BACKUP_S3_BUCKET/$S3_KEY" --only-show-errors
  echo "Uploaded to s3://$BACKUP_S3_BUCKET/$S3_KEY"
fi

find "$BACKUP_DIR" -type f -name "${ENVIRONMENT}_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete

echo "Removed local backups older than $RETENTION_DAYS days."
