# backend/app/crud.py
import json
from sqlalchemy.orm import Session
from fastapi import UploadFile
from app import models
from app import schemas
from app.models import DadosUser, Usuario, DadosCertificacoes, Certificacao
from app.schemas import DadosCreate
from datetime import date
from pathlib import Path
from app import models
from app import schemas
import time
import shutil
import os
import re
from shutil import copyfileobj

import requests
from msal import ConfidentialClientApplication
from flask import Flask, jsonify, Response
from app.config import build_public_url


BASE_DIR = Path(__file__).resolve().parents[2]  # usar 1 para o conteiner e 2 para o local
ARQUIVOS_DIR = BASE_DIR / "arquivos"

CERTIFICACAO_ENDPOINT = build_public_url("/admin/ver-certificacao")

def limpar_nome(nome: str) -> str:
    # Remove qualquer caractere não alfanumérico, hífen ou sublinhado
    return re.sub(r'[^\w\-]', '_', nome)

def criar_dados_certificacao(db: Session, user_id: int, certificacoes: list, emissoes: list, validades: list, links: list):
    for i in range(len(certificacoes)):
        nome_cert = certificacoes[i]
        emissao = emissoes[i] if i < len(emissoes) else None
        validade = validades[i] if i < len(validades) else None
        link = links[i] if i < len(links) else None

        # Busca ID da certificação pelo nome
        cert = db.query(models.Certificacao).filter(models.Certificacao.certificacao == nome_cert).first()
        if cert:
            nova_cert = models.DadosCertificacoes(
                id_user=user_id,
                id_certificacao=cert.id,
                certificacao_emissao=emissao,
                certificacao_validade=validade,
                link_certificacao=link
            )
            db.add(nova_cert)
    db.commit()

def criar_operacao_compartilhada(db: Session, user_id: int, operacao_compartilhada: list):
    operacao_compartilhada_str = json.loads(operacao_compartilhada)
    for nome_op in operacao_compartilhada_str:
        # print("A operacao e:", operacao)

        # Busca ID da certificação pelo nome
        operacao = db.query(models.Operacao).filter(models.Operacao.operacao == nome_op).first()
        if operacao:
            nova_op = models.OperacaoCompartilhada(
                id_user=user_id,
                id_operacao=operacao.id,
            )
            db.add(nova_op)
    db.commit()

def criar_conhecimentos(db: Session, user_id: int, conhecimento: list):
    conhecimento_str = json.loads(conhecimento)
    for nome_conhecimento in conhecimento_str:
        # print("Os conhecimentos sao:", i)
        
        # Busca ID da certificação pelo nome
        if nome_conhecimento:
            novo_conhecimento = models.Conhecimentos(
                id_user=user_id,
                conhecimentos=nome_conhecimento,
            )
            db.add(novo_conhecimento)
    db.commit()

def criar_cursos(db: Session, user_id: int, curso: list):
    curso_str = json.loads(curso)
    for nome_curso in curso_str:
        # print("Os curso sao:", nome_curso)
        
        # Busca ID da certificação pelo nome
        if nome_curso:
            novo_curso = models.Cursos(
                id_user=user_id,
                curso=nome_curso,
            )
            db.add(novo_curso)
    db.commit()

def obter_id_certificacao(db: Session, nome_certificacao: str) -> int:
    cert = db.query(models.Certificacao).filter_by(certificacao=nome_certificacao).first()
    if not cert:
        raise HTTPException(status_code=404, detail=f"Certificação '{nome_certificacao}' não encontrada")
    return cert.id

