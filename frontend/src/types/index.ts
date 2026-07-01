export type Role = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
}

export interface ChatTurn {
  role: Role;
  content: string;
}

export interface AskRequest {
  question: string;
  document_ids?: string[];
  history?: ChatTurn[];
}

export interface StreamEvent {
  chunk?: string;
  error?: string;
  done?: boolean;
}

export interface DocumentMeta {
  id: string;
  filename: string;
  uploaded_at: string;
  page_count: number;
  chunk_count: number;
  chapters: number[];
  category: string;
}
