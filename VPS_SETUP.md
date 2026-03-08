# Guia de Deploy na VPS - AppCadPositivo

## Referências Rápidas

- Visão geral do projeto: `README.md`
- Instalação completa: `INSTALL.md`
- Rotina de backup e OneDrive: `backup/README.md`

## Status: ✅ PRONTO PARA PRODUÇÃO

A aplicação AppCadPositivo foi configurada e testada com sucesso na VPS. Segue o guia completo de setup e manutenção.

---

## Arquitetura da Aplicação

```
┌─────────────────────────────────────────────┐
│  Frontend (Vite + React + TypeScript)       │
│  Build output: /opt/AppCadPositivo/dist     │
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        v                     v
  ┌─────────────┐      ┌─────────────┐
  │  Nginx      │      │  FastAPI    │
  │  Port 80    │      │  Port 8000  │
  │  (porta 80) │      │  (uvicorn)  │
  └──────┬──────┘      └──────┬──────┘
         │                    │
         │    Reverse Proxy   │
         └─────────┬──────────┘
                   │
                   v
            ┌──────────────┐
            │  MariaDB     │
            │  Port 3306   │
            │  localhost   │
            └──────────────┘
```

---

## Stack Técnico

| Componente | Versão | Localização |
|-----------|--------|-------------|
| Node.js | 18.20.8 | Sistema |
| Python | 3.13 | Sistema |
| Nginx | 1.30+ | Sistema |
| MariaDB | 11.8.3 | Sistema |
| Vite | 7.1.5 | Frontend |
| FastAPI | 0.122.0 | Backend |
| React | 19.1.1 | Frontend |

---

## Estrutura do Projeto

```
/opt/AppCadPositivo/
├── backend/
│   ├── .venv/                    # Virtualenv Python
│   ├── app/
│   │   ├── main.py              # Aplicação FastAPI
│   │   ├── database.py           # Configuração SQLAlchemy
│   │   ├── models.py             # Modelos do banco
│   │   ├── schemas.py            # Schemas Pydantic
│   │   ├── auth.py               # Autenticação JWT
│   │   └── routers/              # Endpoints da API
│   ├── requirements.txt           # Dependências Python
│   └── .env                       # Variáveis de ambiente
├── dist/                          # Frontend compilado (saída Vite)
├── src/                           # Código-fonte React
├── package.json                   # Dependências Node
├── vite.config.ts                 # Configuração Vite
└── nginx-config/                  # Configurações Nginx
```

---

## Serviços Systemd

### 1. **appcadpositivo.service** - Backend FastAPI

**Localização:** `/etc/systemd/system/appcadpositivo.service`

**Status e Controle:**
```bash
# Ver status
systemctl status appcadpositivo

# Iniciar
systemctl start appcadpositivo

# Parar
systemctl stop appcadpositivo

# Reiniciar
systemctl restart appcadpositivo

# Ver logs em tempo real
journalctl -u appcadpositivo -f

# Ver últimas 50 linhas
journalctl -u appcadpositivo -n 50
```

**Configuração:**
- **User:** root
- **Porta:** 8000
- **WorkingDirectory:** `/opt/AppCadPositivo/backend`
- **Restart:** Automático (sempre reinicia em caso de falha)

---

## Variáveis de Ambiente

**Arquivo:** `/opt/AppCadPositivo/backend/.env`

```env
DB_HOST=127.0.0.1          # Host MariaDB local
DB_PORT=3306                # Porta MariaDB
DB_USER=db_brian            # Usuário do BD
DB_PASSWORD=RFAXB@r         # Senha do BD
DB_NAME=bd_cadpositivo      # Nome do BD

SECRET_KEY="sua_chave_super_secreta_aqui"  # Chave JWT
ALGORITHM="HS256"           # Algoritmo de criptografia

# Power BI (Azure AD App Registration)
PBI_TENANT_ID="seu_tenant_id"
PBI_CLIENT_ID="seu_client_id"
PBI_CLIENT_SECRET="seu_client_secret"
PBI_GROUP_ID="seu_workspace_group_id"
PBI_REPORT_ID="seu_report_id"
```

⚠️ **Importante:** Alterar `SECRET_KEY` para uma chave forte em produção e manter `PBI_CLIENT_SECRET` apenas em `backend/.env`.

---

## Nginx - Configuração de Reverse Proxy

**Arquivo:** `/etc/nginx/sites-available/appcadpositivo.conf`

**Rotas:**
- `/` → Serve frontend estático (React - port 80)
- `/api/*` → Proxy para backend FastAPI (port 8000)
- `/docs` → Swagger API docs (FastAPI automático)

**Comandos:**
```bash
# Testar configuração
nginx -t

# Recarregar (sem desligar)
systemctl reload nginx

# Status
systemctl status nginx

# Ver logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## MariaDB - Banco de Dados

**Credenciais:**
- **Host:** 127.0.0.1
- **Porto:** 3306
- **Usuário:** db_brian
- **Senha:** RFAXB@r
- **Banco:** bd_cadpositivo

**Comandos Úteis:**
```bash
# Conectar ao MariaDB
mysql -u db_brian -pRFAXB@r -h 127.0.0.1

# Ver status do serviço
systemctl status mariadb

# Reiniciar
systemctl restart mariadb

# Fazer backup
mysqldump -u db_brian -pRFAXB@r bd_cadpositivo > backup.sql

