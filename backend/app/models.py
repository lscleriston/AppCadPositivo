# backend/app/models.py
from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime,ForeignKey, Date, func
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class DadosUser(Base):
    __tablename__ = "tb_dados"
    
    id = Column(Integer, primary_key=True, index=True)
    nome_completo = Column(String(255))
    matricula = Column(String(20), unique=True, index=True)
    torre_atendimento = Column(Text)
    conhecimento = Column(Text)
    certificacoes_link = Column(String(255), nullable=True)
    operacao_compartilhada = Column(Text)
    operacao_principal = Column(String(100))
    certificacoes = Column(Text)
    emissao_certificacoes = Column(Text)
    validade_certificacoes = Column(Text)
    diploma_superior = Column(Text)
    conclusao_superior = Column(Text, nullable=True)
    pos_graduacao = Column(Text)
    conclusao_pos = Column(Text, nullable=True)
    curriculo_atualizado = Column(String(255), nullable=True)
    cursos = Column(Text)
    url_linkedin = Column(String(255), nullable=True)
    ultima_atualizacao = Column(Date, default=func.current_date(), onupdate=func.current_date())
    ultima_alteracao_por_matricula = Column(String(50), nullable=True)

    usuario = relationship("Usuario", back_populates="dados", uselist=False)

class Usuario(Base):
    __tablename__ = "tb_usuario"

    id = Column(Integer, primary_key=True, index=True)
    id_dados = Column(Integer, ForeignKey("tb_dados.id", ondelete="CASCADE"), nullable=True)
    matricula = Column(String(50), unique=True, nullable=False)
    nome = Column(String(255))
    password = Column(String(255))
    is_admin = Column(Boolean, default=False)
    is_super_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    dados_completos = Column(Boolean, default=False)
    ultima_alteracao_por_matricula = Column(String(50), nullable=True)

    dados = relationship("DadosUser", back_populates="usuario")

class Operacao(Base):
    __tablename__ = "tb_operacoes"
    id = Column(Integer, primary_key=True, index=True)
    operacao = Column(String(100), unique=True)

class Certificacao(Base):
    __tablename__ = "tb_certificacoes"
    id = Column(Integer, primary_key=True, index=True)
    fornecedor = Column(String(100))
    certificacao = Column(String(255))

class TorreAtendimento(Base):
    __tablename__ = "tb_torreatendimento"
    id_torre = Column(Integer, primary_key=True, index=True)
    nome_torre = Column(String(100), unique=True)
    data_cadastro = Column(DateTime, default=datetime.utcnow)

class DadosCertificacoes(Base):
    __tablename__ = "tb_dados_certificacao"
    id = Column(Integer, primary_key=True, index=True)
    id_user = Column(Integer, ForeignKey("tb_usuario.id", ondelete="CASCADE"), nullable=True)
    id_certificacao = Column(Integer, ForeignKey("tb_certificacoes.id", ondelete="CASCADE"), nullable=True)
    link_certificacao = Column(Text)
    certificacao_emissao = Column(Text)
    certificacao_validade = Column(Text)

    usuario = relationship("Usuario", backref="certificacoes_detalhadas")
    certificacao = relationship("Certificacao")

class OperacaoCompartilhada(Base):
    __tablename__ = "tb_dados_operacao_compartilhada"
    id = Column(Integer, primary_key=True, index=True)
    id_user = Column(Integer, ForeignKey("tb_usuario.id", ondelete="CASCADE"), nullable=True)
    id_operacao = Column(Integer, ForeignKey("tb_operacoes.id", ondelete="CASCADE"), nullable=True)

    usuario = relationship("Usuario")
    operacao = relationship("Operacao")

class Conhecimentos(Base):
    __tablename__ = "tb_dados_conhecimentos"
    id = Column(Integer, primary_key=True, index=True)
    id_user = Column(Integer, ForeignKey("tb_usuario.id", ondelete="CASCADE"), nullable=True)
    conhecimentos = Column(Text)

    usuario = relationship("Usuario")

class Cursos(Base):
    __tablename__ = "tb_dados_cursos"
    id = Column(Integer, primary_key=True, index=True)
    id_user = Column(Integer, ForeignKey("tb_usuario.id", ondelete="CASCADE"), nullable=True)
    curso = Column(Text)

    usuario = relationship("Usuario")