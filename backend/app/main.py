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
from sqlalchemy import inspect, text
from app.routers import users, dados, admin, relatorio_bi
from app import models, schemas
from app.auth import create_access_token, verify_password
from passlib.context import CryptContext
from datetime import timedelta
from fastapi.openapi.utils import get_openapi
import json
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import os


# Cria as tabelas no banco, se ainda não existirem
Base.metadata.create_all(bind=engine)


def ensure_usuario_is_active_column() -> None:
    inspector = inspect(engine)
    columns = {col["name"] for col in inspector.get_columns("tb_usuario")}
    if "is_active" in columns:
        return

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE tb_usuario ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE"))


def ensure_audit_columns() -> None:
    inspector = inspect(engine)

    usuario_columns = {col["name"] for col in inspector.get_columns("tb_usuario")}
    if "ultima_alteracao_por_matricula" not in usuario_columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE tb_usuario ADD COLUMN ultima_alteracao_por_matricula VARCHAR(50) NULL"))

    dados_columns = {col["name"] for col in inspector.get_columns("tb_dados")}
    if "ultima_alteracao_por_matricula" not in dados_columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE tb_dados ADD COLUMN ultima_alteracao_por_matricula VARCHAR(50) NULL"))


ensure_usuario_is_active_column()
ensure_audit_columns()

app = FastAPI(title="Projeto Certificações")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Middleware customizado para garantir CORS headers
class CORSHeaderMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        origin = request.headers.get("origin")
        allowed_origins = ["http://93.127.211.193","http://93.127.211.193:8000", "http://129.146.25.181:8000","http://10.34.5.140:8000","http://10.34.5.140:8080","http://localhost:8000","http://localhost:5173","http://10.34.5.157:8080","http://10.34.5.157:8000","http://10.34.5.157:5173","http://172.18.0.3:5173"]
        
        print(f"[CORSHeaderMiddleware] origin={origin}, allowed={origin in allowed_origins}")
        
        if origin in allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Access-Control-Expose-Headers"] = "*"
            print(f"[CORSHeaderMiddleware] ✅ Headers CORS setados")
        else:
            print(f"[CORSHeaderMiddleware] ❌ Origin NÃO permitido: {origin}")
        
        return response

