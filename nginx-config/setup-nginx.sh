#!/bin/bash

# Script para configurar Nginx com AppCadPositivo
# Execute como root: sudo bash setup-nginx.sh

set -e

echo "🚀 Configurando Nginx para AppCadPositivo..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para log colorido
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar se está executando como root
if [[ $EUID -ne 0 ]]; then
   log_error "Este script deve ser executado como root (use sudo)"
   exit 1
fi

# Variáveis - AJUSTE CONFORME SEU DOMÍNIO
DOMAIN="seu-dominio.com"
EMAIL="seu-email@dominio.com"

echo "Digite seu domínio (ex: meuapp.com.br):"
read -r DOMAIN

echo "Digite seu email para o certificado SSL:"
read -r EMAIL

log_info "Configurando para domínio: $DOMAIN"

# 1. Parar o serviço FastAPI temporariamente
log_info "Parando serviço FastAPI..."
systemctl stop appcadpositivo || true

# 2. Copiar configuração do Nginx
log_info "Copiando configuração do Nginx..."
cp /opt/AppCadPositivo/nginx-config/appcadpositivo.conf /etc/nginx/sites-available/

# 3. Substituir domínio na configuração
log_info "Configurando domínio: $DOMAIN"
sed -i "s/seu-dominio.com/$DOMAIN/g" /etc/nginx/sites-available/appcadpositivo.conf

# 4. Habilitar site
log_info "Habilitando site no Nginx..."
ln -sf /etc/nginx/sites-available/appcadpositivo.conf /etc/nginx/sites-enabled/

# 5. Remover configuração padrão se existir
if [ -f /etc/nginx/sites-enabled/default ]; then
    log_info "Removendo configuração padrão do Nginx..."
    rm /etc/nginx/sites-enabled/default
fi

# 6. Testar configuração do Nginx
log_info "Testando configuração do Nginx..."
if nginx -t; then
    log_info "Configuração do Nginx válida!"
else
    log_error "Erro na configuração do Nginx!"
    exit 1
fi

# 7. Instalar Certbot se não estiver instalado
if ! command -v certbot &> /dev/null; then
    log_info "Instalando Certbot..."
    apt update
    apt install -y certbot python3-certbot-nginx
fi

# 8. Recarregar Nginx com configuração básica (sem SSL ainda)
log_info "Recarregando Nginx..."
systemctl reload nginx

# 9. Obter certificado SSL
log_info "Obtendo certificado SSL com Let's Encrypt..."
if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL"; then
    log_info "Certificado SSL obtido com sucesso!"
else
    log_warn "Falha ao obter certificado SSL. Continuando sem HTTPS..."
fi

# 10. Modificar serviço FastAPI para ouvir apenas localhost
log_info "Configurando FastAPI para ouvir apenas localhost..."
FASTAPI_SERVICE="/etc/systemd/system/appcadpositivo.service"

if [ -f "$FASTAPI_SERVICE" ]; then
    # Substituir --host 0.0.0.0 por --host 127.0.0.1
    sed -i 's/--host 0.0.0.0/--host 127.0.0.1/g' "$FASTAPI_SERVICE"
    
    systemctl daemon-reload
    log_info "Serviço FastAPI atualizado para localhost"
fi

# 11. Iniciar serviços
log_info "Iniciando serviços..."
systemctl start appcadpositivo
systemctl enable nginx

# 12. Verificar status
log_info "Verificando status dos serviços..."
if systemctl is-active --quiet nginx; then
    log_info "✅ Nginx está rodando"
else
    log_error "❌ Nginx não está rodando"
fi

if systemctl is-active --quiet appcadpositivo; then
    log_info "✅ AppCadPositivo está rodando"
else
    log_error "❌ AppCadPositivo não está rodando"
fi

# 13. Configurar renovação automática do SSL
log_info "Configurando renovação automática do SSL..."
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -

# 14. Configurar logrotate para logs do Nginx
log_info "Configurando rotação de logs..."
cat > /etc/logrotate.d/appcadpositivo << EOF
/var/log/nginx/appcadpositivo_*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        if [ -f /var/run/nginx.pid ]; then
            kill -USR1 \`cat /var/run/nginx.pid\`
        fi
    endscript
}
EOF

echo ""
log_info "🎉 Configuração concluída!"
echo ""
log_info "Aplicação disponível em:"
log_info "  • HTTPS: https://$DOMAIN"
log_info "  • HTTP: http://$DOMAIN (redireciona para HTTPS)"
echo ""
log_info "Comandos úteis:"
echo "  sudo nginx -t                    # Testar configuração"
echo "  sudo systemctl reload nginx     # Recarregar configuração"
echo "  sudo systemctl status nginx     # Status do Nginx"
echo "  sudo tail -f /var/log/nginx/appcadpositivo_access.log"
echo ""
log_warn "IMPORTANTE: Certifique-se de que as portas 80 e 443 estão abertas no firewall!"
echo "  sudo ufw allow 'Nginx Full'"
echo "  sudo ufw allow ssh"
echo "  sudo ufw enable"
