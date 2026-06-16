import { useCallback, useEffect, useState } from 'react';
import type { DocumentMeta } from '../types';
import {
  deleteDocument,
  listDocuments,
  uploadDocument,
} from '../api/client';

export function useDocuments() {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const docs = await listDocuments();
      setDocuments(docs);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      try {
        const meta = await uploadDocument(file);
        setDocuments((prev) =>
          prev.some((d) => d.id === meta.id) ? prev : [...prev, meta],
        );
        return meta;
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setUploading(false);
      }
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    setError(null);
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, []);

  return { documents, loading, uploading, error, upload, remove, refresh };
}
