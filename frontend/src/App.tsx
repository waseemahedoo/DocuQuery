import { useCallback, useMemo, useState } from 'react';
import { ChatWindow } from './components/ChatWindow';
import { QuestionInput } from './components/QuestionInput';
import { Sidebar } from './components/Sidebar';
import { useChat } from './hooks/useChat';
import { useDocuments } from './hooks/useDocuments';

export default function App() {
  const { messages, isStreaming, sendMessage, stop, clear } = useChat();
  const {
    documents,
    categories,
    loading,
    uploading,
    error,
    upload,
    setCategory,
    addCategory,
    removeCategory,
    remove,
  } = useDocuments();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleDoc = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(documents.map((d) => d.id)));
  }, [documents]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectMany = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      await remove(id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    [remove],
  );

  const activeDocIds = useMemo(
    () => (selectedIds.size === 0 ? undefined : Array.from(selectedIds)),
    [selectedIds],
  );

  const handleSubmit = useCallback(
    (question: string) => {
      if (documents.length === 0) return;
      sendMessage(question, activeDocIds);
    },
    [sendMessage, activeDocIds, documents.length],
  );

  const noDocs = !loading && documents.length === 0;

  return (
    <div className="app">
      <Sidebar
        documents={documents}
        selectedIds={selectedIds}
        loading={loading}
        uploading={uploading}
        error={error}
        categories={categories}
        onToggle={toggleDoc}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        onSelectMany={selectMany}
        onUpload={upload}
        onDelete={handleDelete}
        onChangeCategory={setCategory}
        onAddCategory={addCategory}
        onDeleteCategory={removeCategory}
        onNewChat={clear}
      />
      <div className="content">
        <header className="header">
          <span className="header__title">Q&amp;A Bot</span>
        </header>
        <main className="main">
          <ChatWindow
            messages={messages}
            isStreaming={isStreaming}
            onSuggestion={handleSubmit}
            emptyHint={
              noDocs
                ? 'Upload a PDF in the sidebar to get started'
                : undefined
            }
          />
        </main>
        <QuestionInput
          onSubmit={handleSubmit}
          onStop={stop}
          isStreaming={isStreaming}
          disabled={documents.length === 0}
          placeholder={
            documents.length === 0
              ? 'Upload a PDF first…'
              : 'Ask a question…'
          }
        />
      </div>
    </div>
  );
}
