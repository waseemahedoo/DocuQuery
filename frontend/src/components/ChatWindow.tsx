import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../types';
import { Message } from './Message';

interface Props {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSuggestion: (text: string) => void;
  emptyHint?: string;
}

const SUGGESTIONS = [
  'Summarize the main ideas',
  'List the key concepts',
  'Explain chapter 1',
  'What are the most important takeaways?',
];

export function ChatWindow({
  messages,
  isStreaming,
  onSuggestion,
  emptyHint,
}: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="empty">
        <h1 className="empty__title">Ask your documents</h1>
        <p className="empty__subtitle">
          {emptyHint ?? 'Pick documents in the sidebar, then ask anything'}
        </p>
        {!emptyHint && (
          <div className="empty__suggestions">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className="suggestion"
                onClick={() => onSuggestion(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="chat">
      {messages.map((m, i) => (
        <Message
          key={m.id}
          message={m}
          isStreaming={isStreaming && i === messages.length - 1}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
}
