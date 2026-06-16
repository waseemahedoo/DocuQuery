import type { DocumentMeta } from '../types';
import { DocumentItem } from './DocumentItem';
import { UploadButton } from './UploadButton';

interface Props {
  documents: DocumentMeta[];
  selectedIds: Set<string>;
  loading: boolean;
  uploading: boolean;
  error: string | null;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onUpload: (file: File) => void | Promise<void>;
  onDelete: (id: string) => void;
  onNewChat: () => void;
}

export function Sidebar({
  documents,
  selectedIds,
  loading,
  uploading,
  error,
  onToggle,
  onSelectAll,
  onClearSelection,
  onUpload,
  onDelete,
  onNewChat,
}: Props) {
  const allSelected =
    documents.length > 0 && selectedIds.size === documents.length;

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <button
          type="button"
          className="new-chat-btn"
          onClick={onNewChat}
          title="Start a new chat"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M11 3.5L12.5 2 14 3.5 6 11.5 3 12l.5-3 7.5-5.5z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
          New chat
        </button>
      </div>

      <div className="sidebar__section">
        <div className="sidebar__section-head">
          <span>Documents</span>
          {documents.length > 0 && (
            <button
              type="button"
              className="link-btn"
              onClick={allSelected ? onClearSelection : onSelectAll}
            >
              {allSelected ? 'Clear' : 'All'}
            </button>
          )}
        </div>

        <UploadButton onUpload={onUpload} uploading={uploading} />

        {error && <div className="sidebar__error">{error}</div>}

        <div className="sidebar__list">
          {loading ? (
            <div className="sidebar__empty">Loading…</div>
          ) : documents.length === 0 ? (
            <div className="sidebar__empty">No documents yet</div>
          ) : (
            documents.map((d) => (
              <DocumentItem
                key={d.id}
                doc={d}
                selected={selectedIds.has(d.id)}
                onToggle={onToggle}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      </div>

      <div className="sidebar__footer">
        {selectedIds.size === 0
          ? `Querying all ${documents.length} doc${documents.length === 1 ? '' : 's'}`
          : `Querying ${selectedIds.size} of ${documents.length}`}
      </div>
    </aside>
  );
}
