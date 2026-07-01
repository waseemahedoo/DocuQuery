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
    category: str = "Uncategorized"

    def to_dict(self) -> dict:
        return asdict(self)


class DocumentStore:
    def __init__(self, data_dir: str | Path = "data"):
        self.data_dir = Path(data_dir)
        self.chroma_dir = self.data_dir / "chroma_db"
        self.uploads_dir = self.data_dir / "uploads"
        self.metadata_path = self.data_dir / "documents.json"
        self.categories_path = self.data_dir / "categories.json"

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

    # ------------------------------------------------------------------
    # Categories
    # ------------------------------------------------------------------
    def _load_categories(self) -> list[str]:
        if not self.categories_path.exists():
            return []
        with self.categories_path.open() as f:
            raw = json.load(f)
        return list(raw.get("categories", []))

    def _save_categories(self, names: list[str]) -> None:
        tmp = self.categories_path.with_suffix(".tmp")
        with tmp.open("w") as f:
            json.dump({"categories": names}, f, indent=2)
        tmp.replace(self.categories_path)

    def _register_category(self, name: str) -> None:
        """Persist a category name so it survives even when it has no documents.

        Caller must hold the lock.
        """
        stored = self._load_categories()
        if name not in stored:
            stored.append(name)
            self._save_categories(stored)

    def list_categories(self) -> list[str]:
        """All known categories: explicitly created plus those in use."""
        names = set(self._load_categories())
        names.update(m.category for m in self.list_documents())
        return sorted(
            names,
            key=lambda n: (n == "Uncategorized", n.lower()),
        )

    def add_category(self, name: str) -> list[str]:
        """Create an empty category. Returns the updated category list."""
        name = name.strip()
        if not name:
            raise ValueError("Category name cannot be empty")
        with self._lock:
            self._register_category(name)
        return self.list_categories()

    def delete_category(self, name: str) -> list[str]:
        """Delete a category. Any documents in it move to 'Uncategorized'.

        The 'Uncategorized' bucket cannot be deleted. Returns the updated
        category list.
        """
        name = name.strip()
        if name == "Uncategorized":
            raise ValueError("The 'Uncategorized' category cannot be deleted")
        with self._lock:
            index = self._load_index()
            moved = [m for m in index.values() if m.category == name]
            for meta in moved:
                meta.category = "Uncategorized"
            if moved:
                self._save_index(index)

            stored = [c for c in self._load_categories() if c != name]
            if moved and "Uncategorized" not in stored:
                stored.append("Uncategorized")
            self._save_categories(stored)
        return self.list_categories()

    def _embedded_document_ids(self) -> set[str]:
        """Document IDs that currently have at least one vector in Chroma."""
        result = self._vectorstore.get(include=["metadatas"])
        metadatas = result.get("metadatas") or []
        return {
            m["document_id"]
            for m in metadatas
            if m and "document_id" in m
        }

    def list_documents(self) -> list[DocumentMeta]:
        """List documents that actually have embeddings in the vector store.

        Metadata entries with no corresponding vectors (e.g. after the Chroma
        index was cleared or re-built) are hidden so the UI only shows
        queryable documents.
        """
        embedded = self._embedded_document_ids()
        return [m for m in self._load_index().values() if m.id in embedded]

    def get(self, doc_id: str) -> Optional[DocumentMeta]:
        return self._load_index().get(doc_id)

    # ------------------------------------------------------------------
    # Add / delete
    # ------------------------------------------------------------------
    def add_pdf(
        self,
        file_bytes: bytes,
        filename: str,
        category: str = "Uncategorized",
    ) -> DocumentMeta:
        """Add a PDF. Idempotent: identical content (by sha256) is skipped.

        If the document already exists, its category is updated to the one
        given here (so re-uploading into a different category re-files it).
        """
        category = category.strip() or "Uncategorized"
        doc_id = hashlib.sha256(file_bytes).hexdigest()[:16]

        with self._lock:
            self._register_category(category)
            index = self._load_index()
            if doc_id in index:
                existing = index[doc_id]
                if existing.category != category:
                    existing.category = category
                    self._save_index(index)
                return existing

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
                category=category,
            )
            index[doc_id] = meta
            self._save_index(index)
            return meta

    def set_category(self, doc_id: str, category: str) -> Optional[DocumentMeta]:
        """Change a document's category. Returns the updated meta, or None."""
        category = category.strip() or "Uncategorized"
        with self._lock:
            index = self._load_index()
            meta = index.get(doc_id)
            if meta is None:
                return None
            self._register_category(category)
            meta.category = category
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
