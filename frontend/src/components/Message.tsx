import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from '../types';

interface Props {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function Message({ message, isStreaming }: Props) {
  const isEmpty = message.content.length === 0;
  const showCursor = isStreaming && message.role === 'assistant';

  return (
    <div className={`message message--${message.role}`}>
      <div className="message__avatar">{message.role === 'user' ? 'U' : 'A'}</div>
      <div className="message__bubble">
        {isEmpty && showCursor ? (
          <span className="message__cursor">▌</span>
        ) : (
          <div className="message__content">
            <ReactMarkdown>{message.content}</ReactMarkdown>
            {showCursor && <span className="message__cursor">▌</span>}
          </div>
        )}
      </div>
    </div>
  );
}
