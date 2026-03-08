# backend/app/routers/dados.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from urllib.parse import quote
from typing import List, Optional
from starlette.responses import Response
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from urllib.parse import unquote
import os
import time
import json
import mimetypes
from datetime import datetime, date
from app.database import get_db
from app import models
from app import schemas
from pathlib import Path
from app.auth import get_current_user
from app.crud import (
    criar_dado,
    salvar_arquivo_certificacao,
    remover_certificacoes_excluidas,
    remover_curriculo_antigo,
    obter_id_certificacao,
    atualizar_dados_certificacao,
    limpar_nome,
    atualizar_tb_auxiliares,
    salvar_arquivo_graduacao,
    remover_graduacao_antiga,
)
from flask import Flask, jsonify, Response

app = Flask(__name__)

router = APIRouter()

# Tamanho máximo de upload: 100 MB
MAX_UPLOAD_SIZE = 100 * 1024 * 1024  # 100 MB em bytes

BASE_DIR = Path(__file__).resolve().parents[3] # usar 2 para o container e 3 para o local
ARQUIVOS_DIR = BASE_DIR / "arquivos"

BACKEND_URL = "http://10.34.5.157:8000"

CERTIFICACAO_ENDPOINT = f"{BACKEND_URL}/admin/ver-certificacao"
CURRICULO_ENDPOINT = f"{BACKEND_URL}/admin/ver-curriculo"

