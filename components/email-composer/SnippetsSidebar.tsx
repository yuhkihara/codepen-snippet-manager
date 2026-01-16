'use client';
import { useMemo, useState } from 'react';
import DraggableSnippetCard from './DraggableSnippetCard';
import SnippetPreviewModal from './SnippetPreviewModal';

interface Snippet {
  id: string;
  title: string;
  description: string | null;
  html: string;
  category: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface SnippetsSidebarProps {
  snippets: Snippet[];
}

export default function SnippetsSidebar({ snippets }: SnippetsSidebarProps) {
  const [previewSnippet, setPreviewSnippet] = useState<Snippet | null>(null);

  // タグごとにグループ化
  const groupedSnippets = useMemo(() => {
    const groups: Record<string, Snippet[]> = {};

    snippets.forEach(snippet => {
      const tags = snippet.tags && snippet.tags.length > 0 ? snippet.tags : ['タグなし'];
      tags.forEach(tag => {
        // #テンプレート タグは除外
        if (tag === '#テンプレート' || tag === 'テンプレート' || tag === '#template' || tag === 'template') {
          return;
        }

        if (!groups[tag]) {
          groups[tag] = [];
        }
        if (!groups[tag].some(s => s.id === snippet.id)) {
          groups[tag].push(snippet);
        }
      });
    });

    return groups;
  }, [snippets]);

  const sortedTags = useMemo(() => {
    return Object.keys(groupedSnippets).sort((a, b) => {
      if (a === 'タグなし') return 1;
      if (b === 'タグなし') return -1;
      return a.localeCompare(b);
    });
  }, [groupedSnippets]);

  return (
    <div className="h-full bg-gray-50 p-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <div className="w-1 h-6 bg-gradient-to-b from-primary-600 to-accent-600 rounded-full"></div>
          スニペット一覧
        </h2>
        <p className="text-xs text-gray-500 mt-1 ml-3">
          ドラッグしてメールに挿入 / ダブルクリックでプレビュー
        </p>
      </div>

      {snippets.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">同じカテゴリのスニペットがありません</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedTags.map(tag => (
            <div key={tag}>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                {tag === 'タグなし' ? tag : `#${tag}`}
                <span className="text-xs text-gray-400 font-normal">
                  ({groupedSnippets[tag].length})
                </span>
              </h3>
              <div className="space-y-2">
                {groupedSnippets[tag].map(snippet => (
                  <DraggableSnippetCard
                    key={snippet.id}
                    snippet={snippet}
                    onDoubleClick={setPreviewSnippet}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* プレビューモーダル */}
      {previewSnippet && (
        <SnippetPreviewModal
          snippet={previewSnippet}
          onClose={() => setPreviewSnippet(null)}
        />
      )}
    </div>
  );
}
