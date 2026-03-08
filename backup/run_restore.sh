#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/opt/AppCadPositivo"
BACKUP_DIR="$PROJECT_DIR/backup"

python3 "$BACKUP_DIR/restore_onedrive.py" --latest --apply "$@"
