'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { TextStyle } from '@/types';
import { Type, Plus, GripVertical } from 'lucide-react';

/**
 * Default text styles that are always available
 */
const DEFAULT_STYLES = [
  { name: '太字', html_template: '<strong>{text}</strong>', icon_color: '#000000' },
  { name: '赤字', html_template: '<span style="color:#d70035;">{text}</span>', icon_color: '#d70035' },
  { name: '青字', html_template: '<span style="color:#0086ab;">{text}</span>', icon_color: '#0086ab' },
];

export default function TextStyleSettings() {
  const [styles, setStyles] = useState<TextStyle[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newStyle, setNewStyle] = useState({ name: '', html_template: '', icon_color: '#000000' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingStyle, setEditingStyle] = useState({ name: '', html_template: '', icon_color: '#000000' });
  const supabase = createClient();

  const loadStyles = useCallback(async () => {
    const { data, error } = await supabase
      .from('text_styles')
      .select('*')
      .order('sort_order');

    if (error) {
      console.error('Failed to load text styles:', error);
      return;
    }
    setStyles(data || []);
  }, [supabase]);

  useEffect(() => {
    loadStyles();
  }, [loadStyles]);

  const addStyle = async () => {
    if (!newStyle.name.trim() || !newStyle.html_template.trim()) {
      toast.error('名前とHTMLテンプレートは必須です', { duration: 2000 });
      return;
    }

    if (!newStyle.html_template.includes('{text}')) {
      toast.error('HTMLテンプレートには {text} を含めてください', { duration: 2000 });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('ユーザー情報の取得に失敗しました', { duration: 2000 });
      return;
    }

    const { error } = await supabase
      .from('text_styles')
      .insert({
        name: newStyle.name.trim(),
        html_template: newStyle.html_template.trim(),
        icon_color: newStyle.icon_color,
        owner_id: user.id,
        sort_order: styles.length,
      });

    if (error) {
      console.error('Failed to add text style:', error);
      if (error.code === '23505') {
        toast.error('このスタイル名は既に存在します', { duration: 2000 });
      } else {
        toast.error('スタイルの追加に失敗しました', { duration: 2000 });
      }
      return;
    }

    toast.success('スタイルを追加しました', { duration: 2000 });
    setNewStyle({ name: '', html_template: '', icon_color: '#000000' });
    setIsAdding(false);
    loadStyles();
  };

  const updateStyle = async (id: string) => {
    if (!editingStyle.name.trim() || !editingStyle.html_template.trim()) {
      toast.error('名前とHTMLテンプレートは必須です', { duration: 2000 });
      return;
    }

    if (!editingStyle.html_template.includes('{text}')) {
      toast.error('HTMLテンプレートには {text} を含めてください', { duration: 2000 });
      return;
    }

    const { error } = await supabase
      .from('text_styles')
      .update({
        name: editingStyle.name.trim(),
        html_template: editingStyle.html_template.trim(),
        icon_color: editingStyle.icon_color,
      })
      .eq('id', id);

    if (error) {
      console.error('Failed to update text style:', error);
      if (error.code === '23505') {
        toast.error('このスタイル名は既に存在します', { duration: 2000 });
      } else {
        toast.error('スタイルの更新に失敗しました', { duration: 2000 });
      }
      return;
    }

    toast.success('スタイルを更新しました', { duration: 2000 });
    setEditingId(null);
    loadStyles();
  };

  const deleteStyle = async (id: string, name: string) => {
    if (!confirm(`スタイル「${name}」を削除しますか？`)) return;

    const { error } = await supabase
      .from('text_styles')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete text style:', error);
      toast.error('スタイルの削除に失敗しました', { duration: 2000 });
      return;
    }

    toast.success('スタイルを削除しました', { duration: 2000 });
    loadStyles();
  };

  const addDefaultStyles = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('ユーザー情報の取得に失敗しました', { duration: 2000 });
      return;
    }

    const stylesToInsert = DEFAULT_STYLES.map((style, index) => ({
      ...style,
      owner_id: user.id,
      sort_order: styles.length + index,
    }));

    const { error } = await supabase
      .from('text_styles')
      .insert(stylesToInsert);

    if (error) {
      console.error('Failed to add default styles:', error);
      toast.error('デフォルトスタイルの追加に失敗しました', { duration: 2000 });
      return;
    }

    toast.success('デフォルトスタイルを追加しました', { duration: 2000 });
    loadStyles();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">テキストスタイル管理</h2>
        <p className="text-sm text-gray-600 mb-4">
          メールコンポーザーのツールバーに表示されるテキストスタイルを管理します。
        </p>

        {/* Default styles info */}
        {styles.length === 0 && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800 mb-3">
              まだスタイルが登録されていません。デフォルトスタイル（太字、赤字、青字）を追加しますか？
            </p>
            <button
              onClick={addDefaultStyles}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
            >
              デフォルトスタイルを追加
            </button>
          </div>
        )}

        {/* Add new style */}
        {isAdding ? (
          <div className="mb-4 p-4 border border-blue-200 rounded-lg bg-blue-50">
            <h3 className="font-medium text-gray-900 mb-3">新しいスタイルを追加</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  スタイル名
                </label>
                <input
                  type="text"
                  value={newStyle.name}
                  onChange={(e) => setNewStyle({ ...newStyle, name: e.target.value })}
                  placeholder="例: 緑字"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  HTMLテンプレート
                </label>
                <input
                  type="text"
                  value={newStyle.html_template}
                  onChange={(e) => setNewStyle({ ...newStyle, html_template: e.target.value })}
                  placeholder='例: <span style="color:#00aa00;">{text}</span>'
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {'{text}'} が選択テキストに置換されます
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  アイコン色
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newStyle.icon_color}
                    onChange={(e) => setNewStyle({ ...newStyle, icon_color: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newStyle.icon_color}
                    onChange={(e) => setNewStyle({ ...newStyle, icon_color: e.target.value })}
                    className="w-24 px-2 py-1 border border-gray-300 rounded text-sm font-mono"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={addStyle}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                >
                  追加
                </button>
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setNewStyle({ name: '', html_template: '', icon_color: '#000000' });
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition text-sm"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="mb-4 flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition text-sm text-gray-600 hover:text-blue-600"
          >
            <Plus className="w-4 h-4" />
            新しいスタイルを追加
          </button>
        )}

        {/* Styles list */}
        <div className="border rounded-lg divide-y">
          {styles.length === 0 && !isAdding ? (
            <div className="p-8 text-center text-gray-500">
              スタイルがまだありません
            </div>
          ) : (
            styles.map((style) => (
              <div key={style.id} className="p-4 hover:bg-gray-50">
                {editingId === style.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        スタイル名
                      </label>
                      <input
                        type="text"
                        value={editingStyle.name}
                        onChange={(e) => setEditingStyle({ ...editingStyle, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        HTMLテンプレート
                      </label>
                      <input
                        type="text"
                        value={editingStyle.html_template}
                        onChange={(e) => setEditingStyle({ ...editingStyle, html_template: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        アイコン色
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={editingStyle.icon_color}
                          onChange={(e) => setEditingStyle({ ...editingStyle, icon_color: e.target.value })}
                          className="w-10 h-10 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={editingStyle.icon_color}
                          onChange={(e) => setEditingStyle({ ...editingStyle, icon_color: e.target.value })}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => updateStyle(style.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition text-sm"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center"
                      style={{ backgroundColor: style.icon_color + '20' }}
                    >
                      <Type className="w-4 h-4" style={{ color: style.icon_color }} />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{style.name}</div>
                      <div className="text-xs text-gray-500 font-mono truncate">
                        {style.html_template}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingId(style.id);
                          setEditingStyle({
                            name: style.name,
                            html_template: style.html_template,
                            icon_color: style.icon_color,
                          });
                        }}
                        className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded transition text-sm"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => deleteStyle(style.id, style.name)}
                        className="px-3 py-1 text-red-600 hover:bg-red-50 rounded transition text-sm"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
