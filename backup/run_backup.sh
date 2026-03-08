#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/opt/AppCadPositivo"
BACKUP_DIR="$PROJECT_DIR/backup"
LOG_DIR="$BACKUP_DIR/logs"
LOG_FILE="$LOG_DIR/backup.log"

mkdir -p "$LOG_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando backup AppCadPositivo" >> "$LOG_FILE"

python3 "$BACKUP_DIR/backup_onedrive.py" >> "$LOG_FILE" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup finalizado" >> "$LOG_FILE"
