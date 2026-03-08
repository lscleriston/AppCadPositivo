# AppCadPositivo

Sistema de cadastro com frontend React/Vite e backend FastAPI.

## Documentação

- Índice de documentação operacional: `docs/README.md`
- Guia de produção (VPS, serviços, deploy, troubleshooting): `docs/VPS_SETUP.md`
- Guia de instalação completa (manual e automatizada): `docs/INSTALL.md`
- Guia operacional complementar de deploy: `docs/DEPLOYMENT.md`
- Checklist de atualizacao para producao (release atual): `docs/PRODUCTION_UPDATE_20260308.md`
- Rotina de backup (dump + arquivos + OneDrive): `backup/README.md`

## Stack

- Frontend: React, TypeScript, Vite, Tailwind
- Backend: FastAPI, SQLAlchemy
- Banco: MariaDB
- Infra: Nginx + systemd

## Execução rápida (desenvolvimento)

```bash
cd /opt/AppCadPositivo
npm install
npm run dev
```

## Deploy rápido (produção)

```bash
cd /opt/AppCadPositivo
git pull origin main
npm run build
sudo systemctl restart appcadpositivo
sudo systemctl reload nginx
```

## Backup em produção

Execução manual:

```bash
cd /opt/AppCadPositivo
bash backup/run_backup.sh
```

Detalhes de configuração e cron: `backup/README.md`.
