'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useEditorStore } from '@/store/editorStore';
import { useAutosave } from '@/hooks/useAutosave';
import EditorPane from '@/components/editor/EditorPane';
import PreviewPane from '@/components/editor/PreviewPane';
import ViewToggle from '@/components/editor/ViewToggle';
import { toast } from 'sonner';

export default function EditSnippetPage() {
  const params = useParams();
  const router = useRouter();
  const { setHtml, setTitle, setDescription, setCategory, setTags, viewMode, title, description, category, tags } = useEditorStore();
  const [updatedAt, setUpdatedAt] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function loadCategories() {
      const { data } = await supabase
        .from('categories')
        .select('name')
        .order('name');
      setCategories(data?.map((c: any) => c.name) || ['その他']);
    }
    loadCategories();
  }, [supabase]);

  useEffect(() => {
    async function loadSnippet() {
      const { data, error } = await supabase
        .from('snippets')
        .select('*')
        .eq('id', params.id as string)
        .single();

      if (error || !data) {
        toast.error('スニペットが見つかりません', { duration: 4000 });
        router.push('/snippets');
        return;
      }
      setTitle(data.title);
      setDescription(data.description || '');
      setCategory(data.category || 'その他');
      setHtml(data.html);
      setTags(data.tags || []);
      setUpdatedAt(data.updated_at);
      setIsPublic(data.is_public);
    }
    loadSnippet();
  }, [params.id, router, setHtml, setTitle, setDescription, setCategory, setTags, supabase]);

  useAutosave(params.id as string, updatedAt);

  const togglePublic = async () => {
    try {
      const { data, error } = await supabase
        .from('snippets')
        .update({ is_public: !isPublic })
        .eq('id', params.id as string)
        .select()
        .single();

      if (error) throw error;
      setIsPublic(data.is_public);
      toast.success(data.is_public ? '公開しました' : '非公開にしました', { duration: 2000 });
    } catch (error) {
      console.error('Toggle public failed:', error);
      toast.error('更新に失敗しました', { duration: 4000 });
    }
  };

  const deleteSnippet = async () => {
    if (!confirm('このスニペットを削除しますか？')) return;

    try {
      const { error } = await supabase
        .from('snippets')
        .delete()
        .eq('id', params.id as string);

      if (error) throw error;
      toast.success('スニペットを削除しました', { duration: 2000 });
      router.push('/snippets');
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('削除に失敗しました', { duration: 4000 });
    }
  };

  const addTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().replace(/^#/, '');
      if (!tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b p-3 sm:p-4 bg-white">
        <div className="flex flex-col gap-3 mb-3 sm:mb-4">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => router.push('/snippets')}
              className="text-gray-600 hover:text-gray-900 flex-shrink-0 text-sm sm:text-base"
            >
              ← 戻る
            </button>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={deleteSnippet}
                className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition text-sm sm:text-base"
              >
                削除
              </button>
              <button
                onClick={togglePublic}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition text-sm sm:text-base ${
                  isPublic
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {isPublic ? '公開' : '非公開'}
              </button>
              <ViewToggle />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 text-lg sm:text-xl font-bold border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-2 min-w-0"
                placeholder="タイトル"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm sm:text-base"
                required
              >
                <option value="">カテゴリを選択</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm sm:text-base resize-none"
              placeholder="説明（任意）"
              rows={2}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
            >
              #{tag}
              <button
                onClick={() => removeTag(tag)}
                className="hover:text-blue-900 ml-1"
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={addTag}
            className="flex-1 sm:flex-none sm:w-48 border border-gray-300 rounded-full px-3 py-1 text-sm focus:outline-none focus:border-blue-500 min-w-0"
            placeholder="タグを追加 (Enterで確定)"
          />
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        {viewMode === 'code' ? <EditorPane /> : <PreviewPane />}
      </main>
    </div>
  );
}
