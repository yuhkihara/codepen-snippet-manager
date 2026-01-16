'use client';
import { useEditorStore } from '@/store/editorStore';

export default function ViewToggle() {
  const { viewMode, setViewMode } = useEditorStore();
  return (
    <div className="flex gap-2">
      <button onClick={() => setViewMode('code')} className={`px-4 py-2 rounded ${viewMode === 'code' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>コード</button>
      <button onClick={() => setViewMode('preview')} className={`px-4 py-2 rounded ${viewMode === 'preview' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>結果</button>
    </div>
  );
}