def criar_dado(db: Session, dados: DadosCreate, matricula: str):
    novo_dado = DadosUser(
        nome_completo=dados.nome_completo,
        matricula=matricula,
        torre_atendimento=dados.torre_atendimento,
        conhecimento=json.dumps(dados.conhecimento),
        operacao_compartilhada=json.dumps(dados.operacao_compartilhada or []),
        operacao_principal=dados.operacao_principal,
        certificacoes=json.dumps(dados.certificacoes or []),
        certificacoes_link=dados.certificacoes_link or "",
        emissao_certificacoes=json.dumps([
            d.isoformat() if d else None for d in dados.emissao_certificacoes or []
        ]),
        validade_certificacoes=json.dumps([
            d.isoformat() if d else None for d in dados.validade_certificacoes or []
        ]),
        diploma_superior=json.dumps(dados.diploma_superior or []),
        conclusao_superior=dados.conclusao_superior.isoformat() if dados.conclusao_superior else None,
        pos_graduacao=json.dumps(dados.pos_graduacao),
        conclusao_pos=dados.conclusao_pos.isoformat() if dados.conclusao_pos else None,
        curriculo_atualizado=dados.curriculo_atualizado,
        cursos=json.dumps(dados.cursos or []),
        url_linkedin=dados.url_linkedin,
        ultima_atualizacao=date.today(),
    )
    db.add(novo_dado)
    db.commit()
    db.refresh(novo_dado)

    # Salva cada certificação individualmente na nova tabela
    usuario = db.query(Usuario).filter(Usuario.matricula == matricula).first()
    if usuario:
        criar_dados_certificacao(
            db=db,
            user_id=usuario.id,
            certificacoes=dados.certificacoes,
            emissoes=[d.isoformat() if d else None for d in dados.emissao_certificacoes or []],
            validades=[d.isoformat() if d else None for d in dados.validade_certificacoes or []],
            links=[None] * len(dados.certificacoes)
        )

        criar_operacao_compartilhada(
            db=db,
            user_id=usuario.id,
            operacao_compartilhada=json.dumps(dados.operacao_compartilhada or []),
        )

        criar_conhecimentos(
            db=db,
            user_id=usuario.id,
            conhecimento=json.dumps(dados.conhecimento or []),
        )

        criar_cursos(
            db=db,
            user_id=usuario.id,
            curso=json.dumps(dados.cursos or []),
        )

    # Atualiza o nome do usuário se ainda estiver vazio
    # usuario = db.query(Usuario).filter(Usuario.matricula == matricula).first()
    if usuario and not usuario.nome:
        usuario.nome = novo_dado.nome_completo
        db.commit()

    return novo_dado

def atualizar_tb_auxiliares(db: Session, user_id: int, operacoes: list[str], conhecimentos: list[str], cursos: list[str]):
    # --- Operacoes ---
    operacoes_db = db.query(models.OperacaoCompartilhada).filter_by(id_user=user_id).all()
    nomes_operacoes_db = [op.operacao.operacao for op in operacoes_db]  # nomes atuais no banco

    # Remover operações que não estão mais na lista enviada
    for op_db in operacoes_db:
        if op_db.operacao.operacao not in operacoes:
            db.delete(op_db)

    # Adicionar operações novas que não existem no banco para esse usuário
    for nome_op in operacoes:
        if nome_op not in nomes_operacoes_db:
            operacao = db.query(models.Operacao).filter_by(operacao=nome_op).first()
            if operacao:
                nova_op_compartilhada = models.OperacaoCompartilhada(id_user=user_id, id_operacao=operacao.id)
                db.add(nova_op_compartilhada)

    # --- Conhecimentos ---
    conhecimentos_db = db.query(models.Conhecimentos).filter_by(id_user=user_id).all()
    nomes_conhecimentos_db = [c.conhecimentos for c in conhecimentos_db]

    # Remover que não estão mais na lista
    for c_db in conhecimentos_db:
        if c_db.conhecimentos not in conhecimentos:
            db.delete(c_db)

    # Adicionar novos
    for nome_c in conhecimentos:
        if nome_c not in nomes_conhecimentos_db:
            novo_conhecimento = models.Conhecimentos(id_user=user_id, conhecimentos=nome_c)
            db.add(novo_conhecimento)

    # --- Cursos ---
    cursos_db = db.query(models.Cursos).filter_by(id_user=user_id).all()
    nomes_cursos_db = [c.curso for c in cursos_db]

    # Remover que não estão mais na lista
    for c_db in cursos_db:
        if c_db.curso not in cursos:
            db.delete(c_db)

    # Adicionar novos
    for nome_curso in cursos:
        if nome_curso not in nomes_cursos_db:
            novo_curso = models.Cursos(id_user=user_id, curso=nome_curso)
            db.add(novo_curso)

    db.commit()

