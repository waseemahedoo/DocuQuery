import type { DocumentMeta } from '../types';

interface Props {
  doc: DocumentMeta;
  selected: boolean;
  dragging: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (doc: DocumentMeta) => void;
  onDragStart: (doc: DocumentMeta) => void;
  onDragEnd: () => void;
}

export function DocumentItem({
  doc,
  selected,
  dragging,
  onToggle,
  onDelete,
  onMove,
  onDragStart,
  onDragEnd,
}: Props) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete "${doc.filename}"?`)) onDelete(doc.id);
  };

  const handleMove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMove(doc);
  };

  return (
    <div
      className={`doc-item${selected ? ' doc-item--selected' : ''}${
        dragging ? ' doc-item--dragging' : ''
      }`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', doc.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(doc);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onToggle(doc.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle(doc.id);
        }
      }}
    >
      <input
        type="checkbox"
        className="doc-item__checkbox"
        checked={selected}
        onChange={() => onToggle(doc.id)}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="doc-item__body">
        <div className="doc-item__name" title={doc.filename}>
          {doc.filename}
        </div>
        <div className="doc-item__meta">
          {doc.page_count} pages · {doc.chunk_count} chunks
        </div>
      </div>
      <button
        type="button"
        className="doc-item__action"
        onClick={handleMove}
        aria-label={`Change category of ${doc.filename}`}
        title="Change category"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M1.5 4.5a1 1 0 0 1 1-1h3l1.5 1.5h5.5a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4.5z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        className="doc-item__action doc-item__delete"
        onClick={handleDelete}
        aria-label={`Delete ${doc.filename}`}
        title="Delete"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M3 4h10M6 4V2.5A.5.5 0 0 1 6.5 2h3a.5.5 0 0 1 .5.5V4M5 4l.5 9a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1L11 4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
