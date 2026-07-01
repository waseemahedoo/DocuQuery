# syntax=docker/dockerfile:1

# build the React frontend into static files

FROM node:20-alpine AS frontend
WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build          # outputs /frontend/dist

# Python backend that also serves the built frontend
FROM python:3.12-slim AS backend
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/.hf-cache

# Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Application code + built frontend
COPY backend/ ./backend/
COPY --from=frontend /frontend/dist ./static

# Pre-download the embedding model so the first query is fast and the
# container works without needing to fetch it at runtime.
RUN python -c "from langchain_huggingface import HuggingFaceEmbeddings; \
HuggingFaceEmbeddings(model_name='BAAI/bge-small-en-v1.5', \
model_kwargs={'device': 'cpu'}, encode_kwargs={'normalize_embeddings': True})"

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; \
sys.exit(0 if urllib.request.urlopen('http://localhost:8000/api/health').status==200 else 1)"

CMD ["uvicorn", "backend.api:app", "--host", "0.0.0.0", "--port", "8000"]
