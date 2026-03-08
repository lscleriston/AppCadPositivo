#!/usr/bin/env bash
# ============================================
# Wrapper para execução via cron do ETL
# MariaDB -> PostgreSQL (AppCadPositivo)
# ============================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="${SCRIPT_DIR}/venv/bin/python3"
SYNC_SCRIPT="${SCRIPT_DIR}/sync_mariadb_to_pg.py"
LOCK_FILE="/tmp/etl_cadpositivo.lock"

# Evitar execuções paralelas
if [ -f "$LOCK_FILE" ]; then
    LOCK_PID=$(cat "$LOCK_FILE" 2>/dev/null)
    if kill -0 "$LOCK_PID" 2>/dev/null; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') [SKIP] ETL já em execução (PID $LOCK_PID)."
        exit 0
    else
        rm -f "$LOCK_FILE"
    fi
fi

echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

cd "$SCRIPT_DIR"
"$PYTHON" "$SYNC_SCRIPT" "$@"
