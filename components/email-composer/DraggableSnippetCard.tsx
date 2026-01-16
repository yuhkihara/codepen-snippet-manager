'use client';
import { useState } from 'react';

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

interface DraggableSnippetCardProps {
  snippet: Snippet;
  onDoubleClick?: (snippet: Snippet) => void;
}

export default function DraggableSnippetCard({ snippet, onDoubleClick }: DraggableSnippetCardProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', snippet.html);
    e.dataTransfer.setData('application/json', JSON.stringify({
      id: snippet.id,
      html: snippet.html,
      title: snippet.title
    }));
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDoubleClick = () => {
    if (onDoubleClick) {
      onDoubleClick(snippet);
    }
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDoubleClick={handleDoubleClick}
      className={`
        bg-white rounded-lg border-2 border-gray-200 p-3 cursor-move
        hover:border-primary-400 hover:shadow-md transition-all duration-150
        ${isDragging ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}
      `}
    >
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 mt-1">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 truncate">
            {snippet.title}
          </h4>
          {snippet.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
              {snippet.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <span>{snippet.html.length} 文字</span>
          </div>
        </div>
      </div>
    </div>
  );
}
