#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ETL: MariaDB (bd_cadpositivo) ➜ PostgreSQL (dw_positivo.dw_certificacoes_cad)

Estratégia: Full-load (TRUNCATE + INSERT) a cada execução.
Volume pequeno (~2 000 registros no total), execução leve e rápida.

Uso:
    python3 sync_mariadb_to_pg.py          # execução normal
    python3 sync_mariadb_to_pg.py --dry    # apenas mostra contagens, não grava
"""

import os
import sys
import logging
from datetime import datetime
from pathlib import Path

import pymysql
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# ── Configuração de logging ─────────────────────────────────────────────────
LOG_DIR = Path(__file__).resolve().parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_DIR / "sync.log", encoding="utf-8"),
    ],
)
log = logging.getLogger("etl_sync")

# ── Carregar .env ───────────────────────────────────────────────────────────
ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(ENV_PATH)

MARIA_CFG = {
    "host": os.getenv("MARIA_HOST", "127.0.0.1"),
    "port": int(os.getenv("MARIA_PORT", 3306)),
    "user": os.getenv("MARIA_USER"),
    "password": os.getenv("MARIA_PASSWORD"),
    "database": os.getenv("MARIA_DB"),
    "charset": "utf8mb4",
    "cursorclass": pymysql.cursors.DictCursor,
}

PG_CFG = {
    "host": os.getenv("PG_HOST", "127.0.0.1"),
    "port": int(os.getenv("PG_PORT", 5432)),
    "user": os.getenv("PG_USER"),
    "password": os.getenv("PG_PASSWORD"),
    "dbname": os.getenv("PG_DB"),
}

PG_SCHEMA = os.getenv("PG_SCHEMA", "dw_certificacoes_cad")

# ── Definição das tabelas e seus DDLs no PostgreSQL ─────────────────────────
# Mapeamento: nome_tabela_mariadb -> DDL PostgreSQL (sem schema, adicionado em runtime)
# A coluna `password` de tb_usuario é propositalmente EXCLUÍDA (dado sensível).

TABLES_DDL = {
    "tb_dados": """
        CREATE TABLE IF NOT EXISTS {schema}.tb_dados (
            id              INTEGER PRIMARY KEY,
            nome_completo   VARCHAR(255),
            matricula       VARCHAR(20),
            torre_atendimento VARCHAR(255),
            conhecimento    TEXT,
            certificacoes   TEXT,
            certificacoes_link TEXT,
            emissao_certificacoes TEXT,
            validade_certificacoes TEXT,
            operacao_principal VARCHAR(100),
            operacao_compartilhada VARCHAR(200),
            diploma_superior VARCHAR(255),
            conclusao_superior TEXT,
            pos_graduacao   TEXT,
            conclusao_pos   TEXT,
            curriculo_atualizado TEXT,
            cursos          TEXT,
            ultima_atualizacao DATE,
            url_linkedin    VARCHAR(255)
        );
    """,
    "tb_usuario": """
        CREATE TABLE IF NOT EXISTS {schema}.tb_usuario (
            id              INTEGER PRIMARY KEY,
            id_dados        INTEGER,
            matricula       VARCHAR(50),
            nome            VARCHAR(255),
            is_admin        BOOLEAN,
            is_super_admin  BOOLEAN,
            dados_completos BOOLEAN
        );
    """,
    "tb_certificacoes": """
        CREATE TABLE IF NOT EXISTS {schema}.tb_certificacoes (
            id           INTEGER PRIMARY KEY,
            fornecedor   VARCHAR(55),
            certificacao VARCHAR(255)
        );
    """,
    "tb_dados_certificacao": """
        CREATE TABLE IF NOT EXISTS {schema}.tb_dados_certificacao (
            id                    INTEGER PRIMARY KEY,
            id_user               INTEGER,
            id_certificacao       INTEGER,
            link_certificacao     TEXT,
            certificacao_emissao  TEXT,
            certificacao_validade TEXT
        );
    """,
    "tb_dados_conhecimentos": """
        CREATE TABLE IF NOT EXISTS {schema}.tb_dados_conhecimentos (
            id            INTEGER PRIMARY KEY,
            id_user       INTEGER,
            conhecimentos TEXT
        );
    """,
    "tb_dados_cursos": """
        CREATE TABLE IF NOT EXISTS {schema}.tb_dados_cursos (
            id      INTEGER PRIMARY KEY,
            id_user INTEGER,
            curso   TEXT
        );
    """,
    "tb_dados_operacao_compartilhada": """
        CREATE TABLE IF NOT EXISTS {schema}.tb_dados_operacao_compartilhada (
            id          INTEGER PRIMARY KEY,
            id_user     INTEGER,
            id_operacao INTEGER
        );
    """,
    "tb_operacoes": """
        CREATE TABLE IF NOT EXISTS {schema}.tb_operacoes (
            id       INTEGER PRIMARY KEY,
            operacao VARCHAR(255)
        );
    """,
    "tb_torreatendimento": """
        CREATE TABLE IF NOT EXISTS {schema}.tb_torreatendimento (
            id_torre      INTEGER PRIMARY KEY,
            nome_torre    VARCHAR(100),
            data_cadastro TIMESTAMP
        );
    """,
    "tb_torres_atendimento": """
        CREATE TABLE IF NOT EXISTS {schema}.tb_torres_atendimento (
            id            INTEGER PRIMARY KEY,
            nome_torre    VARCHAR(100),
            data_cadastro TIMESTAMP
        );
    """,
}

# Colunas a ler de cada tabela no MariaDB (excluímos password de tb_usuario)
TABLES_COLUMNS = {
    "tb_dados": [
        "id", "nome_completo", "matricula", "torre_atendimento", "conhecimento",
        "certificacoes", "certificacoes_link", "emissao_certificacoes",
        "validade_certificacoes", "operacao_principal", "operacao_compartilhada",
        "diploma_superior", "conclusao_superior", "pos_graduacao", "conclusao_pos",
        "curriculo_atualizado", "cursos", "ultima_atualizacao", "url_linkedin",
    ],
    "tb_usuario": [
        "id", "id_dados", "matricula", "nome", "is_admin", "is_super_admin",
        "dados_completos",
    ],
    "tb_certificacoes": ["id", "fornecedor", "certificacao"],
    "tb_dados_certificacao": [
        "id", "id_user", "id_certificacao", "link_certificacao",
        "certificacao_emissao", "certificacao_validade",
    ],
    "tb_dados_conhecimentos": ["id", "id_user", "conhecimentos"],
    "tb_dados_cursos": ["id", "id_user", "curso"],
    "tb_dados_operacao_compartilhada": ["id", "id_user", "id_operacao"],
    "tb_operacoes": ["id", "operacao"],
    "tb_torreatendimento": ["id_torre", "nome_torre", "data_cadastro"],
    "tb_torres_atendimento": ["id", "nome_torre", "data_cadastro"],
}


# ── Funções auxiliares ──────────────────────────────────────────────────────

def get_maria_conn():
    """Retorna conexão com o MariaDB."""
    return pymysql.connect(**MARIA_CFG)


def get_pg_conn():
    """Retorna conexão com o PostgreSQL."""
    return psycopg2.connect(**PG_CFG)


def ensure_schema(pg_conn):
    """Cria o schema no PostgreSQL se não existir."""
    with pg_conn.cursor() as cur:
        cur.execute(f"CREATE SCHEMA IF NOT EXISTS {PG_SCHEMA};")
    pg_conn.commit()
    log.info("Schema '%s' garantido.", PG_SCHEMA)


def ensure_tables(pg_conn):
    """Cria todas as tabelas no PostgreSQL se não existirem."""
    with pg_conn.cursor() as cur:
        for table, ddl in TABLES_DDL.items():
            cur.execute(ddl.format(schema=PG_SCHEMA))
            log.info("Tabela %s.%s garantida.", PG_SCHEMA, table)
    pg_conn.commit()


def read_maria_table(maria_conn, table: str, columns: list[str]) -> list[dict]:
    """Lê todos os registros de uma tabela no MariaDB."""
    cols = ", ".join(f"`{c}`" for c in columns)
    sql = f"SELECT {cols} FROM `{table}`"
    with maria_conn.cursor() as cur:
        cur.execute(sql)
        return cur.fetchall()


def sync_table(maria_conn, pg_conn, table: str, columns: list[str], dry: bool = False):
    """Sincroniza uma tabela: TRUNCATE no PG + INSERT com dados do MariaDB."""
    rows = read_maria_table(maria_conn, table, columns)
    log.info("  [MariaDB] %s: %d registros lidos.", table, len(rows))

    if dry:
        return len(rows)

    with pg_conn.cursor() as cur:
        cur.execute(f"TRUNCATE TABLE {PG_SCHEMA}.{table} CASCADE;")

        if not rows:
            pg_conn.commit()
            return 0

        # Montar INSERT com execute_values para performance
        cols_pg = ", ".join(columns)
        placeholders = ", ".join(["%s"] * len(columns))
        insert_sql = f"INSERT INTO {PG_SCHEMA}.{table} ({cols_pg}) VALUES ({placeholders})"

        data = []
        for row in rows:
            values = []
            for col in columns:
                val = row.get(col)
                # Converter booleanos do MariaDB (0/1) para Python bool
                if isinstance(val, int) and col in ("is_admin", "is_super_admin", "dados_completos"):
                    val = bool(val)
                values.append(val)
            data.append(tuple(values))

        cur.executemany(insert_sql, data)

    pg_conn.commit()
    log.info("  [PostgreSQL] %s: %d registros inseridos.", table, len(rows))
    return len(rows)


# ── Tabela de controle de execução ──────────────────────────────────────────

def ensure_control_table(pg_conn):
    """Cria tabela de log de execuções ETL."""
    ddl = f"""
        CREATE TABLE IF NOT EXISTS {PG_SCHEMA}._etl_execucoes (
            id          SERIAL PRIMARY KEY,
            inicio      TIMESTAMP NOT NULL,
            fim         TIMESTAMP,
            status      VARCHAR(20) DEFAULT 'running',
            registros   INTEGER DEFAULT 0,
            detalhes    TEXT
        );
    """
    with pg_conn.cursor() as cur:
        cur.execute(ddl)
    pg_conn.commit()


def log_execution_start(pg_conn, inicio: datetime) -> int:
    """Registra início de execução e retorna o ID."""
    with pg_conn.cursor() as cur:
        cur.execute(
            f"INSERT INTO {PG_SCHEMA}._etl_execucoes (inicio) VALUES (%s) RETURNING id;",
            (inicio,),
        )
        exec_id = cur.fetchone()[0]
    pg_conn.commit()
    return exec_id


def log_execution_end(pg_conn, exec_id: int, status: str, total: int, detalhes: str):
    """Registra fim de execução."""
    fim = datetime.now()
    with pg_conn.cursor() as cur:
        cur.execute(
            f"""UPDATE {PG_SCHEMA}._etl_execucoes
               SET fim = %s, status = %s, registros = %s, detalhes = %s
               WHERE id = %s;""",
            (fim, status, total, detalhes, exec_id),
        )
    pg_conn.commit()


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    dry = "--dry" in sys.argv
    if dry:
        log.info("=== MODO DRY RUN (nenhum dado será gravado) ===")

    inicio = datetime.now()
    log.info("=" * 60)
    log.info("Iniciando ETL MariaDB -> PostgreSQL  [%s]", inicio.strftime("%Y-%m-%d %H:%M:%S"))
    log.info("=" * 60)

    maria_conn = None
    pg_conn = None
    exec_id = None
    total_registros = 0

    try:
        # Conexões
        log.info("Conectando ao MariaDB...")
        maria_conn = get_maria_conn()
        log.info("Conectando ao PostgreSQL...")
        pg_conn = get_pg_conn()

        # Preparar destino
        ensure_schema(pg_conn)
        ensure_tables(pg_conn)
        ensure_control_table(pg_conn)

        if not dry:
            exec_id = log_execution_start(pg_conn, inicio)

        # Sincronizar cada tabela
        detalhes_list = []
        for table, columns in TABLES_COLUMNS.items():
            count = sync_table(maria_conn, pg_conn, table, columns, dry=dry)
            total_registros += count
            detalhes_list.append(f"{table}: {count}")

        detalhes = "; ".join(detalhes_list)
        fim = datetime.now()
        duracao = (fim - inicio).total_seconds()

        if not dry and exec_id:
            log_execution_end(pg_conn, exec_id, "success", total_registros, detalhes)

        log.info("-" * 60)
        log.info("ETL concluído com SUCESSO em %.2f segundos.", duracao)
        log.info("Total de registros sincronizados: %d", total_registros)
        log.info("-" * 60)

    except Exception as exc:
        log.error("ERRO durante ETL: %s", exc, exc_info=True)
        if pg_conn and exec_id:
            try:
                log_execution_end(pg_conn, exec_id, "error", total_registros, str(exc))
            except Exception:
                pass
        sys.exit(1)

    finally:
        if maria_conn:
            maria_conn.close()
        if pg_conn:
            pg_conn.close()


if __name__ == "__main__":
    main()
