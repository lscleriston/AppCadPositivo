# Scripts

Diretorio para scripts operacionais e utilitarios do projeto.

## Instalação

- `install/install.sh`: script principal de instalação automatizada.
- `../install.sh`: wrapper de compatibilidade que delega para `scripts/install/install.sh`.

## Banco de Dados

- `db/migrate_20260308_admin_features.sh`: migracao idempotente da release 2026-03-08
	(colunas de ativacao/inativacao e auditoria de ultima alteracao).

## Artefatos temporários

- Arquivos locais de apoio operacional devem ficar em `../tmp/`.
- Exemplos: logs ad-hoc, arquivos `.pid` e backups locais compactados.
