# Backup AppCadPositivo

Este modulo faz backup de:
- Dump do banco MariaDB (via `backend/.env`)
- Compactacao da pasta `arquivos/`

Os artefatos locais sao gerados em `backup/generated/` e enviados para a pasta OneDrive:
- `AppCadastroPositivo`

## Arquivos

- `backup_onedrive.py`: gera dump/compactacao e envia para OneDrive
- `run_backup.sh`: script de execucao para cron

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
