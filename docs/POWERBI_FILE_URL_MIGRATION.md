# URL Dinamica para Arquivos (Power BI)

Este ajuste remove host fixo nos links de arquivos e passa a usar `PUBLIC_BASE_URL`.

## 1) Configurar ambiente

Em `backend/.env`:

- Ambiente local: `PUBLIC_BASE_URL=http://127.0.0.1:8000`
- Producao: `PUBLIC_BASE_URL=https://cert.psmais.com.br`

Reiniciar servico:

```bash
sudo systemctl daemon-reload
sudo systemctl restart appcadpositivo
sudo systemctl is-active appcadpositivo
```

## 2) Migrar links antigos no banco

Script:

`scripts/db/migrate_public_base_url_links.sh`

Uso em producao:

```bash
cd /opt/AppCadPositivo
scripts/db/migrate_public_base_url_links.sh \
  "http://10.34.5.157:8000" \
  "https://cert.psmais.com.br" \
  "/opt/AppCadPositivo/backend/.env"
```

O script atualiza:

- `tb_dados_certificacao.link_certificacao`
- `tb_dados.curriculo_atualizado`

## 3) Validar

1. Abrir um usuario com certificacao anexada.
2. Conferir se o link gerado usa `https://cert.psmais.com.br`.
3. Testar abertura do arquivo pelo link completo com token.
