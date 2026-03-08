#!/usr/bin/env bash
set -euo pipefail

# Script to install systemd unit files for AppCadPositivo
# Run as root or with sudo: sudo ./install_systemd.sh

UNIT_DIR=/etc/systemd/system
SRC_DIR="$(dirname "$0")"

if [ "$EUID" -ne 0 ]; then
  echo "This script must be run as root (or with sudo)." >&2
  exit 1
fi

cp -v "$SRC_DIR"/appcad-backend.service "$UNIT_DIR"/
cp -v "$SRC_DIR"/appcad-frontend.service "$UNIT_DIR"/

systemctl daemon-reload
systemctl enable --now appcad-backend.service appcad-frontend.service

echo "Services installed and started. Check status with: systemctl status appcad-backend.service appcad-frontend.service" 
