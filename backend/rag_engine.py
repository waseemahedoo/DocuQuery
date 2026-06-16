"""Query-time RAG chain. Reads from a persistent DocumentStore."""
from __future__ import annotations

import re
from typing import Iterable, Optional

from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableLambda
from langchain_groq import ChatGroq

from backend.document_store import DocumentStore

QUESTION_CHAPTER = re.compile(r"chapter\s+(\d+)", re.IGNORECASE)

DEFAULT_K = 6

# How many of the most recent messages to keep as conversational context.
HISTORY_WINDOW = 8

PROMPT_TEMPLATE = """You are answering a user's question about their documents.

Do NOT start with preamble, do NOT describe or summarize what the context
contains, and do NOT explain how you interpreted the question or resolved
references like "it" — open with the answer itself.

Then give a thorough, well-developed answer: explain the relevant concepts in
depth, walk through the mechanism or reasoning step by step, and include
supporting detail and examples from the context. Aim for several substantive
paragraphs when the material allows, and use lists or short headings where they
aid clarity. Do not pad with filler — depth should come from real content in
the context.

Use the context excerpts below as your source of facts; you may synthesize,
summarize, or combine across them. Use the conversation history silently, only
to understand what the user is referring to. If the context is genuinely
irrelevant to the question, say only that.

Conversation history:
{chat_history}

Context:
{context}

Question: {question}

Answer:"""

# Turns a context-dependent follow-up into a self-contained question so that
# retrieval still finds the right chunks.
CONDENSE_TEMPLATE = """Given the conversation history and a follow-up question,
rewrite the follow-up as a standalone question that can be understood without
the history. Preserve the original intent and any specifics (chapter numbers,
terminology). If it is already standalone, return it unchanged. Output only the
rewritten question, with no preamble.

Conversation history:
{chat_history}

Follow-up question: {question}

Standalone question:"""


def _build_filter(
    document_ids: Optional[Iterable[str]],
    chapter: Optional[int],
) -> Optional[dict]:
    clauses: list[dict] = []

    if document_ids:
        ids = list(document_ids)
        clauses.append(
            {"document_id": ids[0]} if len(ids) == 1 else {"document_id": {"$in": ids}}
        )
    if chapter is not None:
        clauses.append({"chapter": chapter})

    if not clauses:
        return None
    if len(clauses) == 1:
        return clauses[0]
    return {"$and": clauses}


def retrieve(
    store: DocumentStore,
    question: str,
    document_ids: Optional[Iterable[str]] = None,
    k: int = DEFAULT_K,
) -> list[Document]:
    match = QUESTION_CHAPTER.search(question)
    chapter = int(match.group(1)) if match else None

    search_kwargs: dict = {"k": k}
    where = _build_filter(document_ids, chapter)
    if where is not None:
        search_kwargs["filter"] = where

    retriever = store.vectorstore.as_retriever(search_kwargs=search_kwargs)
    return retriever.invoke(question)


def _format_docs(docs: list[Document]) -> str:
    return "\n\n".join(d.page_content for d in docs)


def _format_history(history: Optional[Iterable[dict]]) -> str:
    """Render recent turns as "User:"/"Assistant:" lines for prompts."""
    turns = list(history or [])[-HISTORY_WINDOW:]
    if not turns:
        return "(no prior conversation)"
    labels = {"user": "User", "assistant": "Assistant"}
    lines = [
        f"{labels.get(t.get('role', ''), t.get('role', '?').title())}: {t.get('content', '')}"
        for t in turns
    ]
    return "\n".join(lines)


def build_chain(
    store: DocumentStore,
    document_ids: Optional[Iterable[str]] = None,
    history: Optional[Iterable[dict]] = None,
):
    """Return a streaming-capable chain bound to the given store + doc filter.

    When ``history`` is provided, the follow-up question is first condensed into
    a standalone question (so retrieval still works on references like "it"),
    and the history is also passed to the answer prompt.
    """
    prompt = ChatPromptTemplate.from_template(PROMPT_TEMPLATE)
    llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)

    doc_ids = list(document_ids) if document_ids else None
    turns = list(history or [])
    history_str = _format_history(turns)

    def condense(question: str) -> str:
        """Rewrite a follow-up into a standalone question (no-op without history)."""
        if not turns:
            return question
        msg = CONDENSE_TEMPLATE.format(chat_history=history_str, question=question)
        content = llm.invoke(msg).content
        rewritten = (content if isinstance(content, str) else str(content)).strip()
        return rewritten or question

    def assemble(question: str) -> dict:
        standalone = condense(question)
        return {
            "context": _format_docs(retrieve(store, standalone, doc_ids)),
            "question": question,
            "chat_history": history_str,
        }

    return RunnableLambda(assemble) | prompt | llm | StrOutputParser()
