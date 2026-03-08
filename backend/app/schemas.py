# backend/app/schemas.py
from pydantic import BaseModel, validator
from typing import List, Optional
from datetime import datetime, date
import json

class DadosBase(BaseModel):
    nome_completo: str  # Obrigat\u00f3rio
    torre_atendimento: str  # Obrigat\u00f3rio
    conhecimento: List[Optional[str]] = []
    operacao_compartilhada: Optional[List[str]] = []
    operacao_principal: str  # Obrigat\u00f3rio
    diploma_superior: Optional[List[str]] = []  # Se preenchido, obrigat\u00f3rio ter arquivo
    certificacoes: Optional[List[str]] = []
    certificacoes_link: Optional[str] = None
    emissao_certificacoes: Optional[List[date]] = []
    validade_certificacoes: Optional[List[Optional[date]]] = []
    diploma_superior: Optional[List[str]] = []
    conclusao_superior: Optional[date] = None
    pos_graduacao: Optional[List[str]] = []
    conclusao_pos: Optional[date] = None
    curriculo_atualizado: Optional[str] = None
    cursos: Optional[List[str]] = []
    url_linkedin: Optional[str] = None
    ultima_atualizacao: Optional[date] = None
    ultima_alteracao_por_matricula: Optional[str] = None

    @validator("conclusao_superior", "conclusao_pos", pre=True)
    def parse_optional_date(cls, v):
        if not v or v == "":
            return None
        if isinstance(v, str):
            try:
                return datetime.strptime(v, "%Y-%m-%d").date()
            except:
                return None
        return v

    @validator("nome_completo", "operacao_principal", "torre_atendimento", pre=True)
    def non_empty_string(cls, v):
        if v is None:
            raise ValueError("Campo obrigatório")
        if isinstance(v, str) and v.strip() == "":
            raise ValueError("Campo obrigatório e não pode ser vazio")
        return v

    @validator("conhecimento", "operacao_compartilhada", "diploma_superior", "certificacoes", "pos_graduacao", "cursos", pre=True)
    def parse_lists(cls, v):
        if v is None:
            return []
        if isinstance(v, str):
            if v == "":
                return []
            try:
                return json.loads(v)
            except:
                return [v]
        if isinstance(v, list):
            # Filtrar strings vazias
            return [item for item in v if item and item != ""]
        return v

    @validator("ultima_atualizacao", pre=True)
    def parse_ultima_atualizacao(cls, v):
        if not v or v == "":
            return None
        if isinstance(v, str):
            try:
                return datetime.strptime(v, "%Y-%m-%d").date()
            except:
                return None
        return v

    @validator("emissao_certificacoes", "validade_certificacoes", pre=True)
    def parse_list_dates(cls, v):
        if v is None or v == []:
            return []
        # Se receber string JSON ou lista
        if isinstance(v, str):
            try:
                v = json.loads(v)
            except:
                v = [v] if v else []
        if isinstance(v, list):
            result = []
            for item in v:
                if not item or item == "":
                    result.append(None)
                elif isinstance(item, str):
                    try:
                        result.append(datetime.strptime(item, "%Y-%m-%d").date())
                    except:
                        result.append(None)
                elif isinstance(item, date):
                    result.append(item)
                else:
                    result.append(None)
            return result
        return []

class DadosCreate(DadosBase):
    # Se quiser campos obrigatórios específicos para criação, defina aqui
    pass

class DadosUpdate(DadosBase):
    # Se quiser campos obrigatórios específicos para criação, defina aqui
    pass

class DadosOut(DadosBase):
    id: int
    matricula: Optional[str] = None
    nome_completo: Optional[str] = None
    torre_atendimento: Optional[str] = None
    conhecimento: Optional[List[str]] = []
    operacao_compartilhada: Optional[List[str]] = []
    operacao_principal: Optional[str] = None
    certificacoes: Optional[List[str]] = []
    emissao_certificacoes: Optional[List[Optional[date]]] = []
    validade_certificacoes: Optional[List[Optional[date]]] = []
    diploma_superior: Optional[List[str]] = []
    conclusao_superior: Optional[date] = None
    pos_graduacao: Optional[List[str]] = []
    conclusao_pos: Optional[date] = None
    cursos: Optional[List[str]] = []

    @validator(
        "conhecimento", "operacao_compartilhada", "certificacoes", "emissao_certificacoes",
        "validade_certificacoes", "diploma_superior", "pos_graduacao", "cursos", 
        pre=True
    )

    def deserialize_json(cls, v):
        if not v:
            return []
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return [v]
        return v
    
    @validator("validade_certificacoes", "emissao_certificacoes", pre=True)
    def parse_lista_datas(cls, v):
        if isinstance(v, str):
            try:
                v = json.loads(v)
            except:
                v = [v]
        if isinstance(v, list):
            resultado = []
            for item in v:
                if not item or item == "":
                    resultado.append(None)
                elif isinstance(item, date):
                    resultado.append(item)
                elif isinstance(item, str):
                    resultado.append(datetime.strptime(item, "%Y-%m-%d").date())
                else:
                    raise ValueError("Data inválida")
            return resultado
        return v

    class Config:
        from_attributes = True

class UsuarioBase(BaseModel):
    matricula: str
    nome: Optional[str]
    id_dados: Optional[int]
    is_admin: Optional[bool] = False
    is_super_admin: Optional[bool] = False
    is_active: Optional[bool] = True
    ultima_alteracao_por_matricula: Optional[str] = None

class UsuarioCreate(UsuarioBase):
    password: str

class AtualizarSenha(BaseModel):
    nova_senha: str


class UsuarioAdminSearchItem(BaseModel):
    id: int
    matricula: str
    nome: Optional[str]
    is_admin: bool
    is_super_admin: bool
    is_active: bool
    dados_completos: bool
    ultima_alteracao_por_matricula: Optional[str] = None

    class Config:
        from_attributes = True


class UsuarioAdminUpdate(BaseModel):
    nome: Optional[str] = None
    is_admin: Optional[bool] = None
    is_super_admin: Optional[bool] = None
    is_active: Optional[bool] = None

class UsuarioOut(UsuarioBase):
    id: int
    dados_completos: bool

    class Config:
        from_attributes = True

class UsuarioLogin(BaseModel):
    matricula: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    dados_completos: bool

class TokenData(BaseModel):
    matricula: Optional[str] = None

class OperacaoSchema(BaseModel):
    operacao: str

    class Config:
        from_attributes = True

class CertificacaoSchema(BaseModel):
    fornecedor: str
    certificacao: str

    class Config:
        from_attributes = True

class TorreAtendimentoSchema(BaseModel):
    nome_torre: str

    class Config:
        from_attributes = True