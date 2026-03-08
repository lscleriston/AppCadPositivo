# backend/app/auth.py
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, Depends, status, Request
from fastapi.security import OAuth2PasswordBearer
from fastapi.security.utils import get_authorization_scheme_param
from sqlalchemy.orm import Session
from . import models, schemas
from app.database import get_db
from fastapi import Cookie, Query
from typing import Optional
import os

# Configurações de JWT
SECRET_KEY = os.getenv("SECRET_KEY")   # ajuste para algo seguro
ALGORITHM = os.getenv("ALGORITHM") 
TOKEN_IMORTAL = os.getenv("TOKEN_IMORTAL")
ACCESS_TOKEN_EXPIRE_MINUTES = 120

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login", auto_error=False)

def gerar_token_imortal(matricula: str):
    payload = {
        "sub": matricula,
        "exp": datetime.utcnow() + timedelta(days=3650)  # 10 anos
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token

#print("token imortal:", gerar_token_imortal("9847"))  # ou a matrícula que você quiser

def verify_password(plain_password, hashed_password):
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        # Evitar que exceções da lib de hash causem 500 na API.
        # Log simples para diagnóstico e devolver False (senha inválida).
        print(f"[auth.verify_password] erro ao verificar senha: {type(e).__name__}: {e}")
        # Tentativa de mitigação para erro conhecido de bcrypt (>72 bytes):
        try:
            msg = str(e)
            if "longer than 72 bytes" in msg and isinstance(plain_password, (str, bytes)):
                truncated = plain_password[:72]
                return pwd_context.verify(truncated, hashed_password)
        except Exception:
            pass
        return False

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_user_by_matricula(db: Session, matricula: str):
    # print(f"[DEBUG] Procurando usuário: {matricula}")
    usuarios = db.query(models.Usuario).all()
    # print("[DEBUG] Usuários encontrados:")
    # for u in usuarios:
    #     print(" -", u.matricula)
    return db.query(models.Usuario).filter(models.Usuario.matricula == matricula).first()
    
def authenticate_user(db: Session, matricula: str, password: str):
    user = get_user_by_matricula(db, matricula)
    if not user or not verify_password(password, user.password):
        return False
    if user.is_active is False:
        return False
    return user

def get_current_user_token_query(request: Request, db: Session = Depends(get_db)) -> models.Usuario:
    token = request.query_params.get("token")
    if not token:
        raise HTTPException(status_code=401, detail="Token não encontrado na URL")

    if token == TOKEN_IMORTAL:
        print("[DEBUG] Token imortal detectado.")
        user = db.query(models.Usuario).filter(models.Usuario.is_super_admin == True).first()
        if not user:
            raise HTTPException(status_code=403, detail="Token imortal inválido (sem super admin)")
        return user

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token inválido")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

    usuario = db.query(models.Usuario).filter(models.Usuario.matricula == user_id).first()
    if usuario is None:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    return usuario

def get_current_user(
    token: str = Depends(oauth2_scheme), 
    db: Session = Depends(get_db), 
    access_token_cookie: Optional[str] = Cookie(None),
    access_token_query: Optional[str] = Query(None)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Ordem de prioridade: Header > Cookie > Query string
    if token:
        jwt_token = token
    elif access_token_cookie and access_token_cookie.startswith("Bearer "):
        jwt_token = access_token_cookie.split("Bearer ")[1]
    elif access_token_query:
        jwt_token = access_token_query
    else:
        raise credentials_exception

     # Verifica se é o TOKEN_IMORTAL
    if jwt_token == TOKEN_IMORTAL:
        print("[DEBUG] Token imortal detectado.")
        # Busca o primeiro super admin
        user = db.query(models.Usuario).filter(models.Usuario.is_super_admin == True).first()
        if not user:
            raise HTTPException(status_code=403, detail="Token imortal inválido (sem super admin)")
        return user

    # Decodifica o token JWT
    try:
        payload = jwt.decode(jwt_token, SECRET_KEY, algorithms=[ALGORITHM])
        matricula: str = payload.get("sub")
        # print(f"Matricula extraída do token: {matricula}")
        if matricula is None:
            raise credentials_exception
        token_data = schemas.TokenData(matricula=matricula)
    except JWTError:
        raise credentials_exception
    user = get_user_by_matricula(db, matricula=token_data.matricula)
    if user is None:
        raise credentials_exception
    if user.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo. Procure um administrador.",
        )
    return user
