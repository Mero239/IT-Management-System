FROM python:3.12-slim

WORKDIR /app

# System deps needed to build a couple of the Python packages (paramiko's
# crypto backend, psutil) on slim images.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Persistent data (SQLite db + per-installation config JSON files) lives here.
# Mount a volume at this path so it survives container restarts/upgrades.
ENV DATA_DIR=/data
RUN mkdir -p /data
VOLUME /data

EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
