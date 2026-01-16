'use client';

/**
 * Visual Preview Editor
 *
 * Features:
 * - Drag & drop reordering with @dnd-kit
 * - Inline text editing with @tiptap
 * - Shadow DOM for style isolation
 * - Real-time sync with Monaco Editor via Zustand store
 */

import { useState, useCallback, useMemo, useRef, useEffect, memo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEditor, EditorContent } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import HardBreak from '@tiptap/extension-hard-break';
import Placeholder from '@tiptap/extension-placeholder';
import { debounce } from 'lodash-es';
import { useEmailComposerStore } from '@/store/emailComposerStore';
import { sanitizeHTML } from '@/lib/sanitize';
import { Trash2, GripVertical, Undo, Redo } from 'lucide-react';

// ===== Sortable Component =====

interface SortableComponentProps {
  componentId: string;
}

const SortableComponent = memo(function SortableComponent({
  componentId,
}: SortableComponentProps) {
  const component = useEmailComposerStore((state) => state.components[componentId]);
  const selectedComponentId = useEmailComposerStore((state) => state.selectedComponentId);
  const editingField = useEmailComposerStore((state) => state.editingField);
  const setSelectedComponentId = useEmailComposerStore((state) => state.setSelectedComponentId);
  const setEditingField = useEmailComposerStore((state) => state.setEditingField);
  const updateEditableText = useEmailComposerStore((state) => state.updateEditableText);
  const deleteComponent = useEmailComposerStore((state) => state.deleteComponent);

  const isSelected = selectedComponentId === componentId;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: componentId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);

  // Shadow DOMの初期化とコンテンツ更新
  useEffect(() => {
    if (!containerRef.current || !component) return;

    if (!shadowRootRef.current) {
      shadowRootRef.current = containerRef.current.attachShadow({ mode: 'open' });
    }

    const shadow = shadowRootRef.current;

    // スタイル
    const styleContent = `
      :host {
        display: block;
      }
      * { box-sizing: border-box; }
      [data-editable] {
        cursor: text;
        transition: background-color 0.15s ease;
        border-radius: 2px;
      }
      [data-editable]:hover {
        background-color: rgba(59, 130, 246, 0.1);
      }
    `;

    // HTMLを更新（editableFieldsの値を反映）
    let html = component.innerHtml;
    Object.entries(component.editableFields).forEach(([name, field]) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const el = doc.querySelector(`[data-editable="${name}"]`);
      if (el) {
        el.innerHTML = field.value.replace(/\n/g, '<br>');
      }
      html = doc.body.innerHTML;
    });

    shadow.innerHTML = `
      <style>${styleContent}</style>
      <div class="component-content">${html}</div>
    `;

    // ダブルクリックイベント
    const handleDblClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const editableEl = target.closest('[data-editable]') as HTMLElement | null;
      if (editableEl) {
        const fieldName = editableEl.getAttribute('data-editable');
        if (fieldName) {
          setEditingField({ componentId, fieldName });
        }
      }
    };

    shadow.addEventListener('dblclick', handleDblClick);

    return () => {
      shadow.removeEventListener('dblclick', handleDblClick);
    };
  }, [component, componentId, setEditingField]);

  const handleSelect = useCallback(() => {
    setSelectedComponentId(componentId);
  }, [componentId, setSelectedComponentId]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('このコンポーネントを削除しますか？')) {
      deleteComponent(componentId);
    }
  }, [componentId, deleteComponent]);

  if (!component) return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group rounded-lg transition-all ${
        isSelected
          ? 'ring-2 ring-blue-500 ring-offset-2'
          : 'hover:ring-1 hover:ring-gray-300'
      }`}
      onClick={handleSelect}
    >
      {/* ツールバー */}
      <div
        className={`absolute -top-3 right-2 flex gap-1 transition-opacity ${
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        {/* ドラッグハンドル */}
        <div
          {...attributes}
          {...listeners}
          className="w-7 h-7 bg-gray-100 hover:bg-gray-200 rounded cursor-grab active:cursor-grabbing flex items-center justify-center shadow-sm border border-gray-200"
          title="ドラッグで並び替え"
        >
          <GripVertical className="w-4 h-4 text-gray-500" />
        </div>

        {/* 削除ボタン */}
        <button
          onClick={handleDelete}
          className="w-7 h-7 bg-red-50 hover:bg-red-100 rounded flex items-center justify-center shadow-sm border border-red-200"
          title="コンポーネントを削除"
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </button>
      </div>

      {/* Shadow DOMコンテナ */}
      <div ref={containerRef} className="min-h-[20px]" />

      {/* インラインエディタ（編集中のフィールドがある場合） */}
      {editingField && editingField.componentId === componentId && (
        <InlineEditor
          componentId={componentId}
          fieldName={editingField.fieldName}
          initialValue={component.editableFields[editingField.fieldName]?.value || ''}
          onTextChange={updateEditableText}
          onComplete={() => setEditingField(null)}
        />
      )}
    </div>
  );
});

// ===== Inline Editor (TipTap) =====

interface InlineEditorProps {
  componentId: string;
  fieldName: string;
  initialValue: string;
  onTextChange: (componentId: string, fieldName: string, text: string) => void;
  onComplete: () => void;
}

