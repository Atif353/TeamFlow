import contextlib
import uuid
from pathlib import Path

from app.core.config import get_settings


class LocalStorage:
    def __init__(self, root: Path) -> None:
        self.root = root

    def new_key(self, suffix: str) -> str:
        return f"{uuid.uuid4().hex}{suffix}"

    def path_for(self, key: str) -> Path:
        return self.root / key

    def save(self, key: str, content: bytes) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        self.path_for(key).write_bytes(content)

    def read(self, key: str) -> bytes:
        return self.path_for(key).read_bytes()

    def exists(self, key: str) -> bool:
        return self.path_for(key).is_file()

    def delete(self, key: str) -> None:
        with contextlib.suppress(FileNotFoundError):
            self.path_for(key).unlink()


def get_storage() -> LocalStorage:
    return LocalStorage(Path(get_settings().storage_dir))
