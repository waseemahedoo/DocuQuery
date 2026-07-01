import json
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.document_store import DocumentStore
from backend.rag_engine import build_chain

load_dotenv()


class ChatTurn(BaseModel):
    role: str
    content: str


class AskRequest(BaseModel):
    question: str
    document_ids: Optional[list[str]] = None
    history: list[ChatTurn] = []


class CategoryUpdate(BaseModel):
    category: str


class CategoryCreate(BaseModel):
    name: str


state: dict = {}


@asynccontextmanager
async def lifespan(_: FastAPI):
    store = DocumentStore()
    state["store"] = store
    yield
    state.clear()


app = FastAPI(lifespan=lifespan, title="QnA Bot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _store() -> DocumentStore:
    return state["store"]


@app.get("/api/health")
async def health():
    return {"status": "ok", "ready": "store" in state}


@app.get("/api/documents")
async def list_documents():
    return {"documents": [d.to_dict() for d in _store().list_documents()]}


@app.get("/api/categories")
async def list_categories():
    return {"categories": _store().list_categories()}


@app.post("/api/categories")
async def create_category(body: CategoryCreate):
    try:
        categories = _store().add_category(body.name)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return {"categories": categories}


@app.delete("/api/categories/{name}")
async def delete_category(name: str):
    try:
        categories = _store().delete_category(name)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return {"categories": categories}


@app.post("/api/documents")
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form("Uncategorized"),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    try:
        meta = _store().add_pdf(content, file.filename, category)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return meta.to_dict()


@app.patch("/api/documents/{doc_id}")
async def update_document(doc_id: str, body: CategoryUpdate):
    meta = _store().set_category(doc_id, body.category)
    if meta is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return meta.to_dict()


@app.delete("/api/documents/{doc_id}")
async def delete_document(doc_id: str):
    ok = _store().delete(doc_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"deleted": doc_id}


@app.post("/api/ask")
async def ask(body: AskRequest):
    chain = build_chain(
        _store(),
        document_ids=body.document_ids,
        history=[t.model_dump() for t in body.history],
    )

    async def event_stream():
        try:
            async for chunk in chain.astream(body.question):
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
