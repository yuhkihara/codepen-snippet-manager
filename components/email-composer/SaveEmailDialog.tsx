'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface SaveEmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  html: string;
  initialTitle: string;
  category: string;
  tags: string[];
}

export default function SaveEmailDialog({ isOpen, onClose, html, initialTitle, category, tags }: SaveEmailDialogProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // ダイアログが開いた時にストアの最新値で状態を同期
  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle);
      setDescription('');
    }
  }, [isOpen, initialTitle]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('タイトルを入力してください');
      return;
    }

    setIsSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('認証が必要です');

      // #メール タグを追加（重複を避ける）
      const emailTags = [...new Set([...tags, '#メール'])];

      const { data, error } = await supabase
        .from('snippets')
        .insert({
          owner_id: user.id,
          title,
          description: description || null,
          html,
          category,
          tags: emailTags,
          is_public: false
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('メールを保存しました');
      router.push(`/snippets/${data.id}`);
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">メールを保存</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              タイトル <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="メールのタイトルを入力"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              説明（任意）
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              rows={3}
              placeholder="メールの説明を入力"
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600">
              <strong>カテゴリ:</strong> {category}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              <strong>タグ:</strong> {[...new Set([...tags, '#メール'])].map(t => `#${t.replace('#', '')}`).join(', ')}
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-xl hover:border-gray-400 transition-colors font-semibold disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-primary-600 to-accent-600 text-white rounded-xl hover:from-primary-700 hover:to-accent-700 transition-colors font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                保存中...
              </>
            ) : (
              '💾 保存'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
