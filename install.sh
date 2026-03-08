#!/usr/bin/env bash
set -euo pipefail

# Wrapper de compatibilidade: mantém o comando histórico ./install.sh
# e delega para o script organizado em scripts/install.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/scripts/install/install.sh" "$@"
