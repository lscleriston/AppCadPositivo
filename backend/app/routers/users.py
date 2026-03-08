# backend/app/routers/users.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app import models, schemas
from app.database import get_db
from app.auth import get_current_user

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@router.post("/register", response_model=schemas.UsuarioOut)
def register_user(user: schemas.UsuarioCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.Usuario).filter(models.Usuario.matricula == user.matricula).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Matrícula já cadastrada")

    hashed_password = pwd_context.hash(user.password)
    db_user = models.Usuario(
        matricula=user.matricula,
        nome=user.nome,
        password=hashed_password,
        is_admin=user.is_admin,
        is_super_admin=user.is_super_admin
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.get("/me", response_model=schemas.UsuarioOut)
def read_users_me(current_user: models.Usuario = Depends(get_current_user)):
    return current_user

@router.put("/atualizar-senha")
def mudar_senha(
    nova: schemas.AtualizarSenha,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user)
):
    hashed_password = pwd_context.hash(nova.nova_senha)
    current_user.password = hashed_password
    db.commit()
    return {"msg": "Senha alterada com sucesso"}

@router.get("/{matricula}", response_model=schemas.UsuarioOut)
def get_usuario_por_matricula(matricula: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    if not (current_user.is_admin or current_user.is_super_admin):
        raise HTTPException(status_code=403, detail="Acesso negado")

    usuario = db.query(models.Usuario).filter(models.Usuario.matricula == matricula).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return usuario

@router.put("/{matricula}/redefinir-senhas")
def redefinir_senha_usuario(
    matricula: str,
    nova: schemas.AtualizarSenha,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user)
):
    # Verifica se é admin ou super admin
    if not (current_user.is_admin or current_user.is_super_admin):
        raise HTTPException(status_code=403, detail="Acesso negado")

    usuario = db.query(models.Usuario).filter(models.Usuario.matricula == matricula).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    usuario.password = pwd_context.hash(nova.nova_senha)
    db.commit()
    return {"msg": f"Senha do usuário {matricula} alterada com sucesso"}
