# backend/app/main.py
import sys
import os
import pathlib
from datetime import date
from pathlib import Path


sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, Depends, HTTPException, status, Body, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, FileResponse
from app.database import engine, Base, get_db
from sqlalchemy.orm import Session
from app.routers import users, dados, admin, relatorio_bi
from app import models, schemas
from app.auth import create_access_token
from passlib.context import CryptContext
from datetime import timedelta
from fastapi.openapi.utils import get_openapi
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
import os


# Cria as tabelas no banco, se ainda não existirem
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Projeto Certificações")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://129.146.25.181:8000","http://10.34.5.140:8080","http://localhost:8000","http://localhost:5173", "http://10.34.5.157","http://10.34.5.157:5173", "http://172.18.0.3:5173"],  # ou especifique seu frontend, ex: ["http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title="Projeto Certificações",
        version="1.0.0",
        description="Autenticação com JWT",
        routes=app.routes,
    )
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT"
        }
    }
    for path in openapi_schema["paths"].values():
        for method in path.values():
            method["security"] = [{"BearerAuth": []}]
    app.openapi_schema = openapi_schema
    return app.openapi_schema

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body},
    )

app.openapi = custom_openapi

app.include_router(users.router, prefix="", tags=["users"])

app.include_router(dados.router, prefix="", tags=["dados"])

app.include_router(admin.router, prefix="", tags=["admin"])

app.include_router(relatorio_bi.router, prefix="", tags=["relatorio_bi"])

# Login (gerar token JWT)
@app.post("/login", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.Usuario).filter(models.Usuario.matricula == form_data.username).first()
    if not user or not pwd_context.verify(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Matrícula ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    access_token = create_access_token(data={"sub": user.matricula})

    response = JSONResponse(content={"access_token": access_token, "token_type": "bearer", "dados_completos": user.dados_completos})
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
    )
    return response
    

@app.on_event("startup")
async def listar_rotas():
    print("Rotas disponíveis:")
    for route in app.routes:
        print(route.path)


# Caminho absoluto para a pasta 'arquivos'

BASE_DIR = Path(__file__).resolve().parents[1]  # 1 Se main.py está em /code/app, sobe para /code
ARQUIVOS_DIR = BASE_DIR / "arquivos"

if not ARQUIVOS_DIR.exists():
    ARQUIVOS_DIR.mkdir(parents=True)

app.mount("/arquivos", StaticFiles(directory=str(ARQUIVOS_DIR)), name="arquivos")

# Montar a pasta de build do frontend
FRONTEND_DIR = BASE_DIR.parent / "dist"

# Servir os assets (JS, CSS)
app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")

# Rota para servir o index.html para qualquer outra rota (deve ser a última)
@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    return FileResponse(FRONTEND_DIR / "index.html")

