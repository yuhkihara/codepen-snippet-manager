'use client';

import { useEffect } from 'react';
import { useEmailComposerStore } from '@/store/emailComposerStore';
import EmailComposerHeader from './EmailComposerHeader';
import SnippetsSidebar from './SnippetsSidebar';
import VisualPreviewEditor from './VisualPreviewEditor';
import EmailCodeEditor from './EmailCodeEditor';

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

interface EmailComposerClientProps {
  template: Snippet;
  snippets: Snippet[];
}

export default function EmailComposerClient({ template, snippets }: EmailComposerClientProps) {
  const { loadTemplate } = useEmailComposerStore();

  // 初期化: テンプレートデータをストアに設定
  useEffect(() => {
    loadTemplate(template);
  }, [template, loadTemplate]);

  return (
    <div className="h-screen flex flex-col">
      {/* ヘッダー */}
      <EmailComposerHeader />

      {/* メインコンテンツエリア（3画面レイアウト） */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* 左: スニペット一覧（固定幅・縮小不可） */}
        <div className="w-full lg:w-64 xl:w-72 2xl:w-80 flex-shrink-0 border-r border-gray-200 overflow-y-auto bg-white">
          <SnippetsSidebar snippets={snippets} />
        </div>

        {/* モバイル: 縦並び / デスクトップ: 横並び */}
        <div className="flex-1 flex flex-col lg:flex-row min-w-0">
          {/* ビジュアルエディター（旧: プレビュー） */}
          <div className="h-80 lg:h-auto lg:flex-1 border-b lg:border-b-0 lg:border-r border-gray-200 overflow-hidden min-w-0">
            <VisualPreviewEditor />
          </div>

          {/* コードエディタ */}
          <div className="flex-1 lg:flex-1 overflow-hidden min-w-0">
            <EmailCodeEditor />
          </div>
        </div>
      </div>
    </div>
  );
}
