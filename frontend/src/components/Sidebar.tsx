import { useMemo, useState } from 'react';
import type { DocumentMeta } from '../types';
import { DocumentItem } from './DocumentItem';
import { UploadButton } from './UploadButton';

interface Props {
  documents: DocumentMeta[];
  categories: string[];
  selectedIds: Set<string>;
  loading: boolean;
  uploading: boolean;
  error: string | null;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onSelectMany: (ids: string[]) => void;
  onUpload: (file: File, category: string) => void | Promise<unknown>;
  onDelete: (id: string) => void;
  onChangeCategory: (id: string, category: string) => void | Promise<void>;
  onAddCategory: (name: string) => void | Promise<unknown>;
  onDeleteCategory: (name: string) => void | Promise<unknown>;
  onNewChat: () => void;
}

const UNCATEGORIZED = 'Uncategorized';

function sortCategories(names: string[]): string[] {
  return [...names].sort((a, b) => {
    if (a === UNCATEGORIZED) return 1;
    if (b === UNCATEGORIZED) return -1;
    return a.localeCompare(b);
  });
}

export function Sidebar({
  documents,
  categories,
  selectedIds,
  loading,
  uploading,
  error,
  onToggle,
  onSelectAll,
  onClearSelection,
  onSelectMany,
  onUpload,
  onDelete,
  onChangeCategory,
  onAddCategory,
  onDeleteCategory,
  onNewChat,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCat, setDragOverCat] = useState<string | null>(null);

  const allSelected =
    documents.length > 0 && selectedIds.size === documents.length;

  const docsById = useMemo(
    () => new Map(documents.map((d) => [d.id, d])),
    [documents],
  );

  // All known categories (persisted, including empty ones) plus any in use,
  // so a category does not disappear when its last document is moved out.
  const sortedCategories = useMemo(() => {
    const used = documents.map((d) => d.category || UNCATEGORIZED);
    return sortCategories(Array.from(new Set([...categories, ...used])));
  }, [categories, documents]);

  const groups = useMemo(() => {
    const map = new Map<string, DocumentMeta[]>();
    for (const d of documents) {
      const c = d.category || UNCATEGORIZED;
      const list = map.get(c);
      if (list) list.push(d);
      else map.set(c, [d]);
    }
    return sortedCategories.map((name) => ({
      name,
      docs: map.get(name) ?? [],
    }));
  }, [documents, sortedCategories]);

  const toggleCollapse = (name: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const endDrag = () => {
    setDraggingId(null);
    setDragOverCat(null);
  };

  const handleDrop = (category: string) => {
    const doc = draggingId ? docsById.get(draggingId) : undefined;
    if (doc && (doc.category || UNCATEGORIZED) !== category) {
      onChangeCategory(doc.id, category);
    }
    endDrag();
  };

  const handleMove = (doc: DocumentMeta) => {
    const hint = sortedCategories.length
      ? `\n\nExisting categories: ${sortedCategories.join(', ')}`
      : '';
    const next = prompt(
      `Move "${doc.filename}" to which category?${hint}`,
      doc.category || UNCATEGORIZED,
    );
    if (next != null && next.trim() && next.trim() !== doc.category) {
      onChangeCategory(doc.id, next.trim());
    }
  };

  const handleAddCategory = () => {
    const name = prompt('New category name:');
    if (name != null && name.trim()) onAddCategory(name.trim());
  };

  const handleDeleteCategory = (name: string, count: number) => {
    const msg = count
      ? `Delete category "${name}"? Its ${count} document(s) will move to Uncategorized.`
      : `Delete empty category "${name}"?`;
    if (confirm(msg)) onDeleteCategory(name);
  };

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

        <UploadButton
          onUpload={onUpload}
          uploading={uploading}
          categories={sortedCategories}
        />

        <button
          type="button"
          className="new-category-btn"
          onClick={handleAddCategory}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 3v10M3 8h10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          New category
        </button>

        {error && <div className="sidebar__error">{error}</div>}

        <div className="sidebar__list">
          {loading ? (
            <div className="sidebar__empty">Loading…</div>
          ) : groups.length === 0 ? (
            <div className="sidebar__empty">No documents yet</div>
          ) : (
            groups.map((group) => {
              const isCollapsed = collapsed.has(group.name);
              const isDropTarget =
                dragOverCat === group.name &&
                draggingId != null &&
                docsById.get(draggingId)?.category !== group.name;
              return (
                <div
                  className={`doc-group${
                    isDropTarget ? ' doc-group--droptarget' : ''
                  }`}
                  key={group.name}
                  onDragOver={(e) => {
                    if (draggingId == null) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverCat !== group.name) setDragOverCat(group.name);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop(group.name);
                  }}
                >
                  <div className="doc-group__head">
                    <button
                      type="button"
                      className="doc-group__toggle"
                      onClick={() => toggleCollapse(group.name)}
                      title={isCollapsed ? 'Expand' : 'Collapse'}
                    >
                      <span
                        className={`doc-group__chevron${
                          isCollapsed ? ' doc-group__chevron--collapsed' : ''
                        }`}
                      >
                        ▾
                      </span>
                      <span className="doc-group__title">{group.name}</span>
                      <span className="doc-group__count">
                        {group.docs.length}
                      </span>
                    </button>
                    {group.docs.length > 0 && (
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() =>
                          onSelectMany(group.docs.map((d) => d.id))
                        }
                        title={`Ask across all of "${group.name}"`}
                      >
                        ask all
                      </button>
                    )}
                    {group.name !== UNCATEGORIZED && (
                      <button
                        type="button"
                        className="doc-group__delete"
                        onClick={() =>
                          handleDeleteCategory(group.name, group.docs.length)
                        }
                        aria-label={`Delete category ${group.name}`}
                        title="Delete category"
                      >
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                          <path
                            d="M4 4l8 8M12 4l-8 8"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    )}
                  </div>

                  {!isCollapsed &&
                    (group.docs.length > 0 ? (
                      group.docs.map((d) => (
                        <DocumentItem
                          key={d.id}
                          doc={d}
                          selected={selectedIds.has(d.id)}
                          dragging={draggingId === d.id}
                          onToggle={onToggle}
                          onDelete={onDelete}
                          onMove={handleMove}
                          onDragStart={(doc) => setDraggingId(doc.id)}
                          onDragEnd={endDrag}
                        />
                      ))
                    ) : (
                      <div className="doc-group__empty">
                        Empty — drag PDFs here
                      </div>
                    ))}
                </div>
              );
            })
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
