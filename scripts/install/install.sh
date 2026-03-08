#!/bin/bash
#===============================================================================
# AppCadPositivo - Script de Instalação Automatizada
# Versão: 1.0
# Data: Janeiro 2026
# 
# Este script instala e configura toda a stack da aplicação:
# - Node.js 20.x
# - Python 3.13 + venv
# - MariaDB
# - Nginx
# - Serviço systemd
#===============================================================================

set -e  # Sair em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações padrão (podem ser alteradas via variáveis de ambiente)
APP_DIR="${APP_DIR:-/opt/AppCadPositivo}"
DB_NAME="${DB_NAME:-bd_cadpositivo}"
DB_USER="${DB_USER:-db_brian}"
DB_PASSWORD="${DB_PASSWORD:-RFAXB@r}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
SECRET_KEY="${SECRET_KEY:-sua_chave_super_secreta_aqui}"

# Função para log
log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

# Verificar se é root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        error "Este script deve ser executado como root (use sudo)"
    fi
}

# Detectar sistema operacional
detect_os() {
    if [ -f /etc/debian_version ]; then
        OS="debian"
        PKG_MANAGER="apt"
    elif [ -f /etc/redhat-release ]; then
        OS="redhat"
        PKG_MANAGER="dnf"
    else
        error "Sistema operacional não suportado. Use Debian/Ubuntu ou RHEL/CentOS."
    fi
    log "Sistema detectado: $OS"
}

# Instalar dependências do sistema
install_dependencies() {
    header "Instalando dependências do sistema"
    
    if [ "$PKG_MANAGER" = "apt" ]; then
        apt update
        apt install -y curl wget git build-essential python3 python3-pip python3-venv \
            python3.13-venv mariadb-server mariadb-client nginx
    else
        dnf install -y curl wget git python3 python3-pip python3-virtualenv \
            mariadb-server mariadb nginx
    fi
    
    log "Dependências instaladas com sucesso"
}

# Instalar Node.js
install_nodejs() {
    header "Instalando Node.js 20.x"
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        log "Node.js já instalado: $NODE_VERSION"
    else
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt install -y nodejs
        log "Node.js instalado: $(node --version)"
    fi
    
    log "npm versão: $(npm --version)"
}

# Configurar MariaDB
setup_mariadb() {
    header "Configurando MariaDB"
    
    # Iniciar e habilitar MariaDB
    systemctl enable mariadb
    systemctl start mariadb
    
    # Criar banco de dados e usuário
    log "Criando banco de dados e usuário..."
    mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS ${DB_NAME};
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'%' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'%';
FLUSH PRIVILEGES;
EOF
    
    log "MariaDB configurado com sucesso"
    log "  - Banco: ${DB_NAME}"
    log "  - Usuário: ${DB_USER}"
}

# Copiar aplicação
setup_application() {
    header "Configurando aplicação"
    
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
    
    # Criar diretório de destino
    if [ "$PROJECT_ROOT" != "$APP_DIR" ]; then
        log "Copiando aplicação para ${APP_DIR}..."
        mkdir -p /opt
        cp -r "$PROJECT_ROOT" "$APP_DIR"
    fi
    
    cd "$APP_DIR"
    
    # Configurar backend
    log "Configurando backend Python..."
    cd "$APP_DIR/backend"
    
    # Criar ambiente virtual
    python3 -m venv venv
    source venv/bin/activate
    
    # Instalar dependências Python
    pip install --upgrade pip
    pip install -r requirements.txt
    
    # Corrigir versão do bcrypt para compatibilidade com passlib
    pip install 'bcrypt==4.0.1'
    
    # Criar arquivo .env
    cat > .env <<EOF
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}

SECRET_KEY="${SECRET_KEY}"
ALGORITHM="HS256"
EOF
    
    deactivate
    
    # Configurar frontend
    log "Configurando frontend Node.js..."
    cd "$APP_DIR"
    npm install
    npm run build
    
    log "Aplicação configurada com sucesso"
}

