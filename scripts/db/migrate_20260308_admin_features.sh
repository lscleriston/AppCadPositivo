#!/usr/bin/env bash
set -euo pipefail

# Idempotent DB migration for admin management and audit fields.
# It can be safely re-run.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_ENV="${ROOT_DIR}/backend/.env"

if [[ ! -f "${BACKEND_ENV}" ]]; then
  echo "[ERRO] Arquivo não encontrado: ${BACKEND_ENV}" >&2
  exit 1
fi

# Load DB connection from backend/.env
set -a
# shellcheck disable=SC1090
source "${BACKEND_ENV}"
set +a

: "${DB_HOST:?DB_HOST não definido no backend/.env}"
: "${DB_PORT:?DB_PORT não definido no backend/.env}"
: "${DB_USER:?DB_USER não definido no backend/.env}"
: "${DB_PASSWORD:?DB_PASSWORD não definido no backend/.env}"
: "${DB_NAME:?DB_NAME não definido no backend/.env}"

MYSQL=(mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" "-p${DB_PASSWORD}" "${DB_NAME}")

echo "[INFO] Aplicando migração de banco em ${DB_NAME} (${DB_HOST}:${DB_PORT})"

"${MYSQL[@]}" <<'SQL'
SET @db := DATABASE();

SET @sql := IF (
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'tb_usuario' AND column_name = 'is_active') = 0,
  'ALTER TABLE tb_usuario ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1',
  'SELECT "tb_usuario.is_active já existe"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF (
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'tb_usuario' AND column_name = 'ultima_alteracao_por_matricula') = 0,
  'ALTER TABLE tb_usuario ADD COLUMN ultima_alteracao_por_matricula VARCHAR(50) NULL',
  'SELECT "tb_usuario.ultima_alteracao_por_matricula já existe"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF (
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'tb_dados' AND column_name = 'ultima_alteracao_por_matricula') = 0,
  'ALTER TABLE tb_dados ADD COLUMN ultima_alteracao_por_matricula VARCHAR(50) NULL',
  'SELECT "tb_dados.ultima_alteracao_por_matricula já existe"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SQL

echo "[INFO] Migração concluída com sucesso"
