# AppCadPositivo - Guia Completo de Instalação e Deploy

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Requisitos](#requisitos)
3. [Instalação Rápida (Script Automatizado)](#instalação-rápida)
4. [Instalação Manual](#instalação-manual)
5. [Configuração](#configuração)
6. [Comandos de Gerenciamento](#comandos-de-gerenciamento)
7. [Troubleshooting](#troubleshooting)
8. [Backup e Restauração](#backup-e-restauração)

---

## 🎯 Visão Geral

O AppCadPositivo é uma aplicação web composta por:

| Componente | Tecnologia | Porta |
|------------|------------|-------|
| Frontend | React + Vite + TypeScript | 80 (Nginx) |
| Backend | FastAPI + Python | 8000 |
| Banco de Dados | MariaDB | 3306 |
| Web Server | Nginx | 80 |

### Arquitetura

```
┌─────────────────────────────────────────────┐
│           Navegador do Usuário              │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│              Nginx (porta 80)               │
│  ┌─────────────┐     ┌─────────────────┐   │
│  │  /          │     │  /api/*         │   │
│  │  Frontend   │     │  Proxy Backend  │   │
│  │  Estático   │     │                 │   │
│  └─────────────┘     └────────┬────────┘   │
└───────────────────────────────┼─────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────┐
│         FastAPI/Uvicorn (porta 8000)        │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│           MariaDB (porta 3306)              │
└─────────────────────────────────────────────┘
```

---

## 📦 Requisitos

### Sistema Operacional
- Debian 11/12 ou Ubuntu 20.04/22.04/24.04
- Mínimo 2GB RAM
- Mínimo 10GB disco

### Software (instalado automaticamente)
- Node.js 20.x
- Python 3.11+
- MariaDB 10.x+
- Nginx

---

## 🚀 Instalação Rápida

### Opção 1: Script Automatizado

```bash
# 1. Extrair o projeto (se compactado)
tar -xzf AppCadPositivo.tar.gz
cd AppCadPositivo

# 2. Dar permissão de execução ao script
chmod +x install.sh

# 3. Executar como root
sudo ./install.sh

# 4. (Opcional) Restaurar backup do banco
sudo ./install.sh -b /caminho/para/backup.sql
```

### Opções do Script

```bash
./install.sh [opções]

Opções:
  -h, --help          Mostrar ajuda
  -b, --backup FILE   Restaurar backup do banco após instalação
  --db-name NAME      Nome do banco de dados (padrão: bd_cadpositivo)
  --db-user USER      Usuário do banco (padrão: db_brian)
  --db-pass PASS      Senha do banco (padrão: RFAXB@r)
  --app-dir DIR       Diretório de instalação (padrão: /opt/AppCadPositivo)
```

---

## 🔧 Instalação Manual

### Passo 1: Instalar Dependências

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependências básicas
sudo apt install -y curl wget git build-essential

# Instalar Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# Instalar Python e venv
sudo apt install -y python3 python3-pip python3-venv python3.13-venv

# Instalar MariaDB
sudo apt install -y mariadb-server mariadb-client

# Instalar Nginx
sudo apt install -y nginx
```

### Passo 2: Configurar MariaDB

```bash
# Iniciar e habilitar MariaDB
sudo systemctl enable mariadb
sudo systemctl start mariadb

# Criar banco e usuário
sudo mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS bd_cadpositivo;
CREATE USER IF NOT EXISTS 'db_brian'@'localhost' IDENTIFIED BY 'RFAXB@r';
CREATE USER IF NOT EXISTS 'db_brian'@'%' IDENTIFIED BY 'RFAXB@r';
GRANT ALL PRIVILEGES ON bd_cadpositivo.* TO 'db_brian'@'localhost';
GRANT ALL PRIVILEGES ON bd_cadpositivo.* TO 'db_brian'@'%';
FLUSH PRIVILEGES;
EOF

# (Opcional) Restaurar backup
mysql -u db_brian -p'RFAXB@r' bd_cadpositivo < backup.sql
```

### Passo 3: Copiar Aplicação

```bash
# Criar diretório
sudo mkdir -p /opt/AppCadPositivo

# Copiar arquivos
sudo cp -r . /opt/AppCadPositivo/
cd /opt/AppCadPositivo
```

### Passo 4: Configurar Backend

```bash
cd /opt/AppCadPositivo/backend

# Criar ambiente virtual
python3 -m venv venv
source venv/bin/activate

# Instalar dependências
pip install --upgrade pip
pip install -r requirements.txt

# IMPORTANTE: Corrigir versão do bcrypt
pip install 'bcrypt==4.0.1'

# Criar arquivo .env
cat > .env <<EOF
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=db_brian
DB_PASSWORD=RFAXB@r
DB_NAME=bd_cadpositivo

SECRET_KEY="sua_chave_super_secreta_aqui"
ALGORITHM="HS256"
EOF

deactivate
```

### Passo 5: Configurar Frontend

```bash
cd /opt/AppCadPositivo

# Instalar dependências
npm install

# Compilar para produção
npm run build
```

### Passo 6: Configurar Nginx

```bash
# Parar Apache se estiver rodando
sudo systemctl stop apache2 2>/dev/null
sudo systemctl disable apache2 2>/dev/null

# Criar configuração
sudo nano /etc/nginx/sites-available/appcadpositivo.conf
```

Cole o conteúdo:

```nginx
server {
    listen 80;
    server_name _;
    
    access_log /var/log/nginx/appcadpositivo_access.log;
    error_log /var/log/nginx/appcadpositivo_error.log;

    # Frontend
    location / {
        root /opt/AppCadPositivo/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API Backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }

    # Rotas diretas do backend
    location ~ ^/(login|register|me|dados|upload|users|admin|atualizar|ver-curriculo|ver-certificacao|ver-graduacao|relatorio_bi) {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }

    # API Docs
    location /docs {
        proxy_pass http://127.0.0.1:8000/docs;
        proxy_set_header Host $host;
    }

    location /openapi.json {
        proxy_pass http://127.0.0.1:8000/openapi.json;
    }

    location /redoc {
        proxy_pass http://127.0.0.1:8000/redoc;
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}
```

Ativar configuração:

```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/appcadpositivo.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Passo 7: Configurar Serviço Systemd

```bash
sudo nano /etc/systemd/system/appcadpositivo.service
```

Cole o conteúdo:

```ini
[Unit]
Description=AppCadPositivo Backend (FastAPI/Uvicorn)
After=network.target mariadb.service
Wants=mariadb.service

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=/opt/AppCadPositivo/backend
Environment=PYTHONUNBUFFERED=1
Environment=PATH=/opt/AppCadPositivo/backend/venv/bin:/usr/bin:/bin
ExecStart=/opt/AppCadPositivo/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Ativar serviço:

```bash
sudo systemctl daemon-reload
sudo systemctl enable appcadpositivo
sudo systemctl start appcadpositivo
```

---

## ⚙️ Configuração

### Variáveis de Ambiente (backend/.env)

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| DB_HOST | Host do MariaDB | 127.0.0.1 |
| DB_PORT | Porta do MariaDB | 3306 |
| DB_USER | Usuário do banco | db_brian |
| DB_PASSWORD | Senha do banco | RFAXB@r |
| DB_NAME | Nome do banco | bd_cadpositivo |
| SECRET_KEY | Chave JWT | (definir) |
| ALGORITHM | Algoritmo JWT | HS256 |
| PBI_TENANT_ID | Tenant ID do Azure AD (Power BI) | (definir) |
| PBI_CLIENT_ID | Client ID do App Registration | (definir) |
| PBI_CLIENT_SECRET | Client Secret do App Registration | (definir) |
| PBI_GROUP_ID | Workspace (Group) ID do Power BI | (definir) |
| PBI_REPORT_ID | Report ID do Power BI | (definir) |

**Produção:** não versionar `backend/.env` e nunca manter segredos hardcoded no código.

### Configurar SSL/HTTPS (Recomendado)

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obter certificado
sudo certbot --nginx -d seu-dominio.com

# Renovação automática
sudo certbot renew --dry-run
```

---

## 🎮 Comandos de Gerenciamento

### Serviço Backend

```bash
# Status
sudo systemctl status appcadpositivo

# Iniciar
sudo systemctl start appcadpositivo

# Parar
sudo systemctl stop appcadpositivo

# Reiniciar
sudo systemctl restart appcadpositivo

# Ver logs em tempo real
sudo journalctl -u appcadpositivo -f

# Ver últimos 100 logs
sudo journalctl -u appcadpositivo -n 100
```

### Nginx

```bash
# Status
sudo systemctl status nginx

# Testar configuração
sudo nginx -t

# Recarregar (sem downtime)
sudo systemctl reload nginx

# Ver logs
sudo tail -f /var/log/nginx/appcadpositivo_access.log
sudo tail -f /var/log/nginx/appcadpositivo_error.log
```

### MariaDB

```bash
# Status
sudo systemctl status mariadb

# Conectar ao banco
mysql -u db_brian -p'RFAXB@r' bd_cadpositivo

# Ver tabelas
mysql -u db_brian -p'RFAXB@r' bd_cadpositivo -e "SHOW TABLES;"
```

### Verificar Portas

```bash
# Ver portas ativas
sudo ss -tulpn | grep -E ':(80|8000|3306)'
```

---

## 🔥 Troubleshooting

### Erro 405 Method Not Allowed

**Causa:** Frontend chamando `/api/login` mas Nginx não configurado corretamente.

**Solução:**
```bash
# Verificar se a rota /api/ está no Nginx
grep -A5 "location /api/" /etc/nginx/sites-available/appcadpositivo.conf

# Recarregar Nginx
sudo nginx -t && sudo systemctl reload nginx
```

### Erro de Login (401 Unauthorized)

**Causa:** Versão do bcrypt incompatível com passlib.

**Solução:**
```bash
cd /opt/AppCadPositivo/backend
source venv/bin/activate
pip install 'bcrypt==4.0.1'
deactivate
sudo systemctl restart appcadpositivo
```

### Backend não inicia

```bash
# Ver logs detalhados
sudo journalctl -u appcadpositivo -n 50 --no-pager

# Testar manualmente
cd /opt/AppCadPositivo/backend
source venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001
```

### Porta já em uso

```bash
# Encontrar processo
sudo lsof -i :8000

# Matar processo
sudo kill -9 <PID>

# Ou parar todos os uvicorn
sudo pkill -f uvicorn
```

### Conexão recusada ao banco

```bash
# Verificar MariaDB
sudo systemctl status mariadb

# Testar conexão
mysql -u db_brian -p'RFAXB@r' -h 127.0.0.1 -e "SELECT 1;"

# Reiniciar MariaDB
sudo systemctl restart mariadb
```

---

## 💾 Backup e Restauração

### Backup do Banco

```bash
# Backup completo
mysqldump -u db_brian -p'RFAXB@r' bd_cadpositivo > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup com compressão
mysqldump -u db_brian -p'RFAXB@r' bd_cadpositivo | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Restaurar Backup

```bash
# Restaurar SQL
mysql -u db_brian -p'RFAXB@r' bd_cadpositivo < backup.sql

# Restaurar comprimido
gunzip < backup.sql.gz | mysql -u db_brian -p'RFAXB@r' bd_cadpositivo
```

### Backup da Aplicação

```bash
# Backup completo
tar -czf appcadpositivo_backup_$(date +%Y%m%d).tar.gz /opt/AppCadPositivo/

# Backup dos arquivos de usuário
tar -czf arquivos_backup_$(date +%Y%m%d).tar.gz /opt/AppCadPositivo/arquivos/
```

### Script de Backup Automático

```bash
# Criar script
cat > /opt/backup_appcadpositivo.sh <<'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup do banco
mysqldump -u db_brian -p'RFAXB@r' bd_cadpositivo | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup dos arquivos
tar -czf $BACKUP_DIR/arquivos_$DATE.tar.gz /opt/AppCadPositivo/arquivos/

# Manter apenas últimos 7 backups
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup concluído: $DATE"
EOF

chmod +x /opt/backup_appcadpositivo.sh

# Adicionar ao cron (diário às 2h)
echo "0 2 * * * /opt/backup_appcadpositivo.sh" | sudo crontab -
```

---

## 📊 URLs de Acesso

| Serviço | URL |
|---------|-----|
| Frontend | http://SEU_IP/ |
| API | http://SEU_IP/api/ |
| Swagger Docs | http://SEU_IP/docs |
| Redoc | http://SEU_IP/redoc |

---

## 📝 Notas Importantes

1. **Acesse pelo IP**, não por `localhost` (o frontend faz chamadas para `/api/`)
2. **bcrypt deve ser versão 4.0.1** para compatibilidade com passlib
3. **Sempre reinicie o serviço** após alterações no backend
4. **Use HTTPS em produção** com certificado SSL
5. **Altere a SECRET_KEY** para uma chave forte em produção

---

*Última atualização: Janeiro 2026*