@router.get("/dados/me", response_model=schemas.DadosOut)
def get_dados_usuario(db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    dados = db.query(models.DadosUser).filter(models.DadosUser.matricula == current_user.matricula).first()
    if not dados:
        raise HTTPException(status_code=404, detail="Dados não encontrados")
    return dados

@router.post("/dados", response_model=schemas.DadosOut)
def criar_dados(dados: schemas.DadosCreate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    if current_user.id_dados:
        raise HTTPException(status_code=400, detail="Dados já cadastrados.")

    novo_dado = criar_dado(db=db, dados=dados, matricula=current_user.matricula)

    # Atualiza os dados fixos do usuário
    current_user.id_dados = novo_dado.id
    current_user.nome =novo_dado.nome_completo 

    db.commit()

    print("O valor de dados é: ", dados) 
    
    return novo_dado

@router.put("/dados", response_model=schemas.DadosOut)
def atualizar_dados(
    user_update: schemas.DadosUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user)
):
    dados = db.query(models.DadosUser).filter_by(id=current_user.id_dados).first()
    if not dados:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # Backup das certificações antigas
    certificacoes_anteriores = json.loads(dados.certificacoes or "[]")
    novas_certificacoes = user_update.certificacoes or []

    # Remove arquivos das certificações excluídas + pastas de fornecedor
    remover_certificacoes_excluidas(dados.nome_completo, certificacoes_anteriores, novas_certificacoes, db)

    # Atualiza campos do schema
    for key, value in user_update.dict(exclude_unset=True).items():
        if isinstance(value, list):
            if key == "validade_certificacoes":
                value = json.dumps([
                    d.isoformat() if d else None for d in value
                ])
            elif key == "emissao_certificacoes":
                value = json.dumps([
                    d.isoformat() if d else None for d in value
                ])
            else:
                value = json.dumps(value)
        setattr(dados, key, value)

    dados.ultima_atualizacao = datetime.utcnow().date()
    db.commit()
    db.refresh(dados)

    # Atualiza tb_dados_certificacao
    atualizar_dados_certificacao(
        db=db,
        user_id=current_user.id,
        novas_certificacoes=user_update.certificacoes or [],
        emissoes=user_update.emissao_certificacoes or [],
        validades=user_update.validade_certificacoes or []
    )

    # Atualiza tb_operacao_compartilhada e tb_conhecimentos
    atualizar_tb_auxiliares(
        db=db,
        user_id=current_user.id,
        operacoes=user_update.operacao_compartilhada or [],
        conhecimentos=user_update.conhecimento or [],
        cursos=user_update.cursos or []
    )

    # Set dados_completos to True after successful data update
    current_user.dados_completos = True
    db.commit()
    db.refresh(current_user) # Refresh current_user to reflect the change

    return dados

@router.post("/upload")
def upload_files(
    tipo: str = Form(...),  # "certificacoes" ou "curriculo"
    fornecedor: Optional[str] = Form(None),
    certificacao: Optional[str] = Form(None),
    file: UploadFile = File(...),
    emissao: Optional[str] = Form(None), #TESTE
    validade: Optional[str] = Form(None), #TESTE
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user)
):
    # Validar tamanho do arquivo
    if file.size and file.size > MAX_UPLOAD_SIZE:
        max_mb = MAX_UPLOAD_SIZE // (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=f"Arquivo muito grande. Tamanho máximo permitido: {max_mb} MB"
        )

    dados = db.query(models.DadosUser).filter(models.DadosUser.id == current_user.id_dados).first()
    if not dados:
        raise HTTPException(status_code=404, detail="Dados do usuário não encontrados")

    nome_pasta = dados.nome_completo.replace(" ", "_")
    nome_arquivo = file.filename.replace(" ", "_")
    link_final = f"{CERTIFICACAO_ENDPOINT}/{nome_pasta}/{fornecedor}/{certificacao}/{nome_arquivo}"

    if tipo.lower() == "certificacoes":
        if not fornecedor or not certificacao:
            raise HTTPException(status_code=400, detail="Fornecedor e certificação são obrigatórios para certificações")
        file_path, link_visualizacao = salvar_arquivo_certificacao(dados.nome_completo, fornecedor, certificacao, file)
        dados.certificacoes_link = f"/arquivos/{nome_pasta}/certificacoes"

        # Atualiza tabela de certificação do usuário
        certificacao_detalhe = (
            db.query(models.DadosCertificacoes)
            .filter_by(id_user=current_user.id, id_certificacao=obter_id_certificacao(db, certificacao))
            .first()
        )

        if certificacao_detalhe:
            certificacao_detalhe.link_certificacao = link_visualizacao
        else:
            # Cria nova se ainda não existir
            nova = models.DadosCertificacoes(
                id_user=current_user.id,
                id_certificacao=obter_id_certificacao(db, certificacao),
                link_certificacao=link_visualizacao,
                certificacao_emissao=emissao,
                certificacao_validade=validade  # ou preencha se quiser   # TESTE
            )
            db.add(nova)

    elif tipo.lower() == "curriculo":
        # Remove currículo antigo
        remover_curriculo_antigo(dados.nome_completo)
        date_atual = date.today().strftime("%d_%m_%Y")

        # nome_pasta = dados.nome_completo.replace(" ", "_")
        sub_dir = ARQUIVOS_DIR / nome_pasta / "curriculo"
        sub_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{date_atual}_{file.filename.replace(' ', '_')}"
        file_path = sub_dir / filename

        with open(file_path, "wb") as buffer:
            buffer.write(file.file.read())

        dados.curriculo_atualizado = f"{CURRICULO_ENDPOINT}/{nome_pasta}/{filename}"

    elif tipo.lower() == "graduacao":
        # Para graduação, esperamos receber parâmetro 'diploma' com o nome do curso.
        # O frontend envia esse valor no campo 'fornecedor' (compatível com o form-data usado aqui),
        # mas o ideal é enviar no campo 'diploma'. Aqui usamos 'fornecedor' como fallback.
        diploma_val = fornecedor or "graduacao"

        # Usa função do crud para salvar na subpasta do diploma
        file_path, link_visualizacao = salvar_arquivo_graduacao(dados.nome_completo, diploma_val, file)

        # Não alteramos campo existente no DB (não há campo específico para link de graduação).
        # Retornamos o caminho salvo abaixo.
        file_path = file_path

    else:
        raise HTTPException(status_code=400, detail="Tipo inválido.")

    dados.data_atualizacao = datetime.utcnow()
    db.commit()

    return {"message": "Arquivo salvo com sucesso", "caminho": str(file_path)}

@router.get("/dados/torres-atendimento", response_model=List[schemas.TorreAtendimentoSchema])
def listar_torres_atendimento(db: Session = Depends(get_db)):
    return db.query(models.TorreAtendimento).all()

@router.put("/atualizar-torres-atendimento")
def atualizar_torres_atendimento(
    torres: List[schemas.TorreAtendimentoSchema],
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user)
):
    # Buscar certificações atuais
    torres_atuais = db.query(models.TorreAtendimento).all()
    atuais_dict = {(c.nome_torre): c for c in torres_atuais}

    # Preparar os dados recebidos em forma de set
    novos_set = {(c.nome_torre) for c in torres}
    atuais_set = set(atuais_dict.keys())

    # 1. Deletar os que não estão mais na lista recebida
    deletar_set = atuais_set - novos_set
    for chave in deletar_set:
        db.delete(atuais_dict[chave])

    # 2. Inserir os que são novos
    inserir_set = novos_set - atuais_set
    for nome_torre in inserir_set:
        # Cria nova torre de atendimento usando o modelo correto
        nova = models.TorreAtendimento(nome_torre=nome_torre)
        db.add(nova)

    db.commit()
    return {"message": "Certificações sincronizadas com sucesso"}

