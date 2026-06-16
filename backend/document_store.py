"""Persistent store for uploaded documents and their vectors.

Layout:
    data/
    ├── chroma_db/         # single Chroma collection
    ├── uploads/           # original PDFs, named {doc_id}.pdf
    └── documents.json     # metadata index
"""
from __future__ import annotations

import hashlib
import json
import threading
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

from backend.ingestion import chunk_pdf_bytes

EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"


@dataclass
class DocumentMeta:
    id: str
    filename: str
    uploaded_at: str
    page_count: int
    chunk_count: int
    chapters: list[int] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


class DocumentStore:
    def __init__(self, data_dir: str | Path = "data"):
        self.data_dir = Path(data_dir)
        self.chroma_dir = self.data_dir / "chroma_db"
        self.uploads_dir = self.data_dir / "uploads"
        self.metadata_path = self.data_dir / "documents.json"

        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.chroma_dir.mkdir(parents=True, exist_ok=True)

        self._lock = threading.Lock()
        self._embeddings = HuggingFaceEmbeddings(
            model_name=EMBEDDING_MODEL,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
        self._vectorstore = Chroma(
            persist_directory=str(self.chroma_dir),
            embedding_function=self._embeddings,
        )

    # ------------------------------------------------------------------
    # Vectorstore access
    # ------------------------------------------------------------------
    @property
    def vectorstore(self) -> Chroma:
        return self._vectorstore

    # ------------------------------------------------------------------
    # Metadata I/O
    # ------------------------------------------------------------------
    def _load_index(self) -> dict[str, DocumentMeta]:
        if not self.metadata_path.exists():
            return {}
        with self.metadata_path.open() as f:
            raw = json.load(f)
        return {d["id"]: DocumentMeta(**d) for d in raw.get("documents", [])}

    def _save_index(self, index: dict[str, DocumentMeta]) -> None:
        payload = {"documents": [d.to_dict() for d in index.values()]}
        tmp = self.metadata_path.with_suffix(".tmp")
        with tmp.open("w") as f:
            json.dump(payload, f, indent=2)
        tmp.replace(self.metadata_path)

    def list_documents(self) -> list[DocumentMeta]:
        return list(self._load_index().values())

    def get(self, doc_id: str) -> Optional[DocumentMeta]:
        return self._load_index().get(doc_id)

    # ------------------------------------------------------------------
    # Add / delete
    # ------------------------------------------------------------------
    def add_pdf(self, file_bytes: bytes, filename: str) -> DocumentMeta:
        """Add a PDF. Idempotent: identical content (by sha256) is skipped."""
        doc_id = hashlib.sha256(file_bytes).hexdigest()[:16]

        with self._lock:
            index = self._load_index()
            if doc_id in index:
                return index[doc_id]

            chunks, page_count, chapters = chunk_pdf_bytes(file_bytes, doc_id, filename)
            if not chunks:
                raise ValueError("PDF produced no extractable text")

            self._vectorstore.add_documents(chunks)

            pdf_path = self.uploads_dir / f"{doc_id}.pdf"
            pdf_path.write_bytes(file_bytes)

            meta = DocumentMeta(
                id=doc_id,
                filename=filename,
                uploaded_at=datetime.now(timezone.utc).isoformat(),
                page_count=page_count,
                chunk_count=len(chunks),
                chapters=chapters,
            )
            index[doc_id] = meta
            self._save_index(index)
            return meta

    def delete(self, doc_id: str) -> bool:
        with self._lock:
            index = self._load_index()
            if doc_id not in index:
                return False

            collection = self._vectorstore._collection
            collection.delete(where={"document_id": doc_id})

            pdf_path = self.uploads_dir / f"{doc_id}.pdf"
            pdf_path.unlink(missing_ok=True)

            del index[doc_id]
            self._save_index(index)
            return True

    # ------------------------------------------------------------------
    # Convenience
    # ------------------------------------------------------------------
    def auto_import(self, pdf_path: str | Path) -> Optional[DocumentMeta]:
        """Import a PDF from disk if the store is empty. No-op otherwise."""
        if self.list_documents():
            return None
        path = Path(pdf_path)
        if not path.exists():
            return None
        return self.add_pdf(path.read_bytes(), path.name)