function InlineEditor({
  componentId,
  fieldName,
  initialValue,
  onTextChange,
  onComplete,
}: InlineEditorProps) {
  const debouncedChange = useMemo(
    () =>
      debounce((text: string) => {
        onTextChange(componentId, fieldName, text);
      }, 150),
    [componentId, fieldName, onTextChange]
  );

  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      HardBreak,
      Placeholder.configure({
        placeholder: 'テキストを入力...',
      }),
    ],
    content: `<p>${initialValue.replace(/\n/g, '</p><p>')}</p>`,
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[1em] p-3 prose prose-sm max-w-none',
      },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      debouncedChange(text);
    },
    immediatelyRender: false,
  });

  // Escapeで編集終了
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onComplete();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onComplete]);

  // 自動フォーカス
  useEffect(() => {
    editor?.commands.focus('end');
  }, [editor]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl p-5 w-full max-w-lg mx-4">
        <div className="text-sm text-gray-500 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          編集中: <span className="font-mono text-green-600">{fieldName}</span>
        </div>
        <div className="border-2 border-green-200 rounded-lg overflow-hidden bg-gray-50">
          <EditorContent editor={editor} />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          改行は自動的に &lt;br&gt; に変換されます
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onComplete}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            閉じる (Esc)
          </button>
          <button
            onClick={() => {
              if (editor) {
                onTextChange(componentId, fieldName, editor.getText());
              }
              onComplete();
            }}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            保存して閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== Main Component =====

export default function VisualPreviewEditor() {
  const componentOrder = useEmailComposerStore((state) => state.componentOrder);
  const components = useEmailComposerStore((state) => state.components);
  const selectedComponentId = useEmailComposerStore((state) => state.selectedComponentId);
  const reorderComponents = useEmailComposerStore((state) => state.reorderComponents);
  const addComponent = useEmailComposerStore((state) => state.addComponent);
  const undo = useEmailComposerStore((state) => state.undo);
  const redo = useEmailComposerStore((state) => state.redo);
  const canUndo = useEmailComposerStore((state) => state.canUndo);
  const canRedo = useEmailComposerStore((state) => state.canRedo);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [isExternalDragOver, setIsExternalDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || active.id === over.id) return;

      const oldIndex = componentOrder.indexOf(active.id as string);
      const newIndex = componentOrder.indexOf(over.id as string);
      reorderComponents(oldIndex, newIndex);
    },
    [componentOrder, reorderComponents]
  );

  // 外部からのドラッグ（サイドバーからのスニペット）
  const handleExternalDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) {
      setIsExternalDragOver(true);
    }
  }, []);

  const handleExternalDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleExternalDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsExternalDragOver(false);
    }
  }, []);

  const handleExternalDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsExternalDragOver(false);

    const snippetHtml = e.dataTransfer.getData('text/plain');
    if (!snippetHtml) return;

    // JSONデータからスニペットIDを取得
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

    // 選択中のコンポーネントの上（前）に挿入
    // 選択がない場合は末尾に追加
    let insertIndex: number | undefined;
    if (selectedComponentId) {
      const selectedIndex = componentOrder.indexOf(selectedComponentId);
      if (selectedIndex !== -1) {
        insertIndex = selectedIndex;
      }
    }

    addComponent(snippetHtml, snippetId, insertIndex);
  }, [addComponent, selectedComponentId, componentOrder]);

  const activeComponent = activeId ? components[activeId] : null;

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* ヘッダー */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-green-500 to-emerald-600 rounded-full"></div>
            ビジュアルエディター
          </h2>
          <p className="text-xs text-gray-500 mt-1 ml-3">
            ドラッグで並び替え / ダブルクリックでテキスト編集
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          <button
            onClick={undo}
            disabled={!canUndo()}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="元に戻す (Cmd+Z)"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo()}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="やり直し (Cmd+Shift+Z)"
          >
            <Redo className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-400 ml-2">
            {componentOrder.length} コンポーネント
          </span>
        </div>
      </div>

      {/* プレビューエリア */}
      <div
        className="flex-1 p-4 overflow-auto relative"
        onDragEnter={handleExternalDragEnter}
        onDragOver={handleExternalDragOver}
        onDragLeave={handleExternalDragLeave}
        onDrop={handleExternalDrop}
      >
        {/* ドラッグオーバーレイ */}
        {isExternalDragOver && (
          <div className="absolute inset-4 z-50 bg-green-100/80 rounded-xl border-2 border-dashed border-green-500 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <p className="text-green-700 font-semibold">ここにドロップしてコンポーネントを追加</p>
              <p className="text-green-600 text-sm mt-1">
                {selectedComponentId
                  ? `選択中のコンポーネントの上に挿入`
                  : `末尾に追加`}
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 min-h-full">
          {componentOrder.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-400">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-lg mb-2">コンポーネントがありません</p>
                <p className="text-sm">左のサイドバーからスニペットをドラッグ&ドロップしてください</p>
              </div>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={componentOrder}
                strategy={verticalListSortingStrategy}
              >
                <div className="p-4 space-y-4">
                  {componentOrder.map((id) => (
                    <SortableComponent key={id} componentId={id} />
                  ))}
                </div>
              </SortableContext>

              <DragOverlay>
                {activeComponent && (
                  <div className="opacity-90 shadow-2xl rounded-lg overflow-hidden bg-white border-2 border-blue-400">
                    <div
                      className="p-4"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHTML(activeComponent.innerHtml),
                      }}
                    />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  );
}