# Configurar Nginx
setup_nginx() {
    header "Configurando Nginx"
    
    # Parar Apache se estiver rodando
    if systemctl is-active --quiet apache2; then
        log "Parando Apache..."
        systemctl stop apache2
        systemctl disable apache2
    fi
    
    # Criar configuração do Nginx
    cat > /etc/nginx/sites-available/appcadpositivo.conf <<'EOF'
server {
    listen 80;
    server_name _;
    
    # Logs
    access_log /var/log/nginx/appcadpositivo_access.log;
    error_log /var/log/nginx/appcadpositivo_error.log;

    # Frontend - arquivos estáticos do React/Vite
    location / {
        root /opt/AppCadPositivo/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
        
        # Cache para assets estáticos
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API Backend - proxy para FastAPI (rota /api/ remove o prefixo)
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }

    # Rotas diretas para o backend (sem prefixo /api)
    location /login {
        proxy_pass http://127.0.0.1:8000/login;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /register {
        proxy_pass http://127.0.0.1:8000/register;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /me {
        proxy_pass http://127.0.0.1:8000/me;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /dados {
        proxy_pass http://127.0.0.1:8000/dados;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }

    location /upload {
        proxy_pass http://127.0.0.1:8000/upload;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }

    location /users {
        proxy_pass http://127.0.0.1:8000/users;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /admin {
        proxy_pass http://127.0.0.1:8000/admin;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /atualizar {
        proxy_pass http://127.0.0.1:8000/atualizar;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ver-curriculo {
        proxy_pass http://127.0.0.1:8000/ver-curriculo;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ver-certificacao {
        proxy_pass http://127.0.0.1:8000/ver-certificacao;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ver-graduacao {
        proxy_pass http://127.0.0.1:8000/ver-graduacao;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /relatorio_bi {
        proxy_pass http://127.0.0.1:8000/relatorio_bi;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Swagger/API Docs
    location /docs {
        proxy_pass http://127.0.0.1:8000/docs;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /openapi.json {
        proxy_pass http://127.0.0.1:8000/openapi.json;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /redoc {
        proxy_pass http://127.0.0.1:8000/redoc;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript application/json;
    gzip_disable "MSIE [1-6]\.";
}
EOF
    
    # Ativar configuração
    rm -f /etc/nginx/sites-enabled/default
    ln -sf /etc/nginx/sites-available/appcadpositivo.conf /etc/nginx/sites-enabled/
    
    # Testar e reiniciar
    nginx -t
    systemctl enable nginx
    systemctl restart nginx
    
    log "Nginx configurado com sucesso"
}

# Configurar serviço systemd
setup_systemd() {
    header "Configurando serviço systemd"
    
    cat > /etc/systemd/system/appcadpositivo.service <<EOF
[Unit]
Description=AppCadPositivo Backend (FastAPI/Uvicorn)
After=network.target mariadb.service
Wants=mariadb.service

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=${APP_DIR}/backend
Environment=PYTHONUNBUFFERED=1
Environment=PATH=${APP_DIR}/backend/venv/bin:/usr/bin:/bin
ExecStart=${APP_DIR}/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable appcadpositivo
    systemctl start appcadpositivo
    
    log "Serviço systemd configurado com sucesso"
}

# Restaurar backup do banco (opcional)
restore_backup() {
    if [ -n "$BACKUP_FILE" ] && [ -f "$BACKUP_FILE" ]; then
        header "Restaurando backup do banco de dados"
        mysql -u "$DB_USER" -p"$DB_PASSWORD" -h "$DB_HOST" "$DB_NAME" < "$BACKUP_FILE"
        log "Backup restaurado com sucesso"
    fi
}

# Verificar instalação
verify_installation() {
    header "Verificando instalação"
    
    # Verificar serviços
    echo ""
    log "Status dos serviços:"
    
    if systemctl is-active --quiet appcadpositivo; then
        echo -e "  ${GREEN}✓${NC} appcadpositivo: ativo"
    else
        echo -e "  ${RED}✗${NC} appcadpositivo: inativo"
    fi
    
    if systemctl is-active --quiet nginx; then
        echo -e "  ${GREEN}✓${NC} nginx: ativo"
    else
        echo -e "  ${RED}✗${NC} nginx: inativo"
    fi
    
    if systemctl is-active --quiet mariadb; then
        echo -e "  ${GREEN}✓${NC} mariadb: ativo"
    else
        echo -e "  ${RED}✗${NC} mariadb: inativo"
    fi
    
    # Testar API
    echo ""
    log "Testando API..."
    sleep 2
    
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/docs | grep -q "200"; then
        echo -e "  ${GREEN}✓${NC} API Backend respondendo"
    else
        echo -e "  ${YELLOW}!${NC} API Backend pode demorar para iniciar"
    fi
    
    if curl -s -o /dev/null -w "%{http_code}" http://localhost/ | grep -q "200"; then
        echo -e "  ${GREEN}✓${NC} Frontend respondendo"
    else
        echo -e "  ${RED}✗${NC} Frontend não respondendo"
    fi
    
    # Obter IP
    IP=$(hostname -I | awk '{print $1}')
    
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN} INSTALAÇÃO CONCLUÍDA COM SUCESSO!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "Acesse a aplicação em:"
    echo -e "  ${BLUE}http://${IP}/${NC}"
    echo ""
    echo -e "API Docs (Swagger):"
    echo -e "  ${BLUE}http://${IP}/docs${NC}"
    echo ""
    echo -e "Credenciais do banco:"
    echo -e "  Host: ${DB_HOST}"
    echo -e "  Porta: ${DB_PORT}"
    echo -e "  Banco: ${DB_NAME}"
    echo -e "  Usuário: ${DB_USER}"
    echo -e "  Senha: ${DB_PASSWORD}"
    echo ""
}

# Mostrar ajuda
show_help() {
    echo "AppCadPositivo - Script de Instalação"
    echo ""
    echo "Uso: $0 [opções]"
    echo ""
    echo "Opções:"
    echo "  -h, --help          Mostrar esta ajuda"
    echo "  -b, --backup FILE   Restaurar backup do banco após instalação"
    echo "  --db-name NAME      Nome do banco de dados (padrão: bd_cadpositivo)"
    echo "  --db-user USER      Usuário do banco (padrão: db_brian)"
    echo "  --db-pass PASS      Senha do banco (padrão: RFAXB@r)"
    echo "  --app-dir DIR       Diretório de instalação (padrão: /opt/AppCadPositivo)"
    echo ""
    echo "Exemplo:"
    echo "  $0 -b /root/backup.sql --db-name meu_banco"
    echo ""
}

# Processar argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -b|--backup)
            BACKUP_FILE="$2"
            shift 2
            ;;
        --db-name)
            DB_NAME="$2"
            shift 2
            ;;
        --db-user)
            DB_USER="$2"
            shift 2
            ;;
        --db-pass)
            DB_PASSWORD="$2"
            shift 2
            ;;
        --app-dir)
            APP_DIR="$2"
            shift 2
            ;;
        *)
            error "Opção desconhecida: $1"
            ;;
    esac
done

# Executar instalação
main() {
    header "AppCadPositivo - Instalação Automatizada"
    
    check_root
    detect_os
    install_dependencies
    install_nodejs
    setup_mariadb
    setup_application
    setup_nginx
    setup_systemd
    restore_backup
    verify_installation
}

main