@router.get("/dados/operacoes", response_model=List[schemas.OperacaoSchema])
def listar_operacoes(db: Session = Depends(get_db)):
    return db.query(models.Operacao).all()
    
@router.put("/atualizar-operacoes")
def atualizar_operacoes(
    operacoes: List[schemas.OperacaoSchema],
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user)
):
    # Buscar certificações atuais
    operacoes_atuais = db.query(models.Operacao).all()
    atuais_dict = {(c.operacao): c for c in operacoes_atuais}

    # Preparar os dados recebidos em forma de set
    novos_set = {(c.operacao) for c in operacoes}
    atuais_set = set(atuais_dict.keys())

    # 1. Deletar os que não estão mais na lista recebida
    deletar_set = atuais_set - novos_set
    for chave in deletar_set:
        db.delete(atuais_dict[chave])

    # 2. Inserir os que são novos
    inserir_set = novos_set - atuais_set
    for operacao in inserir_set:
        nova = models.Operacao(operacao=operacao)
        db.add(nova)

    db.commit()
    return {"message": "Certificações sincronizadas com sucesso"}

@router.get("/dados/certificacoes", response_model=List[schemas.CertificacaoSchema])
def listar_certificacoes(db: Session = Depends(get_db)):
    return db.query(models.Certificacao).all()

@router.put("/atualizar-certificacoes")
def atualizar_certificacoes(
    certificacoes: List[schemas.CertificacaoSchema],
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user)
):
    # Buscar certificações atuais
    certificacoes_atuais = db.query(models.Certificacao).all()
    atuais_dict = {(c.fornecedor, c.certificacao): c for c in certificacoes_atuais}

    # Preparar os dados recebidos em forma de set
    novos_set = {(c.fornecedor, c.certificacao) for c in certificacoes}
    atuais_set = set(atuais_dict.keys())

    # 1. Deletar os que não estão mais na lista recebida
    deletar_set = atuais_set - novos_set
    for chave in deletar_set:
        db.delete(atuais_dict[chave])

    # 2. Inserir os que são novos
    inserir_set = novos_set - atuais_set
    for fornecedor, certificacao in inserir_set:
        nova = models.Certificacao(fornecedor=fornecedor, certificacao=certificacao)
        db.add(nova)

    db.commit()
    return {"message": "Certificações sincronizadas com sucesso"}

@router.get("/dados/meu-curriculo", response_class=HTMLResponse)
def meu_curriculo(current_user: models.Usuario = Depends(get_current_user)):
    nome = current_user.nome.replace(" ", "_")
    base_path = ARQUIVOS_DIR / nome / "curriculo"

    print("CAMINHO BUSCADO CURRICULO:", base_path)

    if not base_path.exists():
        raise HTTPException(status_code=404, detail="Currículo não encontrado")

    arquivos = os.listdir(base_path)
    if not arquivos:
        raise HTTPException(status_code=404, detail="Nenhum arquivo encontrado")

    conteudo_html = f"<h2>Currículo de {current_user.nome}</h2><ul>"

    for arquivo in arquivos:
        link = f"{BACKEND_URL}/ver-curriculo/{nome}/{arquivo}" # .name
        conteudo_html += f'<li><a href="{link}" target="_blank">{arquivo}</a></li>' # .name
    conteudo_html += "</ul>"

    return HTMLResponse(content=conteudo_html)

@router.get("/ver-curriculo/{nome}/{arquivo:path}")
def ver_curriculo(nome: str, arquivo: str, request: Request, current_user: models.Usuario = Depends(get_current_user)):
    print(f"\n=== DEBUG /ver-curriculo ===")
    print(f"Origin header: {request.headers.get('origin')}")
    print(f"Authorization: {request.headers.get('authorization')[:50] if request.headers.get('authorization') else 'NONE'}...")
    print(f"Path: nome={nome}, arquivo={arquivo}")
    print(f"Current user: {current_user.nome}")
    
    nome_usuario_autenticado = current_user.nome.replace(" ", "_")
    
    # Validar que o usuário autenticado está tentando acessar seu próprio arquivo
    if nome != nome_usuario_autenticado:
        print(f"ERRO 403: {nome} != {nome_usuario_autenticado}")
        raise HTTPException(status_code=403, detail="Acesso negado. Você não tem permissão para acessar este arquivo.")
    
    caminho = ARQUIVOS_DIR / nome / "curriculo" / arquivo

    if not caminho.is_file():
        print(f"ERRO 404: arquivo não existe em {caminho}")
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")

    mime_type, _ = mimetypes.guess_type(caminho)
    print(f"Servindo arquivo {caminho.name} com tipo MIME: {mime_type}")

    if mime_type is None:
        mime_type = "application/octet-stream"  # fallback

    # Garantir headers CORS explícitos na resposta de arquivo
    origin = request.headers.get("origin")
    print(f"Returning with origin: {origin}")
    headers = {}
    if origin:
        headers = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
        print(f"CORS headers set: {headers}")
    else:
        print(f"WARNING: origin header not found, CORS headers NOT set")
    return FileResponse(caminho, media_type=mime_type, filename=caminho.name, headers=headers)

