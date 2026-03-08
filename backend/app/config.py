import os


def get_public_base_url() -> str:
    return os.getenv("PUBLIC_BASE_URL", "http://127.0.0.1:8000").rstrip("/")


def build_public_url(path: str) -> str:
    normalized_path = path if path.startswith("/") else f"/{path}"
    return f"{get_public_base_url()}{normalized_path}"
