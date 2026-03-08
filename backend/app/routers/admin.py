# backend/app/routers/admin.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app import models, schemas, auth
from app.database import get_db
from app.auth import get_current_user, get_current_user_token_query
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
import mimetypes
from pathlib import Path

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parents[3]  # usar 2 para container, 3 local
ARQUIVOS_DIR = BASE_DIR / "arquivos"
BACKEND_URL = "http://10.34.5.157:8000"

# Endpoint exemplo para listar todos os usuários (apenas para admin)
@router.get("/users", response_model=list[schemas.UsuarioOut])
def list_all_users(db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    # Aqui você pode inserir uma verificação para garantir que current_user seja admin
    users = db.query(models.Usuario).all()
    return users

@router.get("/admin/{matricula}", response_model=schemas.DadosOut)
def get_dados_usuario(matricula: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    if not current_user.is_super_admin:
       raise HTTPException(status_code=403, detail="Acesso restrito a super administradores")
    
    usuario = db.query(models.Usuario).filter(models.Usuario.matricula == matricula).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    dados = db.query(models.DadosUser).filter(models.DadosUser.matricula == matricula).first()
    if not dados:
        raise HTTPException(status_code=404, detail="Dados não encontrados")
    return dados

@router.get("/admin/certificacoes/{matricula}", response_class=JSONResponse)
def visualizar_certificacoes_usuario_json(
    matricula: str,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user)
):
    if not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="Acesso restrito a super administradores")

    usuario = db.query(models.Usuario).filter(models.Usuario.matricula == matricula).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
     
    nome_todo = usuario.nome
    nome_sanitizado = nome_todo.replace(" ", "_")
    base_path = ARQUIVOS_DIR / nome_sanitizado / "certificacoes"

    if not base_path.exists():
        raise HTTPException(status_code=404, detail="Nenhuma certificação encontrada para este usuário")

    resultado = {
        "nome": nome_todo,
        "certificacoes": {}
    }

    for fornecedor_path in base_path.iterdir():
        if fornecedor_path.is_dir():
            fornecedor_nome = fornecedor_path.name
            resultado["certificacoes"][fornecedor_nome] = {}

            for cert_path in fornecedor_path.iterdir():
                if cert_path.is_dir():
                    certificacao_nome = cert_path.name
                    arquivos = list(cert_path.iterdir())

                    for arquivo in arquivos:
                        resultado["certificacoes"][fornecedor_nome][certificacao_nome] = {
                            "arquivo": arquivo.name,
                            "link_completo": f"{BACKEND_URL}/admin/ver-certificacao/{nome_sanitizado}/{fornecedor_nome}/{certificacao_nome}/{arquivo.name}"
                        }
    return JSONResponse(content=resultado)

@router.get("/admin/ver-certificacao/{nome}/{fornecedor}/{certificacao}/{arquivo:path}")
def ver_certificacao(nome: str, fornecedor: str, certificacao: str, arquivo: str, current_user: models.Usuario = Depends(get_current_user_token_query)):
    caminho = ARQUIVOS_DIR / nome / "certificacoes" / fornecedor / certificacao / arquivo

    if not caminho.is_file():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")

    mime_type, _ = mimetypes.guess_type(caminho)
    print(f"Servindo arquivo {caminho.name} com tipo MIME: {mime_type}")

    if mime_type is None:
        mime_type = "application/octet-stream"

    return FileResponse(caminho, media_type=mime_type, filename=caminho.name)

@router.get("/admin/ver-curriculo/{nome}/{arquivo:path}")
def ver_curriculo(nome: str, arquivo: str, current_user: models.Usuario = Depends(get_current_user_token_query)):
    nome = current_user.nome.replace(" ", "_")
    caminho = ARQUIVOS_DIR / nome / "curriculo" / arquivo

    if not caminho.is_file():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")

    mime_type, _ = mimetypes.guess_type(caminho)
    print(f"Servindo arquivo {caminho.name} com tipo MIME: {mime_type}")

    if mime_type is None:
        mime_type = "application/octet-stream"  # fallback

    return FileResponse(caminho, media_type=mime_type, filename=caminho.name)

