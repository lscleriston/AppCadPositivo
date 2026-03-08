# Atualizacao de Producao - Release 2026-03-08

Este guia cobre a publicacao da release com:
- gestao administrativa de usuarios
- ativacao/inativacao de contas
- edicao completa de dados de usuarios por admin/superadmin
- upload/remocao de arquivos no modo administrativo
- auditoria de ultima alteracao por matricula

## Resumo tecnico

Mudancas de banco introduzidas:
- `tb_usuario.is_active`
- `tb_usuario.ultima_alteracao_por_matricula`
- `tb_dados.ultima_alteracao_por_matricula`

A aplicacao tambem possui migracao automatica no startup, mas para producao o recomendado e aplicar o script manualmente antes de reiniciar servicos.

## Pre-checklist

1. Confirmar backup recente (DB + arquivos):
```bash
cd /opt/AppCadPositivo
bash backup/run_backup.sh
```

2. Confirmar saude atual:
```bash
sudo systemctl is-active appcadpositivo nginx mariadb
curl -I http://localhost/
curl -I http://localhost/api/docs
```

3. Confirmar branch/release esperada:
```bash
cd /opt/AppCadPositivo
git fetch --all
```

## Passo a passo de atualizacao

1. Atualizar codigo:
```bash
cd /opt/AppCadPositivo
git pull origin main
```

2. Aplicar migracao de banco (idempotente):
```bash
cd /opt/AppCadPositivo
bash scripts/db/migrate_20260308_admin_features.sh
```

3. Atualizar dependencias Python (quando necessario):
```bash
cd /opt/AppCadPositivo/backend
source venv/bin/activate
pip install -r requirements.txt
pip install 'bcrypt==4.0.1'
deactivate
```

4. Recompilar frontend:
```bash
cd /opt/AppCadPositivo
npm ci || npm install
npm run build
```

5. Reiniciar servicos:
```bash
sudo systemctl restart appcadpositivo
sudo systemctl reload nginx
```

## Validacao pos-deploy

1. Servicos:
```bash
sudo systemctl status appcadpositivo --no-pager -n 30
sudo systemctl status nginx --no-pager -n 20
sudo systemctl status mariadb --no-pager -n 20
```

2. Endpoints:
```bash
curl -s -o /dev/null -w 'frontend=%{http_code}\n' http://localhost/
curl -s -o /dev/null -w 'api_docs=%{http_code}\n' http://localhost/api/docs
```

3. Banco (colunas da release):
```bash
mysql -u db_brian -p'RFAXB@r' -D bd_cadpositivo -e "\
SHOW COLUMNS FROM tb_usuario LIKE 'is_active'; \
SHOW COLUMNS FROM tb_usuario LIKE 'ultima_alteracao_por_matricula'; \
SHOW COLUMNS FROM tb_dados LIKE 'ultima_alteracao_por_matricula';"
```

4. Fluxo funcional:
- login como admin/superadmin
- abrir `/gerenciar-usuarios`
- buscar usuario por matricula/nome
- editar status ativo/inativo
- abrir edicao completa do usuario
- salvar alteracoes e conferir campo `ultima_alteracao_por_matricula`

## Rollback rapido

Se houver regressao:

```bash
cd /opt/AppCadPositivo
git log --oneline -n 5
# escolher commit anterior estavel

git checkout <commit_estavel>
npm run build
sudo systemctl restart appcadpositivo
sudo systemctl reload nginx
```

Se necessario, restaurar backup de DB/arquivos conforme `backup/README.md`.
