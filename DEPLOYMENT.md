# AppCadPositivo - Guia de Deploy e Gerenciamento

## 🚀 Aplicação como Serviço Persistente

A aplicação está configurada como serviço systemd e roda automaticamente mesmo após reinicializações do servidor.

### Comandos Essenciais de Gerenciamento

#### Status do Serviço
```bash
# Verificar status atual
sudo systemctl status appcadpositivo

# Verificar se está ativo e rodando
sudo systemctl is-active appcadpositivo
sudo systemctl is-enabled appcadpositivo
```

#### Controle do Serviço
```bash
# Iniciar o serviço
sudo systemctl start appcadpositivo

# Parar o serviço
sudo systemctl stop appcadpositivo

# Reiniciar o serviço
sudo systemctl restart appcadpositivo

# Recarregar configuração (após mudanças no código)
sudo systemctl reload appcadpositivo
```

#### Logs e Monitoramento
```bash
# Ver logs em tempo real
sudo journalctl -u appcadpositivo -f

# Ver logs das últimas 50 linhas
sudo journalctl -u appcadpositivo -n 50

# Ver logs desde hoje
sudo journalctl -u appcadpositivo --since today

# Ver logs com timestamp específico
sudo journalctl -u appcadpositivo --since "1 hour ago"
```

#### Configuração de Boot
```bash
# Habilitar inicialização automática
sudo systemctl enable appcadpositivo

# Desabilitar inicialização automática
sudo systemctl disable appcadpositivo
```

### 🔄 Deploy de Nova Versão

Quando você fizer alterações no código:

```bash
# 1. Ir para o diretório do projeto
cd /opt/AppCadPositivo

# 2. Fazer pull das alterações do GitHub
git pull origin main

# 3. Recompilar o frontend (se houve mudanças)
npm run build

# 4. Reiniciar o serviço para aplicar mudanças
sudo systemctl restart appcadpositivo

# 5. Verificar se tudo está funcionando
sudo systemctl status appcadpositivo
curl -I http://localhost:8000/
```

### 🔧 Solução de Problemas

#### Serviço não inicia
```bash
# Verificar logs de erro
sudo journalctl -u appcadpositivo --no-pager

# Verificar se o arquivo de serviço está correto
sudo systemctl cat appcadpositivo

# Recarregar configuração do systemd após mudanças
sudo systemctl daemon-reload
```

#### Porta já em uso
```bash
# Encontrar processo usando porta 8000
sudo lsof -i :8000

# Matar processo específico
sudo kill -9 <PID>

# Ou parar todos os processos uvicorn
sudo pkill -f "uvicorn app.main:app"
```

#### Problemas de permissão
```bash
# Verificar proprietário dos arquivos
ls -la /opt/AppCadPositivo/

# Ajustar permissões se necessário
sudo chown -R ubuntu:ubuntu /opt/AppCadPositivo/
sudo chmod +x /opt/AppCadPositivo/backend/.venv/bin/uvicorn
```

### 📁 Estrutura do Serviço

**Arquivo de serviço:** `/etc/systemd/system/appcadpositivo.service`

**Diretório de trabalho:** `/opt/AppCadPositivo/backend`

**Executável:** `/opt/AppCadPositivo/backend/.venv/bin/uvicorn`

**Variáveis de ambiente:** `/opt/AppCadPositivo/backend/.env`

Para recursos de Power BI em produção, configure também no `backend/.env`:
- `PBI_TENANT_ID`
- `PBI_CLIENT_ID`
- `PBI_CLIENT_SECRET`
- `PBI_GROUP_ID`
- `PBI_REPORT_ID`

### 🌐 Acesso à Aplicação

- **Frontend:** http://seu-servidor:8000/
- **API Docs:** http://seu-servidor:8000/docs
- **Redoc:** http://seu-servidor:8000/redoc

### 📊 Monitoramento de Performance

```bash
# Uso de CPU e memória do serviço
sudo systemctl show appcadpositivo --property=CPUUsageNSec,MemoryCurrent

# Estatísticas detalhadas
sudo systemd-cgtop

# Verificar conexões ativas
sudo netstat -tulpn | grep :8000
```

### 🔐 Backup e Segurança

```bash
# Backup do banco de dados
cp /opt/AppCadPositivo/backend/app.db /opt/backups/app-$(date +%Y%m%d).db

# Backup dos arquivos de usuário
tar -czf /opt/backups/arquivos-$(date +%Y%m%d).tar.gz /opt/AppCadPositivo/arquivos/

# Verificar integridade do serviço
sudo systemd-analyze verify /etc/systemd/system/appcadpositivo.service
```

### 🚨 Comandos de Emergência

```bash
# Parar TODOS os processos relacionados
sudo pkill -f "python.*uvicorn"
sudo pkill -f "uvicorn.*app.main"

# Reinicialização forçada do systemd
sudo systemctl daemon-reload
sudo systemctl reset-failed appcadpositivo

# Verificar se há conflitos de porta
sudo ss -tulpn | grep :8000
```

## 📝 Notas Importantes

1. **Logs são rotacionados automaticamente** pelo systemd
2. **O serviço reinicia automaticamente** em caso de falha
3. **Variáveis de ambiente** são carregadas do arquivo `.env`
4. **O usuário `ubuntu` executa** o serviço (não root)
5. **Firewall:** Certifique-se que a porta 8000 está aberta se necessário

## 🌐 Configuração com Nginx (Recomendado)

### Por que usar Nginx?

- **Performance:** Serve arquivos estáticos muito mais rápido
- **Segurança:** SSL/TLS, rate limiting, headers de segurança
- **Cache:** Cache inteligente de assets
- **Compressão:** Gzip automático
- **Load Balancing:** Preparado para múltiplas instâncias
- **Logs:** Logs detalhados e configuráveis

### Setup Automatizado

```bash
# Execute o script de configuração automática
sudo bash /opt/AppCadPositivo/nginx-config/setup-nginx.sh
```

### Setup Manual

1. **Copiar configuração:**
```bash
sudo cp /opt/AppCadPositivo/nginx-config/appcadpositivo.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/appcadpositivo.conf /etc/nginx/sites-enabled/
```

2. **Editar domínio:**
```bash
sudo nano /etc/nginx/sites-available/appcadpositivo.conf
# Substitua 'seu-dominio.com' pelo seu domínio real
```

3. **Configurar SSL:**
```bash
sudo certbot --nginx -d seu-dominio.com
```

4. **Alterar FastAPI para localhost:**
```bash
sudo nano /etc/systemd/system/appcadpositivo.service
# Mude --host 0.0.0.0 para --host 127.0.0.1
sudo systemctl daemon-reload
sudo systemctl restart appcadpositivo
```

### Comandos Nginx

```bash
# Testar configuração
sudo nginx -t

# Recarregar configuração
sudo systemctl reload nginx

# Status e logs
sudo systemctl status nginx
sudo tail -f /var/log/nginx/appcadpositivo_access.log
sudo tail -f /var/log/nginx/appcadpositivo_error.log

# Renovar SSL
sudo certbot renew --dry-run
```

### Firewall

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow ssh
sudo ufw enable
```

---

*Aplicação configurada como serviço persistente em: $(date)*
