'use client';
import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { updateSnippetWithLock } from '@/lib/optimistic-lock';
import { toast } from 'sonner';

export function useAutosave(snippetId: string, initialUpdatedAt: string) {
  const { html, title, description, category, tags } = useEditorStore();
  const lastSavedRef = useRef({ html, title, description, category, tags });
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);

  // Sync updatedAt when initialUpdatedAt changes
  useEffect(() => {
    setUpdatedAt(initialUpdatedAt);
  }, [initialUpdatedAt]);

  useEffect(() => {
    const hasChanges = html !== lastSavedRef.current.html ||
                       title !== lastSavedRef.current.title ||
                       description !== lastSavedRef.current.description ||
                       category !== lastSavedRef.current.category ||
                       JSON.stringify(tags) !== JSON.stringify(lastSavedRef.current.tags);
    if (!hasChanges) return;

    // updatedAtが空文字列の場合は保存をスキップ（初期読み込み中）
    if (!updatedAt) {
      console.log('Skipping autosave: updatedAt not yet initialized');
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const updated = await updateSnippetWithLock(snippetId, updatedAt, { html, title, description, category, tags });
        setUpdatedAt(updated.updated_at);
        lastSavedRef.current = { html, title, description, category, tags };
        toast.success('保存しました', { duration: 2000 });
      } catch (error: any) {
        console.error('Autosave failed:', error);
        if (error.message === 'CONFLICT') {
          toast.error('競合が発生しました。ページを再読み込みしてください。', { duration: 4000 });
        } else {
          toast.error('保存に失敗しました', { duration: 4000 });
        }
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [html, title, description, category, tags, snippetId, updatedAt]);
}
