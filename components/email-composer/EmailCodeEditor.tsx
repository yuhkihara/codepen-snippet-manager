'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useEmailComposerStore } from '@/store/emailComposerStore';
import { toast } from 'sonner';

export default function EmailCodeEditor() {
  const getHtml = useEmailComposerStore((state) => state.getHtml);
  const setHtml = useEmailComposerStore((state) => state.setHtml);
  const addComponent = useEmailComposerStore((state) => state.addComponent);
  const updateSeq = useEmailComposerStore((state) => state.updateSeq);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const lastCursorPositionRef = useRef<{ lineNumber: number; column: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const isDraggingRef = useRef(false);
  const lastSyncedSeqRef = useRef(0);
  const isInternalChangeRef = useRef(false);

  // Store変更時にMonacoを更新（外部からの変更のみ）
  useEffect(() => {
    if (!editorRef.current) return;
    if (lastSyncedSeqRef.current === updateSeq) return;
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      lastSyncedSeqRef.current = updateSeq;
      return;
    }

    const model = editorRef.current.getModel();
    if (!model) return;

    const html = getHtml();
    const currentValue = model.getValue();

    if (currentValue !== html) {
      // カーソル位置を保存
      const position = editorRef.current.getPosition();
      const scrollTop = editorRef.current.getScrollTop();

      // 全体を置換
      model.pushEditOperations(
        [],
        [{ range: model.getFullModelRange(), text: html }],
        () => null
      );

      // カーソル位置を復元
      if (position) {
        const lineCount = model.getLineCount();
        editorRef.current.setPosition({
          lineNumber: Math.min(position.lineNumber, lineCount),
          column: position.column,
        });
      }
      editorRef.current.setScrollTop(scrollTop);
    }

    lastSyncedSeqRef.current = updateSeq;
  }, [updateSeq, getHtml]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value === undefined) return;

    // デバウンス処理（300ms）
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      isInternalChangeRef.current = true;
      setHtml(value);
    }, 300);
  }, [setHtml]);

  const handleEditorDidMount = useCallback((editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;

    // カーソル位置が変更されたら保存（ドラッグ中は更新しない）
    editor.onDidChangeCursorPosition((e) => {
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
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) {
      isDraggingRef.current = true;
      setIsDragOver(true);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      isDraggingRef.current = false;
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounterRef.current = 0;
    isDraggingRef.current = false;
    setIsDragOver(false);

    const snippetHtml = e.dataTransfer.getData('text/plain');
    if (!snippetHtml) return;

    // JSONデータも取得してみる（スニペットIDが含まれている場合）
    let snippetId = '';
    try {
      const jsonData = e.dataTransfer.getData('application/json');
      if (jsonData) {
        const parsed = JSON.parse(jsonData);
        snippetId = parsed.id || '';
      }
    } catch {
      // JSONパース失敗は無視
    }

    // コンポーネントとして追加
    addComponent(snippetHtml, snippetId);

    toast.success('スニペットを追加しました', {
      description: 'ビジュアルエディターで並び替えやテキスト編集ができます',
      duration: 3000,
    });

    // エディタにフォーカス
    editorRef.current?.focus();
  }, [addComponent]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      editorRef.current = null;
    };
  }, []);

  // 現在のHTMLを取得
  const currentHtml = getHtml();

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-primary-600 to-accent-600 rounded-full"></div>
            HTMLコード
          </h2>
          <p className="text-xs text-gray-500 mt-1 ml-3">
            直接編集可能 / スニペットをドロップで追加
          </p>
        </div>
        <div className="text-xs text-gray-400">
          {currentHtml.length} 文字
        </div>
      </div>
      <div
        className="flex-1 relative"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragOver && (
          <div className="absolute inset-0 z-50 bg-primary-100/50 flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-primary-400">
              <div className="text-primary-600 text-center">
                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <p className="font-semibold">スニペットを追加</p>
                <p className="text-xs mt-1 text-primary-500">
                  ドロップして末尾に追加
                </p>
              </div>
            </div>
          </div>
        )}
        <Editor
          height="100%"
          defaultLanguage="html"
          value={currentHtml}
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
            dragAndDrop: false,
          }}
        />
      </div>
    </div>
  );
}