def atualizar_dados_certificacao(db: Session, user_id: int, novas_certificacoes: list, emissoes: list, validades: list):
    """
    Atualiza a tabela tb_dados_certificacao com base nas novas certificações do usuário.
    Remove as que não existem mais e insere/atualiza as novas.
    """
    # Busca registros existentes
    registros_existentes = db.query(models.DadosCertificacoes).filter_by(id_user=user_id).all()
    ids_existentes = {reg.certificacao.certificacao: reg for reg in registros_existentes}

    novas_cert_names = set(novas_certificacoes)
    certs_atuais = set(ids_existentes.keys())

    # Certificações removidas
    removidas = certs_atuais - novas_cert_names
    for nome in removidas:
        db.delete(ids_existentes[nome])

    # Adiciona ou atualiza certificações
    for i, nome_cert in enumerate(novas_certificacoes):
        emissao = emissoes[i].isoformat() if i < len(emissoes) and emissoes[i] else None
        validade = validades[i].isoformat() if i < len(validades) and validades[i] else None
        cert = db.query(models.Certificacao).filter_by(certificacao=nome_cert).first()
        if not cert:
            continue  # ignora se não encontrar

        if nome_cert in ids_existentes:
            registro = ids_existentes[nome_cert]
            registro.certificacao_emissao = emissao
            registro.certificacao_validade = validade
        else:
            novo = models.DadosCertificacoes(
                id_user=user_id,
                id_certificacao=cert.id,
                certificacao_emissao=emissao,
                certificacao_validade=validade,
                link_certificacao=None  # Mantido como None se não for enviado via upload
            )
            db.add(novo)

    db.commit()

def remover_certificacoes_excluidas(nome_completo: str, certificacoes_antigas: list, novas_certificacoes: list, db: Session):
    """
    Remove arquivos/diretórios de certificações que foram removidas pelo usuário.
    Em seguida, remove diretórios de fornecedores que estejam completamente vazios.
    """
    removidas = set(certificacoes_antigas) - set(novas_certificacoes)
    base_dir = ARQUIVOS_DIR / nome_completo.replace(" ", "_") / "certificacoes"

    print(f" Removendo certificações antigas: {removidas}")

    print(f" Antigas: {certificacoes_antigas}")
    print(f" Novas: {novas_certificacoes}")

    # Remove as certificações excluídas
    for cert in removidas:
        cert_info = db.query(Certificacao).filter_by(certificacao=cert).first()
        if cert_info:
            fornecedor = cert_info.fornecedor.replace(" ", "_")
            cert_dir = base_dir / fornecedor / cert.replace(" ", "_")
            print(f" Caminho de remoção: {cert_dir}")
            try:
                if cert_dir.exists():
                    shutil.rmtree(cert_dir)
                    print(f" Removido: {cert_dir}")
                else:
                    print(f" Caminho não existe: {cert_dir}")
                    # print(f" Caminho existe? {cert_dir.exists()}")
            except Exception as e:
                print(f" Erro ao remover {cert_dir}: {e}")
        else:
            print(f" Certificação não encontrada no banco: {cert}")
    
    # Após remover as certificações, verifica fornecedores vazios
    if base_dir.is_dir():
        # Verifica se há arquivos ou subdiretórios dentro (recursivamente)
        for fornecedor in base_dir.iterdir():
            if fornecedor.is_dir():
                is_empty = not any(fornecedor.rglob("*"))
                if is_empty:
                    try:
                        shutil.rmtree(fornecedor)
                        print(f" Fornecedor vazio removido: {fornecedor}")
                    except Exception as e:
                        print(f" Erro ao verificar/remover fornecedor: {fornecedor}: {e}")

# Verifica se há arquivos ou subdiretórios dentro (recursivamente)
def remover_curriculo_antigo(nome_completo: str):
    """
    Remove todos os arquivos antigos da pasta de currículo do usuário.
    """
    nome_pasta = nome_completo.replace(" ", "_")
    curriculo_dir = ARQUIVOS_DIR / nome_pasta / "curriculo"

    if curriculo_dir.is_dir():
        for arquivo in curriculo_dir.iterdir():
            if arquivo.is_file():
                arquivo.unlink()

