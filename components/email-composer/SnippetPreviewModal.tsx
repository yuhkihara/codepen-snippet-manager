'use client';
import { useEffect, useRef } from 'react';
import { sanitizeHTML } from '@/lib/sanitize';

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

interface SnippetPreviewModalProps {
  snippet: Snippet;
  onClose: () => void;
}

export default function SnippetPreviewModal({ snippet, onClose }: SnippetPreviewModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col"
      >
        {/* ヘッダー */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-gray-900 truncate">
                {snippet.title}
              </h3>
              {snippet.description && (
                <p className="text-sm text-gray-600 mt-1">
                  {snippet.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {snippet.category}
                </span>
                {snippet.tags.map(tag => (
                  <span key={tag} className="text-xs text-primary-600 bg-primary-50 px-2 py-1 rounded">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 ml-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="閉じる"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* プレビュー */}
        <div className="flex-1 p-6 overflow-auto bg-gray-50">
          <div className="bg-white rounded-lg border-2 border-gray-200 p-4 shadow-sm">
            <iframe
              srcDoc={`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      margin: 0;
      padding: 16px;
      font-family: system-ui, -apple-system, sans-serif;
    }
  </style>
</head>
<body>
  ${sanitizeHTML(snippet.html)}
</body>
</html>`}
              className="w-full h-96 border-0"
              sandbox="allow-scripts"
              title={`${snippet.title}のプレビュー`}
            />
          </div>
        </div>

        {/* フッター */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              クリックまたはESCキーで閉じる
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span>{snippet.html.length} 文字</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
