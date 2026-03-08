# backend/app/routers/users.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
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
        is_super_admin=user.is_super_admin,
        is_active=True if user.is_active is None else user.is_active,
        ultima_alteracao_por_matricula=user.matricula,
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
    current_user.ultima_alteracao_por_matricula = current_user.matricula
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
    usuario.ultima_alteracao_por_matricula = current_user.matricula
    db.commit()
    return {"msg": f"Senha do usuário {matricula} alterada com sucesso"}


@router.get("/usuarios/buscar", response_model=list[schemas.UsuarioAdminSearchItem])
def buscar_usuarios(
    q: str = Query("", min_length=0, max_length=255),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    if not (current_user.is_admin or current_user.is_super_admin):
        raise HTTPException(status_code=403, detail="Acesso negado")

    query = db.query(models.Usuario)
    termo = q.strip()
    if termo:
        termo_like = f"%{termo.lower()}%"
        query = query.filter(
            or_(
                func.lower(models.Usuario.matricula).like(termo_like),
                func.lower(models.Usuario.nome).like(termo_like),
            )
        )

    return query.order_by(models.Usuario.nome.asc(), models.Usuario.matricula.asc()).limit(limit).all()


@router.get("/usuarios/{user_id}", response_model=schemas.UsuarioAdminSearchItem)
def get_usuario_por_id_admin(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    if not (current_user.is_admin or current_user.is_super_admin):
        raise HTTPException(status_code=403, detail="Acesso negado")

    usuario = db.query(models.Usuario).filter(models.Usuario.id == user_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return usuario


@router.put("/usuarios/{user_id}", response_model=schemas.UsuarioAdminSearchItem)
def atualizar_usuario_admin(
    user_id: int,
    payload: schemas.UsuarioAdminUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    if not (current_user.is_admin or current_user.is_super_admin):
        raise HTTPException(status_code=403, detail="Acesso negado")

    usuario = db.query(models.Usuario).filter(models.Usuario.id == user_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if (not current_user.is_super_admin) and usuario.is_super_admin:
        raise HTTPException(status_code=403, detail="Apenas super administrador pode editar um super administrador")

    if payload.nome is not None:
        usuario.nome = payload.nome

    if payload.is_admin is not None:
        usuario.is_admin = payload.is_admin

    if payload.is_super_admin is not None:
        if not current_user.is_super_admin:
            raise HTTPException(status_code=403, detail="Apenas super administrador pode alterar privilégio de super administrador")
        usuario.is_super_admin = payload.is_super_admin

    if payload.is_active is not None:
        if (not current_user.is_super_admin) and usuario.is_super_admin:
            raise HTTPException(status_code=403, detail="Apenas super administrador pode inativar um super administrador")
        usuario.is_active = payload.is_active

    usuario.ultima_alteracao_por_matricula = current_user.matricula

    db.commit()
    db.refresh(usuario)
    return usuario
