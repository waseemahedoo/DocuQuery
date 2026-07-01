import { useRef, useState } from 'react';

interface Props {
  onUpload: (file: File, category: string) => void | Promise<unknown>;
  uploading: boolean;
  categories: string[];
}

export function UploadButton({ onUpload, uploading, categories }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [category, setCategory] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPendingFile(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  const confirm = async () => {
    if (!pendingFile) return;
    const file = pendingFile;
    const chosen = category.trim() || 'Uncategorized';
    setPendingFile(null);
    setCategory('');
    await onUpload(file, chosen);
  };

  const cancel = () => {
    setPendingFile(null);
    setCategory('');
  };

  if (pendingFile) {
    return (
      <div className="upload-form">
        <div className="upload-form__file" title={pendingFile.name}>
          {pendingFile.name}
        </div>
        <input
          className="upload-form__input"
          list="category-options"
          value={category}
          autoFocus
          placeholder="Category (e.g. Cooking)"
          onChange={(e) => setCategory(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirm();
            if (e.key === 'Escape') cancel();
          }}
        />
        <datalist id="category-options">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <div className="upload-form__actions">
          <button
            type="button"
            className="upload-btn"
            onClick={confirm}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <span className="spinner" /> Indexing…
              </>
            ) : (
              'Add'
            )}
          </button>
          <button
            type="button"
            className="link-btn"
            onClick={cancel}
            disabled={uploading}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="upload-btn"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <>
            <span className="spinner" /> Indexing…
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 3v10M3 8h10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Upload PDF
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleChange}
        style={{ display: 'none' }}
      />
    </>
  );
}
