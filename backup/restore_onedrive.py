#!/usr/bin/env python3
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

import requests


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKUP_ROOT = PROJECT_ROOT / "backup"
BACKEND_ENV = PROJECT_ROOT / "backend" / ".env"
ONEDRIVE_FOLDER_DEFAULT = "AppCadastroPositivo"
TS_RE = re.compile(r"(\d{8}_\d{6})")


def load_env(path: Path) -> dict:
    values = {}
    if not path.exists():
        return values
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        values[k.strip()] = v.strip().strip('"').strip("'")
    return values


def get_cfg() -> dict:
    root_env = load_env(PROJECT_ROOT / ".env")
    backend_env = load_env(BACKEND_ENV)
    token_path = root_env.get("ONEDRIVE_TOKEN_PATH") or backend_env.get("ONEDRIVE_TOKEN_PATH") or str(BACKUP_ROOT / "tokens.json")

    return {
        "client_id": root_env.get("ONEDRIVE_CLIENT_ID") or backend_env.get("ONEDRIVE_CLIENT_ID", ""),
        "client_secret": root_env.get("ONEDRIVE_CLIENT_SECRET") or backend_env.get("ONEDRIVE_CLIENT_SECRET", ""),
        "tenant_id": root_env.get("ONEDRIVE_TENANT_ID") or backend_env.get("ONEDRIVE_TENANT_ID", ""),
        "token_path": token_path,
    }


def refresh_access_token(cfg: dict) -> str:
    token_file = Path(cfg["token_path"])
    if not token_file.exists():
        raise RuntimeError(f"Arquivo de token nao encontrado: {token_file}")

    token_data = json.loads(token_file.read_text(encoding="utf-8"))
    refresh_token = token_data.get("refresh_token", "")
    if not refresh_token:
        raise RuntimeError("refresh_token ausente no arquivo de token")

    url = f"https://login.microsoftonline.com/{cfg['tenant_id']}/oauth2/v2.0/token"
    resp = requests.post(
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
    if resp.status_code != 200:
        raise RuntimeError(f"Falha ao atualizar token: {resp.status_code} - {resp.text}")

    new_tokens = resp.json()
    token_file.write_text(json.dumps(new_tokens, ensure_ascii=False, indent=2), encoding="utf-8")

    access_token = new_tokens.get("access_token", "")
    if not access_token:
        raise RuntimeError("access_token nao retornado pelo endpoint")
    return access_token


def list_onedrive_files(access_token: str, folder: str) -> list[dict]:
    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"https://graph.microsoft.com/v1.0/me/drive/root:/{folder}:/children?$top=200"
    resp = requests.get(url, headers=headers, timeout=60)
    if resp.status_code != 200:
        raise RuntimeError(f"Falha ao listar arquivos da pasta {folder}: {resp.status_code} - {resp.text}")
    return resp.json().get("value", [])


def pick_latest(names: list[str], prefix: str, suffix: str) -> str:
    candidates = []
    for name in names:
        if not (name.startswith(prefix) and name.endswith(suffix)):
            continue
        m = TS_RE.search(name)
        if m:
            candidates.append((m.group(1), name))
    if not candidates:
        raise RuntimeError(f"Nenhum arquivo encontrado para {prefix}*{suffix}")
    candidates.sort(key=lambda x: x[0], reverse=True)
    return candidates[0][1]


def download_file(access_token: str, item: dict, out_dir: Path) -> Path:
    url = item.get("@microsoft.graph.downloadUrl")
    if not url:
        raise RuntimeError(f"downloadUrl ausente para {item.get('name', 'arquivo')}.")

    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / item["name"]

    with requests.get(url, stream=True, timeout=300) as resp:
        resp.raise_for_status()
        with out_path.open("wb") as fh:
            for chunk in resp.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    fh.write(chunk)
    return out_path


def restore_db(db_file: Path, env_values: dict) -> None:
    required = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"]
    missing = [k for k in required if not env_values.get(k)]
    if missing:
        raise RuntimeError(f"Variaveis ausentes em backend/.env: {', '.join(missing)}")

    cmd = [
        "mysql",
        "-h",
        env_values["DB_HOST"],
        "-P",
        env_values["DB_PORT"],
        "-u",
        env_values["DB_USER"],
        f"-p{env_values['DB_PASSWORD']}",
        env_values["DB_NAME"],
    ]

    with db_file.open("rb") as fh:
        subprocess.run(cmd, stdin=fh, check=True)


def restore_arquivos(arquivos_tar: Path) -> None:
    cmd = ["tar", "-xzf", str(arquivos_tar), "-C", str(PROJECT_ROOT)]
    subprocess.run(cmd, check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Restaura backup do OneDrive para o AppCadPositivo")
    parser.add_argument("--folder", default=ONEDRIVE_FOLDER_DEFAULT, help="Pasta no OneDrive com os backups")
    parser.add_argument("--latest", action="store_true", help="Usa os arquivos mais recentes automaticamente")
    parser.add_argument("--db-file", default="", help="Nome do dump .sql no OneDrive")
    parser.add_argument("--arquivos-file", default="", help="Nome do .tar.gz de arquivos no OneDrive")
    parser.add_argument("--download-dir", default=str(BACKUP_ROOT / "restore_tmp"), help="Diretorio local para download")
    parser.add_argument("--apply", action="store_true", help="Aplica restauracao de banco e arquivos")
    parser.add_argument("--skip-db", action="store_true", help="Nao restaura banco")
    parser.add_argument("--skip-arquivos", action="store_true", help="Nao restaura pasta arquivos")
    args = parser.parse_args()

    cfg = get_cfg()
    if not cfg["client_id"] or not cfg["client_secret"] or not cfg["tenant_id"]:
        raise RuntimeError("Credenciais OneDrive ausentes. Configure ONEDRIVE_CLIENT_ID/SECRET/TENANT_ID.")

    access_token = refresh_access_token(cfg)
    files = list_onedrive_files(access_token, args.folder)
    names = [item.get("name", "") for item in files]

    db_name = args.db_file
    arq_name = args.arquivos_file

    if args.latest:
        if not db_name and not args.skip_db:
            db_name = pick_latest(names, "db_dump_", ".sql")
        if not arq_name and not args.skip_arquivos:
            arq_name = pick_latest(names, "arquivos_", ".tar.gz")

    if not args.skip_db and not db_name:
        raise RuntimeError("Informe --db-file ou use --latest")
    if not args.skip_arquivos and not arq_name:
        raise RuntimeError("Informe --arquivos-file ou use --latest")

    file_map = {item.get("name"): item for item in files}
    download_dir = Path(args.download_dir)

    db_local = None
    arq_local = None

    if not args.skip_db:
        if db_name not in file_map:
            raise RuntimeError(f"Arquivo nao encontrado no OneDrive: {db_name}")
        db_local = download_file(access_token, file_map[db_name], download_dir)
        print(f"Download concluido: {db_local}")

    if not args.skip_arquivos:
        if arq_name not in file_map:
            raise RuntimeError(f"Arquivo nao encontrado no OneDrive: {arq_name}")
        arq_local = download_file(access_token, file_map[arq_name], download_dir)
        print(f"Download concluido: {arq_local}")

    if not args.apply:
        print("Modo somente download concluido. Use --apply para restaurar.")
        return 0

    env_values = load_env(BACKEND_ENV)
    if db_local and not args.skip_db:
        restore_db(db_local, env_values)
        print("Restore do banco concluido.")

    if arq_local and not args.skip_arquivos:
        restore_arquivos(arq_local)
        print("Restore da pasta arquivos concluido.")

    print("Restore finalizado com sucesso.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
