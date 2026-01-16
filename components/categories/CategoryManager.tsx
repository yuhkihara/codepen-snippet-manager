'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
}

interface CategoryManagerProps {
  value: string;
  onChange: (category: string) => void;
}

export default function CategoryManager({ value, onChange }: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAdding, setIsAdding] = useState(false);
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
      toast.error(`カテゴリの追加に失敗しました: ${error.message}`, { duration: 3000 });
      return;
    }

    toast.success('カテゴリを追加しました', { duration: 2000 });
    setNewCategoryName('');
    setIsAdding(false);
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
      toast.error('カテゴリの更新に失敗しました', { duration: 2000 });
      return;
    }

    toast.success('カテゴリを更新しました', { duration: 2000 });
    setEditingId(null);
    setEditingName('');
    loadCategories();
  };

  const deleteCategory = async (id: string, name: string) => {
    if (!confirm(`カテゴリ「${name}」を削除しますか？`)) return;

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
    <div className="space-y-2">
      <div className="flex gap-2 items-stretch">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          required
        >
          <option value="">カテゴリを選択</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.name}>
              {cat.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition whitespace-nowrap flex items-center justify-center"
        >
          {isAdding ? 'キャンセル' : '追加'}
        </button>
      </div>

      {isAdding && (
        <div className="flex gap-2 items-stretch">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            placeholder="新しいカテゴリ名"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={addCategory}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition whitespace-nowrap flex items-center justify-center"
          >
            作成
          </button>
        </div>
      )}

      <div className="space-y-1 max-h-48 overflow-y-auto">
        {categories.map((cat) => (
          <div key={cat.id} className="flex gap-2 items-center">
            {editingId === cat.id ? (
              <>
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && updateCategory(cat.id)}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => updateCategory(cat.id)}
                  className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 whitespace-nowrap"
                >
                  保存
                </button>
                <button
                  onClick={() => {
                    setEditingId(null);
                    setEditingName('');
                  }}
                  className="px-3 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400 whitespace-nowrap"
                >
                  キャンセル
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-gray-700">{cat.name}</span>
                <button
                  onClick={() => {
                    setEditingId(cat.id);
                    setEditingName(cat.name);
                  }}
                  className="px-3 py-1 text-blue-600 text-xs hover:bg-blue-50 rounded whitespace-nowrap"
                >
                  編集
                </button>
                <button
                  onClick={() => deleteCategory(cat.id, cat.name)}
                  className="px-3 py-1 text-red-600 text-xs hover:bg-red-50 rounded whitespace-nowrap"
                >
                  削除
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