@router.get("/dados/minhas-certificacoes", response_class=HTMLResponse)
def minhas_certificacoes(current_user: models.Usuario = Depends(get_current_user)):
    nome = current_user.nome.replace(" ", "_")
    base_path = ARQUIVOS_DIR / nome / "certificacoes"

    print("CAMINHO BUSCADO CERTIFICACOES:", base_path)

    if not base_path.exists():
        raise HTTPException(status_code=404, detail="Nenhuma certificação encontrada")

    conteudo_html = f"<h2>Certificações de {current_user.nome}</h2><ul>"

    for fornecedor_path in base_path.iterdir():
        if fornecedor_path.is_dir():
            conteudo_html += f"<li><b>{fornecedor_path.name}</b><ul>"
            for cert_path in fornecedor_path.iterdir():
                conteudo_html += f"<li><b>{cert_path.name}</b><ul>"
                for arquivo in cert_path.iterdir():
                    link = f"{BACKEND_URL}/ver-certificacao/{nome}/{fornecedor_path.name}/{cert_path.name}/{arquivo.name}"
                    conteudo_html += f'<li><a href="{link}" target="_blank">{arquivo.name}</a></li>'
                conteudo_html += "</ul></li>"
            conteudo_html += "</ul></li>"
    conteudo_html += "</ul>"

    return HTMLResponse(content=conteudo_html)

@router.get("/ver-certificacao/{nome}/{fornecedor}/{certificacao}/{arquivo:path}")
def ver_certificacao(nome: str, fornecedor: str, certificacao: str, arquivo: str, request: Request, current_user: models.Usuario = Depends(get_current_user)):
    print(f"\n=== DEBUG /ver-certificacao ===")
    print(f"Origin header: {request.headers.get('origin')}")
    print(f"Authorization: {request.headers.get('authorization')[:50] if request.headers.get('authorization') else 'NONE'}...")
    print(f"Path: nome={nome}, fornecedor={fornecedor}, certificacao={certificacao}, arquivo={arquivo}")
    print(f"Current user: {current_user.nome}")
    
    nome_usuario_autenticado = current_user.nome.replace(" ", "_")
    
    # Validar que o usuário autenticado está tentando acessar seu próprio arquivo
    if nome != nome_usuario_autenticado:
        print(f"ERRO 403: {nome} != {nome_usuario_autenticado}")
        raise HTTPException(status_code=403, detail="Acesso negado. Você não tem permissão para acessar este arquivo.")
    
    caminho = ARQUIVOS_DIR / nome / "certificacoes" / fornecedor / certificacao / arquivo

    if not caminho.is_file():
        print(f"ERRO 404: arquivo não existe em {caminho}")
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")

    mime_type, _ = mimetypes.guess_type(caminho)
    print(f"Servindo arquivo {caminho.name} com tipo MIME: {mime_type}")

    if mime_type is None:
        mime_type = "application/octet-stream"

    origin = request.headers.get("origin")
    print(f"Returning with origin: {origin}")
    headers = {}
    if origin:
        headers = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
        print(f"CORS headers set: {headers}")
    else:
        print(f"WARNING: origin header not found, CORS headers NOT set")
    return FileResponse(caminho, media_type=mime_type, filename=caminho.name, headers=headers)

@router.get("/dados/nome-arquivo-curriculo")
def listar_arquivo_curriculo(current_user: models.Usuario = Depends(get_current_user)):
    nome = current_user.nome.replace(" ", "_")  # Consistência com o sistema
    base_path = ARQUIVOS_DIR / nome / "curriculo"

    if not base_path.exists():
        return {"arquivos": []}

    arquivos = [f.name for f in base_path.iterdir() if f.is_file()]
    return {"arquivos": arquivos}

