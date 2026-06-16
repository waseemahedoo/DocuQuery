import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

interface Props {
  onSubmit: (question: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function QuestionInput({
  onSubmit,
  onStop,
  isStreaming,
  disabled,
  placeholder,
}: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [value]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSubmit(trimmed);
    setValue('');
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const canSubmit = value.trim().length > 0 && !isStreaming && !disabled;

  return (
    <div className="input">
      <div className="input__wrap">
        <textarea
          ref={textareaRef}
          className="input__textarea"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder ?? 'Ask a question…'}
          rows={1}
          disabled={isStreaming || disabled}
        />
        {isStreaming ? (
          <button
            type="button"
            className="input__btn input__btn--stop"
            onClick={onStop}
            aria-label="Stop"
          >
            <span className="input__btn-square" />
          </button>
        ) : (
          <button
            type="button"
            className="input__btn"
            onClick={submit}
            disabled={!canSubmit}
            aria-label="Send"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 14V2M8 2L3 7M8 2L13 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
      <p className="input__hint">Press Enter to send · Shift+Enter for newline</p>
    </div>
  );
}
