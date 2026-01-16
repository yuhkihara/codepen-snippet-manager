'use client';
import { useState } from 'react';
import Link from 'next/link';
import { sanitizeHTML } from '@/lib/sanitize';
import { formatDate } from '@/lib/formatDate';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Snippet {
  id: string;
  title: string;
  description: string | null;
  html: string;
  created_at: string;
  updated_at: string;
  is_public: boolean;
  tags: string[];
}

interface SnippetDetailProps {
  snippet: Snippet;
}

export default function SnippetDetail({ snippet }: SnippetDetailProps) {
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  // テンプレートタグの判定（#あり/なし両方に対応）
  const isTemplate = snippet.tags?.some(tag =>
    tag === '#テンプレート' ||
    tag === '#template' ||
    tag === 'テンプレート' ||
    tag === 'template'
  ) ?? false;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(snippet.html);
      setCopied(true);
      toast.success('コードをコピーしました', { duration: 2000 });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
      toast.error('コピーに失敗しました', { duration: 2000 });
    }
  };

  return (
    <div className="container mx-auto py-4 sm:py-8 px-4 max-w-5xl">
      {/* パンくずリストとナビゲーション */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
        >
          <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">戻る</span>
        </button>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/snippets" className="hover:text-primary-600 transition-colors">
            スニペット一覧
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium truncate max-w-[200px]">{snippet.title}</span>
        </div>
      </div>

      {/* メインカード */}
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {/* ヘッダー部分 */}
        <div className="bg-gradient-to-r from-primary-600 via-primary-500 to-accent-600 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 break-words drop-shadow-lg">
                {snippet.title}
              </h1>
              {snippet.description && (
                <p className="text-sm sm:text-base text-primary-50 break-words opacity-90">
                  {snippet.description}
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Link
                href={`/snippets/${snippet.id}/edit`}
                className="w-full sm:w-auto bg-white text-primary-600 px-6 py-3 rounded-xl hover:shadow-lg transition-shadow duration-150 text-center text-sm sm:text-base font-semibold flex-shrink-0"
              >
                ✏️ 編集
              </Link>
              {isTemplate && (
                <Link
                  href={`/email-composer/${snippet.id}`}
                  className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-shadow duration-150 text-center text-sm sm:text-base font-semibold flex-shrink-0"
                >
                  📧 このテンプレートを使う
                </Link>
              )}
            </div>
          </div>

          {/* タグ表示 */}
          {snippet.tags && snippet.tags.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-4">
              {snippet.tags.map(tag => (
                <Link
                  key={tag}
                  href={`/snippets?tag=${encodeURIComponent(tag)}`}
                  prefetch={false}
                  className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white hover:text-primary-600 transition-colors duration-150"
                >
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium">#{tag}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* メタ情報 */}
        <div className="px-6 sm:px-8 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex flex-wrap gap-4 sm:gap-6 text-xs sm:text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>作成: {formatDate(snippet.created_at)}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>更新: {formatDate(snippet.updated_at)}</span>
            </div>
            <div className="flex items-center gap-2">
              {snippet.is_public ? (
                <>
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span className="text-green-600 font-semibold">公開中</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="text-gray-400">非公開</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* プレビューセクション */}
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-6 bg-gradient-to-b from-primary-600 to-accent-600 rounded-full"></div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">プレビュー</h2>
          </div>
          <div className="relative">
            <iframe
              srcDoc={sanitizeHTML(snippet.html)}
              className="w-full h-64 sm:h-80 md:h-96 border-2 border-gray-200 rounded-xl shadow-lg bg-white"
              sandbox="allow-scripts"
              title="プレビュー"
            />
          </div>
        </div>

        {/* HTMLコードセクション */}
        <div className="p-6 sm:p-8 bg-gray-50 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-primary-600 to-accent-600 rounded-full"></div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">HTMLコード</h2>
            </div>
            <button
              onClick={copyToClipboard}
              className={`w-full sm:w-auto px-6 py-3 rounded-xl transition-colors duration-150 flex items-center justify-center gap-2 text-sm sm:text-base font-semibold shadow-md ${
                copied
                  ? 'bg-gradient-to-r from-green-500 to-green-600 text-white'
                  : 'bg-gradient-to-r from-primary-600 to-accent-600 text-white hover:from-primary-700 hover:to-accent-700'
              }`}
            >
              {copied ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  コピー済み
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  コピー
                </>
              )}
            </button>
          </div>
          <div className="relative">
            <div className="bg-gradient-to-r from-primary-600 to-accent-600 p-[2px] rounded-xl">
              <pre className="bg-dark-800 text-gray-100 p-4 sm:p-6 rounded-[10px] overflow-x-auto shadow-lg">
                <code className="text-xs sm:text-sm font-mono">{snippet.html}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* アクションボタン */}
      <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          href="/snippets"
          prefetch={false}
          className="flex items-center justify-center gap-2 px-8 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl hover:border-primary-600 hover:text-primary-600 transition-colors duration-150 font-semibold shadow-md"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          すべてのスニペット
        </Link>
        {snippet.tags && snippet.tags.length > 0 && (
          <Link
            href={`/snippets?tag=${encodeURIComponent(snippet.tags[0])}`}
            prefetch={false}
            className="flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-primary-600 to-accent-600 text-white rounded-xl hover:from-primary-700 hover:to-accent-700 transition-colors duration-150 font-semibold shadow-md"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            #{snippet.tags[0]} の関連スニペット
          </Link>
        )}
      </div>
    </div>
  );
}