# Restaurar backup
mysql -u db_brian -pRFAXB@r bd_cadpositivo < backup.sql
```

---

## Deploy de Nova Versão

Quando você fizer alterações no código (frontend ou backend):

```bash
# 1. Ir para o diretório do projeto
cd /opt/AppCadPositivo

# 2. Fazer pull das alterações do GitHub
git pull origin main

# 3. Se há mudanças no frontend (src/)
npm run build

# 4. Se há mudanças no backend (requirements.txt)
cd backend
. .venv/bin/activate
pip install -r requirements.txt
cd ..

# 5. Reiniciar os serviços
systemctl restart appcadpositivo
systemctl reload nginx

# 6. Verificar status
systemctl status appcadpositivo
curl -I http://localhost/
```

---

## Monitoramento e Diagnóstico

### Status Geral
```bash
# Ver todos os serviços
systemctl status appcadpositivo nginx mariadb

# Ver portas ativas
ss -tulpn | grep -E ':(80|8000|3306)'
```

### Logs
```bash
# Últimas 100 linhas do backend
journalctl -u appcadpositivo -n 100 --no-pager

# Logs de nginx
tail -100 /var/log/nginx/access.log
tail -100 /var/log/nginx/error.log

# Verificar se há erros
grep -i error /var/log/nginx/error.log | tail -20
journalctl -u appcadpositivo | grep -i error | tail -20
```

### Testes Rápidos
```bash
# Frontend (port 80)
curl -I http://localhost/

# API (port 8000)
curl -I http://localhost:8000/

# API Docs (Swagger)
curl -I http://localhost:8000/docs

# Teste de conectividade do BD
mysql -u db_brian -pRFAXB@r -h 127.0.0.1 -e "SELECT 1;"
```

---

## Troubleshooting

### Problema: Serviço não inicia
```bash
# 1. Ver logs detalhados
journalctl -u appcadpositivo -n 50 --no-pager

# 2. Testar inicialização manual
cd /opt/AppCadPositivo/backend
. .venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001

# 3. Se houver erro de BD, verificar MariaDB
systemctl status mariadb
mysql -u db_brian -pRFAXB@r -h 127.0.0.1 -e "SHOW DATABASES;"
```

### Problema: Porta 8000 já em uso
```bash
# Encontrar processo usando porta 8000
lsof -i :8000

# Matar processo
kill -9 <PID>

# Ou via systemd
systemctl restart appcadpositivo
```

### Problema: Nginx não encontra frontend
```bash
# Verificar se dist/ existe
ls -la /opt/AppCadPositivo/dist/

# Se não existir, recompilar
cd /opt/AppCadPositivo
npm run build

# Recarregar nginx
systemctl reload nginx
```

### Problema: Conexão recusada ao BD
```bash
# Verificar se MariaDB está rodando
systemctl status mariadb

# Testar conectividade
mysql -u db_brian -pRFAXB@r -h 127.0.0.1 -e "SELECT 1;"

# Reiniciar MariaDB
systemctl restart mariadb
```

---

## Backup e Restauração

### Backup Completo
```bash
# Backup completo (dump + arquivos + upload OneDrive)
/bin/bash /opt/AppCadPositivo/backup/run_backup.sh

# Ver logs da rotina
tail -f /opt/AppCadPositivo/backup/logs/backup.log

# Verificar agenda no cron
crontab -l | grep "BACKUP APPCADPOSITIVO" -A 4
```

### Restauração
```bash
# Restauracao usa os artefatos (dump e tar.gz) disponiveis no OneDrive
# Baixe os arquivos para o servidor e execute:
mysql -u db_brian -pRFAXB@r bd_cadpositivo < db_dump_YYYYMMDD_HHMMSS.sql
tar -xzf arquivos_YYYYMMDD_HHMMSS.tar.gz -C /opt/AppCadPositivo
```

Detalhes completos: `backup/README.md`.

---

## Segurança - Próximos Passos

Para ambiente de produção, recomenda-se:

1. **SSL/HTTPS com Certbot**
   ```bash
   apt install -y certbot python3-certbot-nginx
   certbot --nginx -d seu-dominio.com
   ```

2. **Firewall (ufw)**
   ```bash
   ufw allow 22/tcp
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw enable
   ```

3. **Atualizar SECRET_KEY em .env** para uma chave criptográfica forte

4. **Configurar CORS adequadamente** em `app/main.py` (remover * quando possível)

5. **Rate limiting e proteção contra DDoS** com nginx

---

## Informações de Acesso

| Serviço | URL | Porta | Credenciais |
|---------|-----|-------|-------------|
| Frontend | http://localhost/ | 80 | N/A |
| API | http://localhost:8000/ | 8000 | N/A |
| Swagger Docs | http://localhost:8000/docs | 8000 | N/A |
| Redoc | http://localhost:8000/redoc | 8000 | N/A |
| MariaDB | localhost:3306 | 3306 | db_brian / RFAXB@r |

---

## Contato e Suporte

- **Data de Setup:** 28 de Novembro de 2025
- **Versão:** 1.0
- **Mantido por:** DevOps/Admin

Para issues ou questions, verifique:
1. Logs do serviço: `journalctl -u appcadpositivo -f`
2. Logs do nginx: `tail -f /var/log/nginx/error.log`
3. Conectividade: `curl -v http://localhost/`

---

**Última atualização:** 28 de Novembro de 2025 17:15 UTC
