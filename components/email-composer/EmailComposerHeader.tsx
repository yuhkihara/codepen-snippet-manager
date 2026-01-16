'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEmailComposerStore } from '@/store/emailComposerStore';
import SaveEmailDialog from './SaveEmailDialog';

export default function EmailComposerHeader() {
  const router = useRouter();
  const { html, title, category, tags, isDirty } = useEmailComposerStore();
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const handleBack = () => {
    if (isDirty) {
      const confirmed = window.confirm('保存されていない変更があります。戻りますか？');
      if (!confirmed) return;
    }
    router.back();
  };

  const handleSave = () => {
    setShowSaveDialog(true);
  };

  return (
    <>
      <header className="bg-gradient-to-r from-primary-600 via-primary-500 to-accent-600 shadow-lg">
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-white hover:text-primary-100 transition-colors group"
            >
              <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-medium">戻る</span>
            </button>
            <div className="h-6 w-px bg-white/30"></div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              📧 メールコンポーザー
              {isDirty && (
                <span className="text-xs bg-yellow-500 text-white px-2 py-1 rounded-full">
                  未保存
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/90 hidden sm:block truncate max-w-xs">
              {title || 'タイトルなし'}
            </span>
            <button
              onClick={handleSave}
              className="bg-white text-primary-600 px-4 sm:px-6 py-2 sm:py-3 rounded-xl hover:shadow-lg transition-shadow duration-150 text-sm sm:text-base font-semibold"
            >
              💾 保存
            </button>
          </div>
        </div>
      </header>

      <SaveEmailDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        html={html}
        initialTitle={title}
        category={category}
        tags={tags}
      />
    </>
  );
}
