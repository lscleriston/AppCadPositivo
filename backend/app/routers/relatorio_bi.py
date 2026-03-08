# backend/app/routers/relatorio_bi.py
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
import requests
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body, Request
from msal import ConfidentialClientApplication
from app.auth import get_current_user
from app import models

router = APIRouter()

# Configurações de autenticação e relatório via variáveis de ambiente
TENANT_ID = os.getenv('PBI_TENANT_ID', '')
CLIENT_ID = os.getenv('PBI_CLIENT_ID', '')
CLIENT_SECRET = os.getenv('PBI_CLIENT_SECRET', '')
AUTHORITY = f'https://login.microsoftonline.com/{TENANT_ID}'
SCOPE = ['https://analysis.windows.net/powerbi/api/.default']
GROUP_ID = os.getenv('PBI_GROUP_ID', '')
REPORT_ID = os.getenv('PBI_REPORT_ID', '')


def _validate_powerbi_config():
    missing = []
    if not TENANT_ID:
        missing.append('PBI_TENANT_ID')
    if not CLIENT_ID:
        missing.append('PBI_CLIENT_ID')
    if not CLIENT_SECRET:
        missing.append('PBI_CLIENT_SECRET')
    if not GROUP_ID:
        missing.append('PBI_GROUP_ID')
    if not REPORT_ID:
        missing.append('PBI_REPORT_ID')
    if missing:
        raise Exception(f"Configuração Power BI incompleta: {', '.join(missing)}")


def get_aad_access_token():
    _validate_powerbi_config()
    client_app = ConfidentialClientApplication(
        CLIENT_ID,
        authority=AUTHORITY,
        client_credential=CLIENT_SECRET
    )
    result = client_app.acquire_token_for_client(scopes=SCOPE)
    if "access_token" not in result:
        raise Exception(f"Erro ao obter token: {result.get('error_description')}")
    return result['access_token']


def get_embed_token_for_report(aad_token, group_id, report_id):
    url = f'https://api.powerbi.com/v1.0/myorg/groups/{group_id}/reports/{report_id}/GenerateToken'
    headers = {'Authorization': f'Bearer {aad_token}'}
    body = {'accessLevel': 'View'}
    response = requests.post(url, headers=headers, json=body)
    if response.status_code != 200:
        raise Exception(f"Erro ao gerar Embed Token: {response.status_code} - {response.text}")
    return response.json()


def get_report_details(aad_token, group_id, report_id):
    url = f'https://api.powerbi.com/v1.0/myorg/groups/{group_id}/reports/{report_id}'
    headers = {'Authorization': f'Bearer {aad_token}'}
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        raise Exception(f"Erro ao obter detalhes do relatório: {response.status_code} - {response.text}")
    return response.json()


@router.get("/relatorio_bi/get_embed_config")
async def get_embed_config(current_user: models.Usuario = Depends(get_current_user)):
    try:
        aad_token = get_aad_access_token()
        report_details = get_report_details(aad_token, GROUP_ID, REPORT_ID)
        embed_token_info = get_embed_token_for_report(aad_token, GROUP_ID, REPORT_ID)

        return JSONResponse({
            'status': 'success',
            'embedUrl': report_details['embedUrl'],
            'embedToken': embed_token_info['token'],
            'reportId': REPORT_ID
        })

    except Exception as e:
        return JSONResponse({'status': 'error', 'message': str(e)}, status_code=500)