@router.get("/dados/nome-arquivo-certificacao")
def listar_arquivo_certificacao(fornecedor: str, certificacao: str, current_user: models.Usuario = Depends(get_current_user)):
    nome = current_user.nome.replace(" ", "_")  # Garantir consistência com outras partes do sistema
    fornecedor_limpo = limpar_nome(fornecedor)  #fornecedor.replace(" ", "_")  # Garantir consistência com outras partes do sistema
    certificacao_limpo = limpar_nome(certificacao)  #certificacao.replace(" ", "_")  # Garantir consistência com outras partes do sistema
    base_path = ARQUIVOS_DIR / nome / "certificacoes" / fornecedor_limpo / certificacao_limpo

    print(f"Verificando caminho certificacao: {base_path}")

    if not base_path.exists():
        return {"arquivos": []}

    arquivos = [f.name for f in base_path.iterdir() if f.is_file()]
    return {"arquivos": arquivos}


@router.get("/dados/minha-graduacao", response_class=HTMLResponse)
def minha_graduacao(current_user: models.Usuario = Depends(get_current_user)):
    nome = current_user.nome.replace(" ", "_")
    base_path = ARQUIVOS_DIR / nome / "graduacao"

    if not base_path.exists():
        raise HTTPException(status_code=404, detail="Nenhuma graduação encontrada")

    conteudo_html = f"<h2>Formação Acadêmica de {current_user.nome}</h2><ul>"

    for diploma_path in base_path.iterdir():
        if diploma_path.is_dir():
            conteudo_html += f"<li><b>{diploma_path.name}</b><ul>"
            for arquivo in diploma_path.iterdir():
                link = f"{BACKEND_URL}/ver-graduacao/{nome}/{diploma_path.name}/{arquivo.name}"
                conteudo_html += f'<li><a href="{link}" target="_blank">{arquivo.name}</a></li>'
            conteudo_html += "</ul></li>"
    conteudo_html += "</ul>"

    return HTMLResponse(content=conteudo_html)


@router.get("/ver-graduacao/{nome}/{diploma}/{arquivo:path}")
def ver_graduacao(nome: str, diploma: str, arquivo: str, request: Request, current_user: models.Usuario = Depends(get_current_user)):
    print(f"\n=== DEBUG /ver-graduacao ===")
    print(f"Origin header: {request.headers.get('origin')}")
    print(f"Authorization: {request.headers.get('authorization')[:50] if request.headers.get('authorization') else 'NONE'}...")
    print(f"Path: nome={nome}, diploma={diploma}, arquivo={arquivo}")
    print(f"Current user: {current_user.nome}")
    
    nome_usuario_autenticado = current_user.nome.replace(" ", "_")
    
    # Validar que o usuário autenticado está tentando acessar seu próprio arquivo
    if nome != nome_usuario_autenticado:
        print(f"ERRO 403: {nome} != {nome_usuario_autenticado}")
        raise HTTPException(status_code=403, detail="Acesso negado. Você não tem permissão para acessar este arquivo.")
    
    caminho = ARQUIVOS_DIR / nome / "graduacao" / diploma / arquivo

    if not caminho.is_file():
        print(f"ERRO 404: arquivo não existe em {caminho}")
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")

    mime_type, _ = mimetypes.guess_type(caminho)
    if mime_type is None:
        mime_type = "application/octet-stream"

    origin = request.headers.get("origin")
    print(f"Returning with origin: {origin}")
    headers = {}
    if origin:
        headers = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
        print(f"CORS headers set: {headers}")
    else:
        print(f"WARNING: origin header not found, CORS headers NOT set")
    return FileResponse(caminho, media_type=mime_type, filename=caminho.name, headers=headers)


@router.get("/dados/nome-arquivo-graduacao")
def listar_arquivo_graduacao(diploma: Optional[str] = None, current_user: models.Usuario = Depends(get_current_user)):
    nome = current_user.nome.replace(" ", "_")
    base_path = ARQUIVOS_DIR / nome / "graduacao"

    if not base_path.exists():
        return {"arquivos": []}

    if diploma:
        diploma_limpo = limpar_nome(diploma)
        target = base_path / diploma_limpo
        if not target.exists():
            return {"arquivos": []}
        arquivos = [f.name for f in target.iterdir() if f.is_file()]
        return {"arquivos": arquivos}

    # Se nenhum diploma informado, retorna lista de diplomas com seus arquivos
    result = {}
    for diploma_path in base_path.iterdir():
        if diploma_path.is_dir():
            result[diploma_path.name] = [f.name for f in diploma_path.iterdir() if f.is_file()]
    return {"arquivos": result}
