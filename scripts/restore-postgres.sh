#!/usr/bin/env bash
#
# Restore a backup made by backup-postgres.sh.
#
# Test a backup WITHOUT touching the live database (restores into a scratch
# database, prints row counts, then drops it):
#   bash scripts/restore-postgres.sh --verify backups/prod_2026-10-09_09-15-00.sql.gz
#
# Restore over the live database (replaces its contents; stop the server
# first so nothing writes during the restore):
#   docker compose -f docker-compose.prod.yml stop server
#   bash scripts/restore-postgres.sh --live backups/prod_2026-10-09_09-15-00.sql.gz
#   docker compose -f docker-compose.prod.yml start server
#
#   ENVIRONMENT=staging bash scripts/restore-postgres.sh --verify backups-staging/...

set -euo pipefail

MODE="${1:-}"
BACKUP_FILE="${2:-}"
ENVIRONMENT="${ENVIRONMENT:-prod}"
PROJECT_DIR="${PROJECT_DIR:-/opt/rental-platform}"

case "$ENVIRONMENT" in
  prod) COMPOSE_FILE="$PROJECT_DIR/docker-compose.prod.yml" ;;
  staging) COMPOSE_FILE="$PROJECT_DIR/docker-compose.staging.yml" ;;
  *) echo "Unknown ENVIRONMENT: $ENVIRONMENT" >&2; exit 1 ;;
esac

if [ "$MODE" != "--verify" ] && [ "$MODE" != "--live" ]; then
  echo "Usage: $0 --verify|--live <backup.sql.gz>" >&2
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

gzip -t "$BACKUP_FILE"

cd "$PROJECT_DIR"

psql_in_container() {
  # $1 = database name ("" = the app database); SQL comes from stdin.
  docker compose -f "$COMPOSE_FILE" exec -T -e TARGET_DB="${1:-}" postgres sh -c '
    psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "${TARGET_DB:-$POSTGRES_DB}"
  '
}

if [ "$MODE" = "--verify" ]; then
  SCRATCH_DB="restore_check_$(date +%s)"

  echo "Creating scratch database $SCRATCH_DB"
  echo "CREATE DATABASE \"$SCRATCH_DB\";" | psql_in_container postgres

  cleanup() {
    echo "DROP DATABASE IF EXISTS \"$SCRATCH_DB\";" | psql_in_container postgres || true
  }
  trap cleanup EXIT

  echo "Restoring $BACKUP_FILE into $SCRATCH_DB"
  gzip -dc "$BACKUP_FILE" | psql_in_container "$SCRATCH_DB" > /dev/null

  echo "Row counts in the restored copy:"
  psql_in_container "$SCRATCH_DB" <<'SQL'
\pset footer off
SELECT 'Tenant' AS "table", count(*) FROM "Tenant"
UNION ALL SELECT 'User', count(*) FROM "User"
UNION ALL SELECT 'TenantMembership', count(*) FROM "TenantMembership"
UNION ALL SELECT 'TenantDomain', count(*) FROM "TenantDomain"
UNION ALL SELECT 'InventoryItem', count(*) FROM "InventoryItem"
UNION ALL SELECT 'Booking', count(*) FROM "Booking"
UNION ALL SELECT 'Payment', count(*) FROM "Payment"
UNION ALL SELECT 'BookingNote', count(*) FROM "BookingNote"
UNION ALL SELECT 'migrations', count(*) FROM "_prisma_migrations";
SQL

  echo "Backup restored cleanly. Scratch database will be dropped."
  exit 0
fi

# --live
read -r -p "This REPLACES the $ENVIRONMENT database with $BACKUP_FILE. Type '$ENVIRONMENT' to continue: " CONFIRM

if [ "$CONFIRM" != "$ENVIRONMENT" ]; then
  echo "Cancelled."
  exit 1
fi

gzip -dc "$BACKUP_FILE" | psql_in_container "" > /dev/null

echo "Restore complete."
