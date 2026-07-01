import type { ChatTurn, DocumentMeta, StreamEvent } from '../types';

const ASK = '/api/ask';
const DOCS = '/api/documents';

export async function* streamAnswer(
  question: string,
  documentIds: string[] | undefined,
  history: ChatTurn[] | undefined,
  signal?: AbortSignal,
): AsyncGenerator<string, void, void> {
  const response = await fetch(ASK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      document_ids: documentIds,
      history: history ?? [],
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const raw of events) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;

      let event: StreamEvent;
      try {
        event = JSON.parse(payload) as StreamEvent;
      } catch {
        continue;
      }

      if (event.error) throw new Error(event.error);
      if (event.done) return;
      if (event.chunk) yield event.chunk;
    }
  }
}

export async function listDocuments(): Promise<DocumentMeta[]> {
  const res = await fetch(DOCS);
  if (!res.ok) throw new Error(`Failed to list documents: ${res.status}`);
  const data = (await res.json()) as { documents: DocumentMeta[] };
  return data.documents;
}

const CATEGORIES = '/api/categories';

export async function listCategories(): Promise<string[]> {
  const res = await fetch(CATEGORIES);
  if (!res.ok) throw new Error(`Failed to list categories: ${res.status}`);
  const data = (await res.json()) as { categories: string[] };
  return data.categories;
}

export async function createCategory(name: string): Promise<string[]> {
  const res = await fetch(CATEGORIES, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Create category failed: ${res.status} ${detail}`);
  }
  const data = (await res.json()) as { categories: string[] };
  return data.categories;
}

export async function deleteCategory(name: string): Promise<string[]> {
  const res = await fetch(`${CATEGORIES}/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Delete category failed: ${res.status} ${detail}`);
  }
  const data = (await res.json()) as { categories: string[] };
  return data.categories;
}

export async function uploadDocument(
  file: File,
  category: string,
): Promise<DocumentMeta> {
  const form = new FormData();
  form.append('file', file);
  form.append('category', category);
  const res = await fetch(DOCS, { method: 'POST', body: form });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Upload failed: ${res.status} ${detail}`);
  }
  return (await res.json()) as DocumentMeta;
}

export async function updateDocumentCategory(
  id: string,
  category: string,
): Promise<DocumentMeta> {
  const res = await fetch(`${DOCS}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category }),
  });
  if (!res.ok) throw new Error(`Update failed: ${res.status}`);
  return (await res.json()) as DocumentMeta;
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${DOCS}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}
