# ETL MariaDB → PostgreSQL (AppCadPositivo)

## Visão Geral

Este módulo replica os dados do MariaDB (banco `bd_cadpositivo`) para o
PostgreSQL (banco `dw_positivo`, schema `dw_certificacoes_cad`) para consumo
por relatórios Power BI.

### Arquitetura

```
┌─────────────────────┐         ┌──────────────────────────────────┐
│  MariaDB (3306)     │  ───►   │  PostgreSQL (5432)               │
│  bd_cadpositivo     │  leitura│  dw_positivo                     │
│                     │  direta │    └─ schema dw_certificacoes_cad│
└─────────────────────┘         └──────────────────────────────────┘
        ▲                                      │
        │                                      ▼
   App FastAPI                          Power BI Gateway
```

### Tabelas sincronizadas

| Tabela MariaDB                   | Registros (aprox.) |
|----------------------------------|--------------------|
| tb_dados                         | 185                |
| tb_usuario (sem password)        | 1149               |
| tb_certificacoes                 | 235                |
| tb_dados_certificacao            | 373                |
| tb_dados_conhecimentos           | 858                |
| tb_dados_cursos                  | 876                |
| tb_dados_operacao_compartilhada  | 203                |
| tb_operacoes                     | 23                 |
| tb_torreatendimento              | 19                 |
| tb_torres_atendimento            | 0                  |

> **Nota de segurança:** A coluna `password` de `tb_usuario` é excluída da
> sincronização.

---

## Estrutura de Arquivos

```
etl_postgresql/
├── .env                      # Variáveis de conexão (não commitar!)
├── sync_mariadb_to_pg.py     # Script principal de sincronização
├── run_sync.sh               # Wrapper para execução via cron (lock)
├── README.md                 # Esta documentação
└── logs/
    └── sync.log              # Log de execuções (criado automaticamente)
```

---

## Configuração

### 1. Variáveis de ambiente (`.env`)

```env
# MariaDB (origem)
MARIA_HOST=127.0.0.1
MARIA_PORT=3306
MARIA_DB=bd_cadpositivo
MARIA_USER=db_brian
MARIA_PASSWORD=RFAXB@r

# PostgreSQL (destino)
PG_HOST=127.0.0.1
PG_PORT=5432
PG_DB=dw_positivo
PG_USER=db_user
PG_PASSWORD=<sua_senha>
PG_SCHEMA=dw_certificacoes_cad
```

### 2. Dependências Python

As bibliotecas necessárias já estão instaladas no sistema:
- `pymysql`
- `psycopg2-binary`
- `python-dotenv`

Caso precise instalar manualmente:
```bash
pip3 install pymysql psycopg2-binary python-dotenv
```

---

## Uso

### Execução manual

```bash
# Execução normal (sincroniza dados)
python3 /opt/AppCadPositivo/etl_postgresql/sync_mariadb_to_pg.py

# Dry run (apenas mostra contagens, não grava)
python3 /opt/AppCadPositivo/etl_postgresql/sync_mariadb_to_pg.py --dry
```

### Via wrapper (com lock de concorrência)

```bash
bash /opt/AppCadPositivo/etl_postgresql/run_sync.sh
```

---

## Rotina Automática (Cron)

O cron está configurado para executar a cada **30 minutos**:

```
*/30 * * * * /bin/bash /opt/AppCadPositivo/etl_postgresql/run_sync.sh >> /opt/AppCadPositivo/etl_postgresql/logs/cron.log 2>&1
```

### Gerenciar cron

```bash
# Ver cron atual
crontab -l

# Editar cron
crontab -e

# Desabilitar temporariamente (comentar a linha no crontab)
```

---

## Monitoramento

### Logs

```bash
# Log principal
tail -f /opt/AppCadPositivo/etl_postgresql/logs/sync.log

# Log do cron
tail -f /opt/AppCadPositivo/etl_postgresql/logs/cron.log
```

### Tabela de controle

O script mantém uma tabela `_etl_execucoes` no schema `dw_certificacoes_cad`
com o histórico de execuções:

```sql
SELECT * FROM dw_certificacoes_cad._etl_execucoes ORDER BY id DESC LIMIT 10;
```

| Coluna    | Descrição                        |
|-----------|----------------------------------|
| id        | ID da execução                   |
| inicio    | Timestamp de início              |
| fim       | Timestamp de término             |
| status    | `success` ou `error`             |
| registros | Total de registros sincronizados |
| detalhes  | Contagem por tabela              |

---

## Troubleshooting

### Erro de conexão MariaDB
```bash
mysql -u db_brian -p'RFAXB@r' -h 127.0.0.1 bd_cadpositivo -e "SELECT 1;"
```

### Erro de conexão PostgreSQL
```bash
PGPASSWORD='<senha>' psql -h 127.0.0.1 -p 5432 -U db_user -d dw_positivo -c "SELECT 1;"
```

### Verificar se schema e tabelas foram criados
```bash
PGPASSWORD='<senha>' psql -h 127.0.0.1 -U db_user -d dw_positivo -c "
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'dw_certificacoes_cad' ORDER BY table_name;
"
```

### ETL travado (lock file)
```bash
# Remover lock manualmente se necessário
rm -f /tmp/etl_cadpositivo.lock
```
