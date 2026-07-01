import { useCallback, useEffect, useState } from 'react';
import type { DocumentMeta } from '../types';
import {
  createCategory,
  deleteCategory,
  deleteDocument,
  listCategories,
  listDocuments,
  updateDocumentCategory,
  uploadDocument,
} from '../api/client';

const UNCATEGORIZED = 'Uncategorized';

export function useDocuments() {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mergeCategory = useCallback((name: string) => {
    setCategories((prev) => (prev.includes(name) ? prev : [...prev, name]));
  }, []);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [docs, cats] = await Promise.all([
        listDocuments(),
        listCategories(),
      ]);
      setDocuments(docs);
      setCategories(cats);
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
    async (file: File, category: string) => {
      setUploading(true);
      setError(null);
      try {
        const meta = await uploadDocument(file, category);
        setDocuments((prev) =>
          prev.some((d) => d.id === meta.id)
            ? prev.map((d) => (d.id === meta.id ? meta : d))
            : [...prev, meta],
        );
        mergeCategory(meta.category);
        return meta;
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setUploading(false);
      }
    },
    [mergeCategory],
  );

  const setCategory = useCallback(
    async (id: string, category: string) => {
      setError(null);
      try {
        const meta = await updateDocumentCategory(id, category);
        setDocuments((prev) => prev.map((d) => (d.id === id ? meta : d)));
        mergeCategory(meta.category);
      } catch (err) {
        setError((err as Error).message);
        throw err;
      }
    },
    [mergeCategory],
  );

  const addCategory = useCallback(async (name: string) => {
    setError(null);
    try {
      const cats = await createCategory(name);
      setCategories(cats);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, []);

  const removeCategory = useCallback(async (name: string) => {
    setError(null);
    try {
      const cats = await deleteCategory(name);
      setCategories(cats);
      setDocuments((prev) =>
        prev.map((d) =>
          d.category === name ? { ...d, category: UNCATEGORIZED } : d,
        ),
      );
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, []);

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

  return {
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
    refresh,
  };
}
