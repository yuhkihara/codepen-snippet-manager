'use client';
import { useState, useMemo, useEffect, useRef, memo } from 'react';
import Link from 'next/link';
import { sanitizeHTML } from '@/lib/sanitize';
import { formatDate } from '@/lib/formatDate';

interface Snippet {
  id: string;
  title: string;
  description: string | null;
  updated_at: string;
  is_public: boolean;
  category: string;
  tags: string[];
  html: string;
}

interface SnippetsListProps {
  snippets: Snippet[];
  selectedTag?: string;
}

export default function SnippetsList({ snippets, selectedTag }: SnippetsListProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const initializedRef = useRef(false);

  // URLクエリパラメータからタグが指定されている場合、初期状態で選択
  useEffect(() => {
    if (selectedTag && !initializedRef.current) {
      setSelectedTags([selectedTag]);
      initializedRef.current = true;
    }
  }, [selectedTag]);

  // 全タグを抽出
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    snippets.forEach(snippet => {
      snippet.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [snippets]);

  // 全カテゴリを抽出
  const allCategories = useMemo(() => {
    const categorySet = new Set<string>();
    snippets.forEach(snippet => {
      if (snippet.category) {
        categorySet.add(snippet.category);
      }
    });
    return Array.from(categorySet).sort();
  }, [snippets]);

  // タグの切り替え
  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // カテゴリの選択
  const selectCategory = (category: string | null) => {
    setSelectedCategory(category);
  };

  // フィルタリングされたスニペット（タグとカテゴリの両方でフィルタリング）
  const filteredSnippets = useMemo(() => {
    let filtered = snippets;

    // タグでフィルタリング（AND条件）
    if (selectedTags.length > 0) {
      filtered = filtered.filter(snippet =>
        selectedTags.every(tag => snippet.tags?.includes(tag))
      );
    }

    // カテゴリでフィルタリング
    if (selectedCategory) {
      filtered = filtered.filter(snippet => snippet.category === selectedCategory);
    }

    return filtered;
  }, [snippets, selectedTags, selectedCategory]);


  const SnippetCard = memo(({ snippet }: { snippet: Snippet }) => (
    <Link
      href={`/snippets/${snippet.id}`}
      prefetch={false}
      className="block bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-2xl overflow-hidden hover:shadow-xl transition-shadow duration-150"
      style={{ willChange: 'box-shadow' }}
    >
      <div className="relative">
        {snippet.html && (
          <div className="w-full h-36 bg-gradient-to-br from-gray-50 to-gray-100 border-b-2 border-gray-200 overflow-hidden">
            <iframe
              srcDoc={sanitizeHTML(snippet.html)}
              sandbox="allow-scripts"
              className="w-full h-full pointer-events-none scale-75 origin-top-left"
              style={{ width: '133.33%', height: '133.33%' }}
              title={`${snippet.title}のプレビュー`}
            />
          </div>
        )}

        <div className="p-6">
          <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-1">
            {snippet.title}
          </h3>

          {snippet.description && (
            <p className="text-gray-600 text-sm mb-4 line-clamp-2 leading-relaxed">
              {snippet.description}
            </p>
          )}

          {snippet.tags && snippet.tags.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-4">
              {snippet.tags.map(tag => (
                <Link
                  key={tag}
                  href={`/snippets?tag=${encodeURIComponent(tag)}`}
                  prefetch={false}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs bg-gradient-to-r from-primary-100 to-accent-100 text-primary-800 px-3 py-1 rounded-lg hover:from-primary-600 hover:to-accent-600 hover:text-white transition-colors duration-150 flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  #{tag}
                </Link>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatDate(snippet.updated_at)}
            </div>
            {snippet.is_public && (
              <span className="flex items-center gap-1 text-xs bg-gradient-to-r from-green-500 to-green-600 text-white px-3 py-1 rounded-full font-medium shadow-sm">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                公開
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  ));
  SnippetCard.displayName = 'SnippetCard';

  return (
    <>
      {/* タグフィルターセクション */}
      <div className="mb-8 flex flex-col gap-4">
        {allTags.length > 0 && (
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-primary-600 to-accent-600 rounded-full"></div>
                <span className="text-base font-bold text-gray-900">
                  タグで絞り込み {selectedTags.length > 0 && (
                    <span className="ml-2 px-3 py-1 bg-gradient-to-r from-primary-600 to-accent-600 text-white text-xs rounded-full">
                      {selectedTags.length}個選択中
                    </span>
                  )}
                </span>
              </div>
              {selectedTags.length > 0 && (
                <button
                  onClick={() => setSelectedTags([])}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 hover:gap-2 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  クリア
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-150 flex items-center gap-1 ${
                    selectedTags.includes(tag)
                      ? 'bg-gradient-to-r from-primary-600 to-accent-600 text-white shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 shadow-sm'
                  }`}
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* カテゴリフィルターセクション */}
        {allCategories.length > 0 && (
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-primary-600 to-accent-600 rounded-full"></div>
                <span className="text-base font-bold text-gray-900">
                  カテゴリで絞り込み {selectedCategory && (
                    <span className="ml-2 px-3 py-1 bg-gradient-to-r from-primary-600 to-accent-600 text-white text-xs rounded-full">
                      選択中
                    </span>
                  )}
                </span>
              </div>
              {selectedCategory && (
                <button
                  onClick={() => selectCategory(null)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 hover:gap-2 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  クリア
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {allCategories.map(category => (
                <button
                  key={category}
                  onClick={() => selectCategory(selectedCategory === category ? null : category)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-150 flex items-center gap-1 ${
                    selectedCategory === category
                      ? 'bg-gradient-to-r from-primary-600 to-accent-600 text-white shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 shadow-sm'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  {category}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSnippets.map((snippet) => (
          <SnippetCard key={snippet.id} snippet={snippet} />
        ))}
      </div>

      {filteredSnippets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl border border-gray-200 p-12 max-w-md text-center">
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto bg-gradient-to-r from-primary-600 to-accent-600 rounded-full flex items-center justify-center shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              {selectedTags.length > 0 || selectedCategory ? 'スニペットが見つかりません' : 'スニペットがまだありません'}
            </h3>
            <p className="text-gray-600 mb-6">
              {selectedTags.length > 0 || selectedCategory
                ? `選択した${selectedTags.length > 0 ? `タグ ${selectedTags.map(t => `#${t}`).join(' + ')}` : ''}${selectedTags.length > 0 && selectedCategory ? ' と ' : ''}${selectedCategory ? `カテゴリ「${selectedCategory}」` : ''} を持つスニペットが見つかりません`
                : '最初のスニペットを作成して、コードの整理を始めましょう'}
            </p>
            {selectedTags.length === 0 && !selectedCategory && (
              <Link
                href="/snippets/new"
                className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-primary-600 to-accent-600 text-white rounded-xl hover:from-primary-700 hover:to-accent-700 transition-colors duration-150 font-semibold shadow-md"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                最初のスニペットを作成
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
