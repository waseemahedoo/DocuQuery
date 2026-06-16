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

export async function uploadDocument(file: File): Promise<DocumentMeta> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(DOCS, { method: 'POST', body: form });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Upload failed: ${res.status} ${detail}`);
  }
  return (await res.json()) as DocumentMeta;
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${DOCS}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}
