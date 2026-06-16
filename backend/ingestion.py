"""PDF ingestion: bytes -> tagged, chunked LangChain documents."""
from __future__ import annotations

import re
import tempfile
from pathlib import Path

from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

CHAPTER_HEADING = re.compile(r"^\s*Chapter\s+(\d+)\s*$", re.IGNORECASE | re.MULTILINE)

CHUNK_SIZE = 1500
CHUNK_OVERLAP = 150


def _tag_chapters(pages: list[Document]) -> list[Document]:
    """Annotate each page with a `chapter` metadata field when detectable."""
    current = None
    for page in pages:
        match = CHAPTER_HEADING.search(page.page_content)
        if match:
            current = int(match.group(1))
        if current is not None:
            page.metadata["chapter"] = current
    return pages


def chunk_pdf_bytes(
    file_bytes: bytes,
    document_id: str,
    filename: str,
) -> tuple[list[Document], int, list[int]]:
    """Load, tag, and chunk a PDF given as raw bytes.

    Returns (chunks, page_count, sorted_unique_chapters).
    Every chunk has `document_id`, `filename`, `page`, and optionally `chapter`.
    """
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = Path(tmp.name)

    try:
        pages = PyPDFLoader(str(tmp_path)).load()
    finally:
        tmp_path.unlink(missing_ok=True)

    if not pages:
        return [], 0, []

    pages = _tag_chapters(pages)
    chapters = sorted({p.metadata["chapter"] for p in pages if "chapter" in p.metadata})

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
    )
    chunks = splitter.split_documents(pages)

    for chunk in chunks:
        chunk.metadata["document_id"] = document_id
        chunk.metadata["filename"] = filename

    return chunks, len(pages), chapters
