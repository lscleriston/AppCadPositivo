#!/usr/bin/env python3
import json
import os
import subprocess
import sys
import ast
from datetime import datetime
from pathlib import Path

import requests


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKUP_ROOT = PROJECT_ROOT / "backup"
GENERATED_DIR = BACKUP_ROOT / "generated"
LOGS_DIR = BACKUP_ROOT / "logs"
BACKEND_ENV = PROJECT_ROOT / "backend" / ".env"
ARQUIVOS_DIR = PROJECT_ROOT / "arquivos"
ONEDRIVE_FOLDER = "AppCadastroPositivo"


def _load_env_file(path: Path) -> dict:
    values = {}
    if not path.exists():
        return values

    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def _onedrive_config() -> dict:
    client_id = os.getenv("ONEDRIVE_CLIENT_ID", "")
    client_secret = os.getenv("ONEDRIVE_CLIENT_SECRET", "")
    tenant_id = os.getenv("ONEDRIVE_TENANT_ID", "")
    token_path = os.getenv("ONEDRIVE_TOKEN_PATH", str(BACKUP_ROOT / "tokens.json"))

    root_env = _load_env_file(PROJECT_ROOT / ".env")
    backend_env = _load_env_file(BACKEND_ENV)

    client_id = client_id or root_env.get("ONEDRIVE_CLIENT_ID", "") or backend_env.get("ONEDRIVE_CLIENT_ID", "")
    client_secret = client_secret or root_env.get("ONEDRIVE_CLIENT_SECRET", "") or backend_env.get("ONEDRIVE_CLIENT_SECRET", "")
    tenant_id = tenant_id or root_env.get("ONEDRIVE_TENANT_ID", "") or backend_env.get("ONEDRIVE_TENANT_ID", "")
    token_path = (
        token_path
        if token_path != str(BACKUP_ROOT / "tokens.json")
        else root_env.get("ONEDRIVE_TOKEN_PATH", "") or backend_env.get("ONEDRIVE_TOKEN_PATH", "") or token_path
    )

    # Reaproveita credenciais ja usadas no projeto lendo zabbix.py sem executar imports.
    zabbix_file = PROJECT_ROOT / "zabbix.py"
    if zabbix_file.exists():
        try:
            tree = ast.parse(zabbix_file.read_text(encoding="utf-8"))
            constants = {}
            for node in tree.body:
                if not isinstance(node, ast.Assign) or len(node.targets) != 1:
                    continue
                target = node.targets[0]
                if not isinstance(target, ast.Name):
                    continue
                if isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
                    constants[target.id] = node.value.value

            client_id = client_id or constants.get("ONEDRIVE_CLIENT_ID", "")
            client_secret = client_secret or constants.get("ONEDRIVE_CLIENT_SECRET", "")
            tenant_id = tenant_id or constants.get("ONEDRIVE_TENANT_ID", "")

            zabbix_token_path = constants.get("TOKEN_PATH", "")
            if token_path == str(BACKUP_ROOT / "tokens.json") and zabbix_token_path:
                token_path = zabbix_token_path
        except Exception:
            pass

    return {
        "client_id": client_id,
        "client_secret": client_secret,
        "tenant_id": tenant_id,
        "token_path": token_path,
    }


def _refresh_onedrive_token(cfg: dict) -> str:
    token_file = Path(cfg["token_path"])
    if not token_file.exists():
        raise RuntimeError(f"Arquivo de token nao encontrado: {token_file}")

    token_data = json.loads(token_file.read_text(encoding="utf-8"))
    refresh_token = token_data.get("refresh_token", "")
    if not refresh_token:
        raise RuntimeError("refresh_token nao encontrado em tokens.json")

    url = f"https://login.microsoftonline.com/{cfg['tenant_id']}/oauth2/v2.0/token"
    response = requests.post(
        url,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        data={
            "grant_type": "refresh_token",
            "client_id": cfg["client_id"],
            "client_secret": cfg["client_secret"],
            "refresh_token": refresh_token,
        },
        timeout=60,
    )
    if response.status_code != 200:
        raise RuntimeError(f"Falha ao atualizar token OneDrive: {response.status_code} - {response.text}")
    new_tokens = response.json()

    token_file.parent.mkdir(parents=True, exist_ok=True)
    token_file.write_text(json.dumps(new_tokens, ensure_ascii=False, indent=2), encoding="utf-8")

    access_token = new_tokens.get("access_token", "")
    if not access_token:
        raise RuntimeError("Nao foi possivel obter access_token do OneDrive")
    return access_token


