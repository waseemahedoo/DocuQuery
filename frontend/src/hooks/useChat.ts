import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, ChatTurn } from '../types';
import { streamAnswer } from '../api/client';

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Mirror messages in a ref so sendMessage can snapshot the prior turns
  // without being recreated on every streamed token.
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const appendToLast = (text: string) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      const last = updated[updated.length - 1];
      updated[updated.length - 1] = { ...last, content: last.content + text };
      return updated;
    });
  };

  const sendMessage = useCallback(
    async (question: string, documentIds?: string[]) => {
      if (isStreaming) return;

      // Snapshot the conversation so far (completed turns only) as history.
      const history: ChatTurn[] = messagesRef.current.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const userMsg: ChatMessage = { id: newId(), role: 'user', content: question };
      const assistantMsg: ChatMessage = { id: newId(), role: 'assistant', content: '' };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        for await (const chunk of streamAnswer(question, documentIds, history, controller.signal)) {
          appendToLast(chunk);
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          appendToLast(`\n\n_Error: ${(err as Error).message}_`);
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, isStreaming, sendMessage, stop, clear };
}