def salvar_arquivo_certificacao(
    nome_completo: str,
    fornecedor: str,
    certificacao: str,
    file: UploadFile
) -> str:
    """
    Remove arquivos antigos e salva novo arquivo de certificação no caminho especificado.
    """
    nome_pasta = nome_completo.replace(" ", "_")
    base_dir = ARQUIVOS_DIR / nome_pasta / "certificacoes"

    fornecedor_dir = limpar_nome(fornecedor)
    certificacao_dir = limpar_nome(certificacao)
    date_atual = date.today().strftime("%d_%m_%Y")
    nome_arquivo = f"{date_atual}_{file.filename.replace(' ', '_')}"

    destino_dir = base_dir / fornecedor_dir / certificacao_dir
    destino_dir.mkdir(parents=True, exist_ok=True) 

    #montando link de visualização
    link_visualizacao = f"{CERTIFICACAO_ENDPOINT}/{nome_pasta}/{fornecedor_dir}/{certificacao_dir}/{nome_arquivo}"
    print("O link de Vizualizacao: ", link_visualizacao)

    # Remove todos os arquivos antigos da pasta da certificação
    if destino_dir.exists():
        print(f" Pasta encontrada: {destino_dir}")
        for arquivo in destino_dir.iterdir():
            print(f" DEBUG - conteúdo da pasta: {arquivo}, is_file={arquivo.is_file()}, exists={arquivo.exists()}")
            print(f" Encontrado arquivo antigo: {arquivo}")
            if arquivo.is_file():
                try:
                    arquivo.unlink()
                    print(f" Arquivo removido: {arquivo}")
                except Exception as e:
                    print(f" Erro ao remover arquivo {arquivo}: {e}")
    else:
        print(f" Pasta de destino não existe: {destino_dir}")
    
    # Salva o novo arquivo
    filename = f"{date_atual}_{file.filename.replace(' ', '_')}"
    file_path = destino_dir / filename

    # Antes de open()
    file_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"DEBUG - Salvando novo arquivo: {file_path}")
    # print(f"DEBUG - Arquivo original: {file.filename}, size: {file.spool_max_size}")

    with file_path.open("wb") as buffer:
        file.file.seek(0)  # Garante que começa do início
        copyfileobj(file.file, buffer)

    print(f" Deveria ter sido salvo certificação em: {file_path}")

    return str(file_path), link_visualizacao

def remover_graduacao_antiga(nome_completo: str, diploma: str):
    """
    Remove arquivos antigos da pasta de graduação específica do diploma.
    """
    nome_pasta = nome_completo.replace(" ", "_")
    diploma_dir = ARQUIVOS_DIR / nome_pasta / "graduacao" / limpar_nome(diploma)

    if diploma_dir.is_dir():
        for arquivo in diploma_dir.iterdir():
            if arquivo.is_file():
                try:
                    arquivo.unlink()
                except Exception:
                    pass

def salvar_arquivo_graduacao(
    nome_completo: str,
    diploma: str,
    file: UploadFile
) -> tuple[str, str]:
    """
    Salva um arquivo de graduação dentro de `arquivos/<nome>/graduacao/<diploma_clean>/`.
    Remove arquivos antigos do mesmo diploma antes de salvar o novo.
    Retorna (caminho_str, link_visualizacao_relativo)
    """
    nome_pasta = nome_completo.replace(" ", "_")
    base_dir = ARQUIVOS_DIR / nome_pasta / "graduacao"

    diploma_dir = limpar_nome(diploma)
    destino_dir = base_dir / diploma_dir
    destino_dir.mkdir(parents=True, exist_ok=True)

    # remove antigos
    if destino_dir.exists():
        for arquivo in destino_dir.iterdir():
            if arquivo.is_file():
                try:
                    arquivo.unlink()
                except Exception:
                    pass

    date_atual = date.today().strftime("%d_%m_%Y")
    filename = f"{date_atual}_{file.filename.replace(' ', '_')}"
    file_path = destino_dir / filename

    # grava o arquivo
    file_path.parent.mkdir(parents=True, exist_ok=True)
    with file_path.open("wb") as buffer:
        file.file.seek(0)
        copyfileobj(file.file, buffer)

    # link relativo que será usado pelo router para compor URL
    link_visualizacao = f"/ver-graduacao/{nome_pasta}/graduacao/{diploma_dir}/{filename}"
    return str(file_path), link_visualizacao
