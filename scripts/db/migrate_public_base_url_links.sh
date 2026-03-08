#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 || $# -gt 3 ]]; then
  echo "Uso: $0 OLD_BASE_URL NEW_BASE_URL [BACKEND_ENV_PATH]"
  exit 1
fi

OLD_BASE_URL="${1%/}"
NEW_BASE_URL="${2%/}"
BACKEND_ENV_PATH="${3:-/opt/AppCadPositivo/backend/.env}"

if [[ ! -f "$BACKEND_ENV_PATH" ]]; then
  echo "Arquivo de ambiente nao encontrado: $BACKEND_ENV_PATH"
  exit 1
fi

DB_HOST="$(grep '^DB_HOST=' "$BACKEND_ENV_PATH" | cut -d= -f2-)"
DB_PORT="$(grep '^DB_PORT=' "$BACKEND_ENV_PATH" | cut -d= -f2-)"
DB_USER="$(grep '^DB_USER=' "$BACKEND_ENV_PATH" | cut -d= -f2-)"
DB_PASSWORD="$(grep '^DB_PASSWORD=' "$BACKEND_ENV_PATH" | cut -d= -f2-)"
DB_NAME="$(grep '^DB_NAME=' "$BACKEND_ENV_PATH" | cut -d= -f2-)"

echo "[1/3] Contagem antes"
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -Nse "
SELECT 'tb_dados_certificacao old_host', COUNT(*)
FROM tb_dados_certificacao
WHERE link_certificacao LIKE CONCAT('$OLD_BASE_URL', '%');

SELECT 'tb_dados old_host', COUNT(*)
FROM tb_dados
WHERE curriculo_atualizado LIKE CONCAT('$OLD_BASE_URL', '%');
"

echo "[2/3] Atualizando"
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "
UPDATE tb_dados_certificacao
SET link_certificacao = REPLACE(link_certificacao, '$OLD_BASE_URL', '$NEW_BASE_URL')
WHERE link_certificacao LIKE CONCAT('$OLD_BASE_URL', '%');

UPDATE tb_dados
SET curriculo_atualizado = REPLACE(curriculo_atualizado, '$OLD_BASE_URL', '$NEW_BASE_URL')
WHERE curriculo_atualizado LIKE CONCAT('$OLD_BASE_URL', '%');
"

echo "[3/3] Contagem depois"
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -Nse "
SELECT 'tb_dados_certificacao old_host (restante)', COUNT(*)
FROM tb_dados_certificacao
WHERE link_certificacao LIKE CONCAT('$OLD_BASE_URL', '%');

SELECT 'tb_dados old_host (restante)', COUNT(*)
FROM tb_dados
WHERE curriculo_atualizado LIKE CONCAT('$OLD_BASE_URL', '%');
"

echo "Migracao concluida."
