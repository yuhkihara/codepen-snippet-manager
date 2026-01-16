'use client';
import dynamic from 'next/dynamic';
import { useEditorStore } from '@/store/editorStore';

const MonacoEditor = dynamic(
  async () => {
    const mod = await import('@monaco-editor/react');
    // CSPで許可されているunpkg.comを使用
    mod.loader.config({
      paths: { vs: 'https://unpkg.com/monaco-editor@0.52.0/min/vs' }
    });
    return mod.Editor;
  },
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-[#1e1e1e] text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>エディタを読み込んでいます...</p>
        </div>
      </div>
    )
  }
);

export default function EditorPane() {
  const { html, setHtml } = useEditorStore();

  const handleEditorMount = (editor: any, monaco: any) => {
    console.log('Monaco Editor mounted successfully', { editor, monaco });
  };

  return (
    <MonacoEditor
      height="100%"
      defaultLanguage="html"
      value={html}
      onChange={(value) => setHtml(value || '')}
      onMount={handleEditorMount}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        automaticLayout: true,
      }}
    />
  );
}
