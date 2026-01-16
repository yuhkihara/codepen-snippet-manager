'use client';
import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useEmailComposerStore } from '@/store/emailComposerStore';
import { toast } from 'sonner';

export default function EmailCodeEditor() {
  const { html, setHtml } = useEmailComposerStore();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const lastCursorPositionRef = useRef<{ lineNumber: number; column: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const isDraggingRef = useRef(false);

  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined) return;

    // デバウンス処理（300ms）
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setHtml(value);
    }, 300);
  };

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;

    // カーソル位置が変更されたら保存（ドラッグ中は更新しない）
    editor.onDidChangeCursorPosition((e) => {
      // ドラッグ中はカーソル位置を更新しない（元の位置を保持）
      if (isDraggingRef.current) return;

      lastCursorPositionRef.current = {
        lineNumber: e.position.lineNumber,
        column: e.position.column,
      };
    });

    // 初期カーソル位置を保存
    const initialPosition = editor.getPosition();
    if (initialPosition) {
      lastCursorPositionRef.current = {
        lineNumber: initialPosition.lineNumber,
        column: initialPosition.column,
      };
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) {
      isDraggingRef.current = true; // ドラッグ開始
      setIsDragOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      isDraggingRef.current = false; // ドラッグ終了
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // カウンターをリセット
    dragCounterRef.current = 0;
    isDraggingRef.current = false; // ドラッグ終了

    // 即座にオーバーレイを消す
    setIsDragOver(false);

    const snippetHtml = e.dataTransfer.getData('text/plain');
    if (!snippetHtml || !editorRef.current) return;

    const editor = editorRef.current;

    // カーソル位置が指定されているか確認
    if (!lastCursorPositionRef.current) {
      toast.error('行を指定してからドロップしてください', {
        description: 'エディタ内でカーソル位置を指定してから、もう一度ドロップしてください。',
        duration: 4000,
      });
      return;
    }

    // ドラッグ前に保存したカーソル位置を使用
    const position = lastCursorPositionRef.current;

    if (position) {
      // 現在のモデルを取得
      const model = editor.getModel();
      if (!model) return;

      // 保存されたカーソル位置に挿入
      const range = {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      };

      // pushEditOperationsを使用
      model.pushEditOperations(
        [],
        [
          {
            range,
            text: '\n' + snippetHtml + '\n',
          },
        ],
        () => null
      );

      // カーソルを挿入したテキストの後ろに移動
      const lines = snippetHtml.split('\n');
      const newPosition = {
        lineNumber: position.lineNumber + lines.length + 1,
        column: 1,
      };

      // 新しいカーソル位置を保存
      lastCursorPositionRef.current = newPosition;

      // カーソルを設定し、挿入位置を画面中央に表示
      editor.setPosition(newPosition);
      editor.revealPositionInCenter(newPosition);

      // 手動でストアを更新（デバウンスをバイパス）
      const newValue = model.getValue();
      setHtml(newValue);

      // 最後にフォーカス
      editor.focus();
    }
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      // Monaco Editorのクリーンアップ
      editorRef.current = null;
    };
  }, []);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-primary-600 to-accent-600 rounded-full"></div>
            HTMLコード
          </h2>
          <p className="text-xs text-gray-500 mt-1 ml-3">
            最後のカーソル位置に挿入（ドロップで自動挿入） / 直接編集可能（300msデバウンス）
          </p>
        </div>
        <div className="text-xs text-gray-400">
          {html.length} 文字
        </div>
      </div>
      <div
        className="flex-1 relative"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* ドラッグ中のオーバーレイ - pointer-eventsをnoneにして親要素でイベントを処理 */}
        {isDragOver && (
          <div className="absolute inset-0 z-50 bg-primary-100/50 flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-primary-400">
              <div className="text-primary-600 text-center">
                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <p className="font-semibold">最後のカーソル位置に挿入</p>
                {lastCursorPositionRef.current && (
                  <p className="text-xs mt-1 text-primary-500">
                    行 {lastCursorPositionRef.current.lineNumber}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        <Editor
          height="100%"
          defaultLanguage="html"
          value={html}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: true,
            scrollBeyondLastLine: false,
            readOnly: false,
            automaticLayout: true,
            wordWrap: 'on',
            tabSize: 2,
            dragAndDrop: false, // ネイティブD&D無効化（DisposableStoreエラー対策）
          }}
        />
      </div>
    </div>
  );
}