app.add_middleware(CORSHeaderMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://129.146.25.181:8000","http://10.34.5.140:8000","http://10.34.5.140:8080","http://localhost:8000","http://localhost:5173","http://10.34.5.157:8080","http://10.34.5.157:8000","http://10.34.5.157:5173","http://172.18.0.3:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
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
    
    # Lista de rotas que não precisam de autenticação
    public_routes = [
        "/logo.svg", "/favicon.png", "/favicon.ico", "/logoPositivo.png", 
        "/placeholder.svg", "/robots.txt", "/login", "/docs", "/redoc", 
        "/openapi.json", "/docs/oauth2-redirect"
    ]
    
    for path_name, path in openapi_schema["paths"].items():
        # Só aplica segurança se não for uma rota pública ou estática
        if not any(path_name.startswith(route) for route in public_routes) and not path_name.startswith("/assets") and not path_name.startswith("/static"):
            for method in path.values():
                method["security"] = [{"BearerAuth": []}]
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Sanitize exc.errors() to ensure it's JSON serializable (exceptions in ctx can break json.dumps)
    sanitized_errors = []
    for err in exc.errors():
        new_err = {}
        for k, v in err.items():
            if k == "ctx" and isinstance(v, dict):
                new_ctx = {}
                for ctx_k, ctx_v in v.items():
                    try:
                        json.dumps(ctx_v)
                        new_ctx[ctx_k] = ctx_v
                    except Exception:
                        new_ctx[ctx_k] = str(ctx_v)
                new_err[k] = new_ctx
            else:
                # try serializing value, otherwise fall back to string
                try:
                    json.dumps(v)
                    new_err[k] = v
                except Exception:
                    new_err[k] = str(v)
        sanitized_errors.append(new_err)

    # Ensure body is serializable
    body = exc.body
    try:
        json.dumps(body)
        sanitized_body = body
    except Exception:
        sanitized_body = str(body)

    return JSONResponse(
        status_code=422,
        content={"detail": sanitized_errors, "body": sanitized_body},
    )

app.openapi = custom_openapi

# Primeiro definir as rotas de arquivos estáticos (ANTES dos routers que precisam de auth)
BASE_DIR = Path(__file__).resolve().parents[1]  # 1 Se main.py está em /code/app, sobe para /code
ARQUIVOS_DIR = BASE_DIR / "arquivos"

if not ARQUIVOS_DIR.exists():
    ARQUIVOS_DIR.mkdir(parents=True)

app.mount("/arquivos", StaticFiles(directory=str(ARQUIVOS_DIR)), name="arquivos")

# Montar a pasta de build do frontend
FRONTEND_DIR = BASE_DIR.parent / "dist"

# Verificar se o diretório de build existe
if FRONTEND_DIR.exists():
    # Servir os assets (JS, CSS)
    if (FRONTEND_DIR / "assets").exists():
        app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")
    
    # Servir arquivos estáticos da pasta public (imagens, favicons, etc.)
    # Estes arquivos ficam na raiz do build após o processo de build
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    # Rotas específicas para arquivos comuns que ficam na raiz (sem autenticação)
    @app.get("/logo.svg", include_in_schema=False)
    async def get_logo():
        logo_path = FRONTEND_DIR / "logo.svg"
        if logo_path.exists():
            return FileResponse(logo_path)
        raise HTTPException(status_code=404, detail="Logo não encontrado")

    @app.get("/favicon.png", include_in_schema=False)
    async def get_favicon_png():
        favicon_path = FRONTEND_DIR / "favicon.png"
        if favicon_path.exists():
            return FileResponse(favicon_path)
        raise HTTPException(status_code=404, detail="Favicon não encontrado")

    @app.get("/favicon.ico", include_in_schema=False) 
    async def get_favicon_ico():
        favicon_path = FRONTEND_DIR / "favicon.ico"
        if favicon_path.exists():
            return FileResponse(favicon_path)
        raise HTTPException(status_code=404, detail="Favicon não encontrado")

    @app.get("/logoPositivo.png", include_in_schema=False)
    async def get_logo_positivo():
        logo_path = FRONTEND_DIR / "logoPositivo.png"
        if logo_path.exists():
            return FileResponse(logo_path)
        raise HTTPException(status_code=404, detail="Logo Positivo não encontrado")

    @app.get("/placeholder.svg", include_in_schema=False)
    async def get_placeholder():
        placeholder_path = FRONTEND_DIR / "placeholder.svg"
        if placeholder_path.exists():
            return FileResponse(placeholder_path)
        raise HTTPException(status_code=404, detail="Placeholder não encontrado")

    @app.get("/robots.txt", include_in_schema=False)
    async def get_robots():
        robots_path = FRONTEND_DIR / "robots.txt"
        if robots_path.exists():
            return FileResponse(robots_path)
        raise HTTPException(status_code=404, detail="Robots.txt não encontrado")

# Agora incluir os routers que precisam de autenticação
app.include_router(users.router, prefix="", tags=["users"])
app.include_router(dados.router, prefix="", tags=["dados"])
app.include_router(admin.router, prefix="", tags=["admin"])
app.include_router(relatorio_bi.router, prefix="", tags=["relatorio_bi"])

# Login (gerar token JWT)
@app.post("/login", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.Usuario).filter(models.Usuario.matricula == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Matrícula ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if user.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo. Procure um administrador.",
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

# Verificar se há outras rotas para adicionar
if FRONTEND_DIR.exists():
    # Rota para servir o index.html para qualquer outra rota SPA (deve ser a última)
    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        # Evitar servir o index.html para rotas de API
        if full_path.startswith(("api/", "docs", "redoc", "openapi.json")):
            raise HTTPException(status_code=404, detail="Not found")
        
        index_path = FRONTEND_DIR / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        raise HTTPException(status_code=404, detail="Frontend não encontrado")
else:
    print(f"Diretório de build do frontend não encontrado: {FRONTEND_DIR}")
    
    @app.get("/{full_path:path}")
    async def frontend_not_found(full_path: str):
        raise HTTPException(status_code=404, detail="Frontend não compilado")