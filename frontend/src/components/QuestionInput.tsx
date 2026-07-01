import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { DocumentMeta } from '../types';

const MAX_CHIPS = 5;

interface Props {
  onSubmit: (question: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  activeDocs: DocumentMeta[];
  totalDocs: number;
  onRemoveDoc: (id: string) => void;
  placeholder?: string;
}

export function QuestionInput({
  onSubmit,
  onStop,
  isStreaming,
  disabled,
  activeDocs,
  totalDocs,
  onRemoveDoc,
  placeholder,
}: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 320)}px`;
    // Only show a (vertical) scrollbar once the box has grown to its cap;
    // otherwise a stray scrollbar overlaps the single-line/placeholder text.
    ta.style.overflowY = ta.scrollHeight > 320 ? 'auto' : 'hidden';
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

  const shownChips = activeDocs.slice(0, MAX_CHIPS);
  const hiddenCount = activeDocs.length - shownChips.length;

  return (
    <div className="input">
      {totalDocs > 0 && (
        <div className="input__scope">
          {activeDocs.length === 0 ? (
            <span className="input__scope-all">
              Asking all {totalDocs} document{totalDocs === 1 ? '' : 's'}
            </span>
          ) : (
            <>
              <span className="input__scope-label">
                Asking {activeDocs.length} of {totalDocs}:
              </span>
              {shownChips.map((d) => (
                <span className="scope-chip" key={d.id} title={d.filename}>
                  <span className="scope-chip__name">{d.filename}</span>
                  <button
                    type="button"
                    className="scope-chip__x"
                    onClick={() => onRemoveDoc(d.id)}
                    aria-label={`Remove ${d.filename} from selection`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {hiddenCount > 0 && (
                <span className="input__scope-more">+{hiddenCount} more</span>
              )}
            </>
          )}
        </div>
      )}
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
