'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
}

export default function CategorySettings() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const supabase = createClient();

  const loadCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (error) {
      console.error('Failed to load categories:', error);
      return;
    }
    setCategories(data || []);
  }, [supabase]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const addCategory = async () => {
    if (!newCategoryName.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('ユーザー情報の取得に失敗しました', { duration: 2000 });
      return;
    }

    const { error } = await supabase
      .from('categories')
      .insert({ name: newCategoryName.trim(), owner_id: user.id });

    if (error) {
      console.error('Failed to add category:', error);
      if (error.code === '23505') {
        toast.error('このカテゴリは既に存在します', { duration: 2000 });
      } else {
        toast.error('カテゴリの追加に失敗しました', { duration: 2000 });
      }
      return;
    }

    toast.success('カテゴリを追加しました', { duration: 2000 });
    setNewCategoryName('');
    loadCategories();
  };

  const updateCategory = async (id: string) => {
    if (!editingName.trim()) return;

    const { error } = await supabase
      .from('categories')
      .update({ name: editingName.trim() })
      .eq('id', id);

    if (error) {
      console.error('Failed to update category:', error);
      if (error.code === '23505') {
        toast.error('このカテゴリ名は既に存在します', { duration: 2000 });
      } else {
        toast.error('カテゴリの更新に失敗しました', { duration: 2000 });
      }
      return;
    }

    toast.success('カテゴリを更新しました', { duration: 2000 });
    setEditingId(null);
    setEditingName('');
    loadCategories();
  };

  const deleteCategory = async (id: string, name: string) => {
    if (!confirm(`カテゴリ「${name}」を削除しますか？\nこのカテゴリを使用しているスニペットは影響を受けません。`)) return;

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete category:', error);
      toast.error('カテゴリの削除に失敗しました', { duration: 2000 });
      return;
    }

    toast.success('カテゴリを削除しました', { duration: 2000 });
    loadCategories();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">カテゴリ管理</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            新しいカテゴリを追加
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
              placeholder="カテゴリ名を入力"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm sm:text-base"
            />
            <button
              onClick={addCategory}
              disabled={!newCategoryName.trim()}
              className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              追加
            </button>
          </div>
        </div>

        <div className="border rounded-lg divide-y">
          {categories.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              カテゴリがまだありません
            </div>
          ) : (
            categories.map((cat) => (
              <div key={cat.id} className="p-3 sm:p-4 flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center hover:bg-gray-50">
                {editingId === cat.id ? (
                  <>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && updateCategory(cat.id)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm sm:text-base"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateCategory(cat.id)}
                        className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm sm:text-base"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditingName('');
                        }}
                        className="flex-1 sm:flex-none px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition text-sm sm:text-base"
                      >
                        キャンセル
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-gray-900 font-medium text-sm sm:text-base">{cat.name}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingId(cat.id);
                          setEditingName(cat.name);
                        }}
                        className="flex-1 sm:flex-none px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition text-sm sm:text-base"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => deleteCategory(cat.id, cat.name)}
                        className="flex-1 sm:flex-none px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition text-sm sm:text-base"
                      >
                        削除
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
