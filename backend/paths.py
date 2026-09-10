import os

# In production (Railway), set DATA_DIR to a mounted persistent volume
# (e.g. /data) so the SQLite DB and channel config JSON files survive redeploys.
DATA_DIR = os.environ.get("DATA_DIR") or os.path.dirname(os.path.abspath(__file__))
os.makedirs(DATA_DIR, exist_ok=True)


def data_path(filename: str) -> str:
    return os.path.join(DATA_DIR, filename)