def _ensure_folder(access_token: str, folder_name: str) -> None:
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    get_resp = requests.get(
        f"https://graph.microsoft.com/v1.0/me/drive/root:/{folder_name}",
        headers=headers,
        timeout=60,
    )

    if get_resp.status_code == 200:
        return
    if get_resp.status_code != 404:
        get_resp.raise_for_status()

    create_resp = requests.post(
        "https://graph.microsoft.com/v1.0/me/drive/root/children",
        headers=headers,
        json={"name": folder_name, "folder": {}, "@microsoft.graph.conflictBehavior": "replace"},
        timeout=60,
    )
    create_resp.raise_for_status()


def _upload_large_file(access_token: str, local_file: Path, remote_folder: str) -> None:
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    session_resp = requests.post(
        f"https://graph.microsoft.com/v1.0/me/drive/root:/{remote_folder}/{local_file.name}:/createUploadSession",
        headers=headers,
        json={"item": {"@microsoft.graph.conflictBehavior": "replace"}},
        timeout=60,
    )
    session_resp.raise_for_status()
    upload_url = session_resp.json().get("uploadUrl")
    if not upload_url:
        raise RuntimeError("Nao foi possivel criar upload session no OneDrive")

    chunk_size = 5 * 1024 * 1024
    total_size = local_file.stat().st_size

    with local_file.open("rb") as fh:
        start = 0
        while start < total_size:
            data = fh.read(chunk_size)
            if not data:
                break
            end = start + len(data) - 1

            put_resp = requests.put(
                upload_url,
                headers={
                    "Content-Length": str(len(data)),
                    "Content-Range": f"bytes {start}-{end}/{total_size}",
                },
                data=data,
                timeout=300,
            )

            if put_resp.status_code not in (200, 201, 202):
                raise RuntimeError(f"Falha no upload de {local_file.name}: {put_resp.status_code} {put_resp.text}")

            start = end + 1


def _run_command(cmd: list[str], output_file: Path | None = None) -> None:
    if output_file is None:
        subprocess.run(cmd, check=True)
        return

    with output_file.open("wb") as fh:
        subprocess.run(cmd, check=True, stdout=fh)


def _build_backup_files() -> list[Path]:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    LOGS_DIR.mkdir(parents=True, exist_ok=True)

    env_values = _load_env_file(BACKEND_ENV)
    required = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"]
    missing = [key for key in required if not env_values.get(key)]
    if missing:
        raise RuntimeError(f"Variaveis ausentes em backend/.env: {', '.join(missing)}")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    db_dump = GENERATED_DIR / f"db_dump_{timestamp}.sql"
    arquivos_tar = GENERATED_DIR / f"arquivos_{timestamp}.tar.gz"

    dump_cmd = [
        "mysqldump",
        "--single-transaction",
        "--quick",
        "--lock-tables=false",
        "-h",
        env_values["DB_HOST"],
        "-P",
        env_values["DB_PORT"],
        "-u",
        env_values["DB_USER"],
        f"-p{env_values['DB_PASSWORD']}",
        env_values["DB_NAME"],
    ]
    _run_command(dump_cmd, db_dump)

    if not ARQUIVOS_DIR.exists():
        raise RuntimeError(f"Pasta nao encontrada: {ARQUIVOS_DIR}")

    tar_cmd = [
        "tar",
        "-czf",
        str(arquivos_tar),
        "-C",
        str(PROJECT_ROOT),
        "arquivos",
    ]
    _run_command(tar_cmd)

    return [db_dump, arquivos_tar]


def main() -> int:
    try:
        files_to_upload = _build_backup_files()

        cfg = _onedrive_config()
        if not cfg["client_id"] or not cfg["client_secret"] or not cfg["tenant_id"]:
            raise RuntimeError("Credenciais OneDrive incompletas (ONEDRIVE_CLIENT_ID/SECRET/TENANT_ID)")

        access_token = _refresh_onedrive_token(cfg)
        _ensure_folder(access_token, ONEDRIVE_FOLDER)

        for file_path in files_to_upload:
            _upload_large_file(access_token, file_path, ONEDRIVE_FOLDER)
            print(f"Upload concluido: {file_path.name}")

        print(f"Backup concluido com sucesso. Arquivos enviados para OneDrive/{ONEDRIVE_FOLDER}")
        return 0
    except Exception as exc:
        print(f"ERRO BACKUP: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
