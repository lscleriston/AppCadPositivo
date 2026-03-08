# Backup AppCadPositivo

## Navegação

- Visão geral do projeto: `../README.md`
- Operação na VPS: `../docs/VPS_SETUP.md`

Este modulo faz backup de:
- Dump do banco MariaDB (via `backend/.env`)
- Compactacao da pasta `arquivos/`

Os artefatos locais sao gerados em `backup/generated/` e enviados para a pasta OneDrive:
- `AppCadastroPositivo`

## Arquivos

- `backup_onedrive.py`: gera dump/compactacao e envia para OneDrive
- `run_backup.sh`: script de execucao para cron
- `restore_onedrive.py`: baixa backups do OneDrive e aplica restore
- `run_restore.sh`: atalho para restore mais recente

## Dependencias

- `python3`
- `requests`
- `mysqldump`
- `tar`

## Credenciais OneDrive

O script reaproveita as credenciais de `zabbix.py` quando disponiveis:
- `ONEDRIVE_CLIENT_ID`
- `ONEDRIVE_CLIENT_SECRET`
- `ONEDRIVE_TENANT_ID`
- `TOKEN_PATH`

Tambem e possivel sobrescrever por variaveis de ambiente:
- `ONEDRIVE_CLIENT_ID`
- `ONEDRIVE_CLIENT_SECRET`
- `ONEDRIVE_TENANT_ID`
- `ONEDRIVE_TOKEN_PATH`

## Execucao manual

```bash
cd /opt/AppCadPositivo
bash backup/run_backup.sh
```

## Execucao automatica (cron)

A rotina diaria esta configurada para `02:30` no servidor:

```bash
crontab -l | grep "BACKUP APPCADPOSITIVO" -A 4
```

## Restore do OneDrive

1. Validar credenciais e token (`ONEDRIVE_*` no `.env` e `backup/tokens.json`).
2. Baixar os arquivos do backup desejado.
3. Aplicar restore de banco e pasta `arquivos`.

### Opcao A: restore mais recente (recomendado)

Preview (somente download):

```bash
cd /opt/AppCadPositivo
python3 backup/restore_onedrive.py --latest
```

Aplicar restore:

```bash
cd /opt/AppCadPositivo
bash backup/run_restore.sh
```

### Opcao B: restore de arquivos especificos

```bash
cd /opt/AppCadPositivo
python3 backup/restore_onedrive.py \
	--db-file db_dump_YYYYMMDD_HHMMSS.sql \
	--arquivos-file arquivos_YYYYMMDD_HHMMSS.tar.gz \
	--apply
```

### Restore parcial

- Somente banco: `python3 backup/restore_onedrive.py --latest --apply --skip-arquivos`
- Somente arquivos: `python3 backup/restore_onedrive.py --latest --apply --skip-db`

Arquivos baixados localmente ficam em `backup/restore_tmp/`.
