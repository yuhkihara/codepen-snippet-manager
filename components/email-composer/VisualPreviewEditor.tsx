'use client';

/**
 * Visual Preview Editor
 *
 * Features:
 * - Drag & drop reordering with @dnd-kit
 * - Inline text editing with contenteditable
 * - Shadow DOM for style isolation
 * - Real-time sync with Monaco Editor via Zustand store
 * - Floating toolbar for text styling (Medium-style)
 */

import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
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
import { useEmailComposerStore } from '@/store/emailComposerStore';
import { sanitizeHTML } from '@/lib/sanitize';
import { Trash2, GripVertical, Undo, Redo, Bold, Type } from 'lucide-react';

// ===== Floating Toolbar Types =====

interface StyleOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  htmlTemplate: string;
}

const STYLE_OPTIONS: StyleOption[] = [
  {
    id: 'bold',
    label: '太字',
    icon: <Bold className="w-4 h-4" />,
    htmlTemplate: '<strong>{text}</strong>',
  },
  {
    id: 'red',
    label: '赤字',
    icon: <Type className="w-4 h-4 text-red-600" />,
    htmlTemplate: '<span style="color:#d70035;">{text}</span>',
  },
  {
    id: 'blue',
    label: '青字',
    icon: <Type className="w-4 h-4 text-blue-600" />,
    htmlTemplate: '<span style="color:#0086ab;">{text}</span>',
  },
];

// ===== Floating Toolbar Component =====

interface FloatingToolbarProps {
  position: { x: number; y: number };
  onApplyStyle: (style: StyleOption) => void;
  onClose: () => void;
}

const FloatingToolbar = memo(function FloatingToolbar({
  position,
  onApplyStyle,
  onClose,
}: FloatingToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);

  // ツールバー外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // 少し遅延させて登録
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // 画面端でのはみ出し防止
  const adjustedX = Math.min(position.x, window.innerWidth - 150);
  const adjustedY = Math.max(position.y - 45, 10);

  return createPortal(
    <div
      ref={toolbarRef}
      className="fixed z-[9999] bg-gray-900 rounded-lg shadow-xl flex items-center gap-1 px-2 py-1.5 animate-in fade-in zoom-in-95 duration-150"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {STYLE_OPTIONS.map((option) => (
        <button
          key={option.id}
          onMouseDown={(e) => {
            // 選択を維持するためpreventDefault
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onApplyStyle(option);
          }}
          className="p-2 rounded hover:bg-gray-700 text-white transition-colors flex items-center justify-center"
          title={option.label}
        >
          {option.icon}
        </button>
      ))}
      {/* 矢印 */}
      <div
        className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-gray-900"
      />
    </div>,
    document.body
  );
});

// ===== Sortable Component =====

interface SortableComponentProps {
  componentId: string;
}

const SortableComponent = memo(function SortableComponent({
  componentId,
}: SortableComponentProps) {
  const component = useEmailComposerStore((state) => state.components[componentId]);
  const selectedComponentId = useEmailComposerStore((state) => state.selectedComponentId);
  const setSelectedComponentId = useEmailComposerStore((state) => state.setSelectedComponentId);
  const updateComponentHtml = useEmailComposerStore((state) => state.updateComponentHtml);
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
  const isUpdatingRef = useRef(false);
  const lastHtmlRef = useRef<string>('');
  const [isEditing, setIsEditing] = useState(false);

  // フローティングツールバー状態
  const [toolbarState, setToolbarState] = useState<{
    visible: boolean;
    position: { x: number; y: number };
    range: Range | null;
  }>({ visible: false, position: { x: 0, y: 0 }, range: null });

  // Shadow DOMの初期化（一度だけ実行）
  useEffect(() => {
    if (!containerRef.current) return;

    if (!shadowRootRef.current) {
      shadowRootRef.current = containerRef.current.attachShadow({ mode: 'open' });
    }
  }, []);

  // コンテンツ更新とイベントハンドラー設定
  useEffect(() => {
    if (!shadowRootRef.current || !component) return;

    const shadow = shadowRootRef.current;
    const html = component.innerHtml;
    const htmlChanged = lastHtmlRef.current !== html;

    // 編集中かつ自分の更新の場合はDOM再描画をスキップ（編集内容を保持）
    // ただしイベントリスナーのセットアップは常に行う
    const shouldSkipRerender = isEditing && isUpdatingRef.current;

    // HTMLが変わった場合のみコンテンツを再描画（編集中の自己更新はスキップ）
    if (!shouldSkipRerender && (htmlChanged || !shadow.querySelector('.component-content'))) {
      lastHtmlRef.current = html;

      const styleContent = `
        :host { display: block; }
        * { box-sizing: border-box; }
        .component-content.editing { cursor: text; }
        .component-content.editing [contenteditable="true"]:focus {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
          border-radius: 2px;
        }
        .component-content.editing [contenteditable="true"]:hover {
          background-color: rgba(59, 130, 246, 0.1);
        }
        .component-content h1, .component-content h2, .component-content h3,
        .component-content h4, .component-content h5, .component-content h6,
        .component-content p, .component-content span, .component-content td,
        .component-content th, .component-content li, .component-content label {
          min-height: 1em;
        }
      `;

      shadow.innerHTML = `
        <style>${styleContent}</style>
        <div class="component-content${isEditing ? ' editing' : ''}">${sanitizeHTML(html)}</div>
      `;
    }

    // クラスの更新（編集モード切替時）
    const contentDiv = shadow.querySelector('.component-content');
    if (contentDiv) {
      if (isEditing) {
        contentDiv.classList.add('editing');
      } else {
        contentDiv.classList.remove('editing');
        shadow.querySelectorAll('[contenteditable]').forEach((el) => {
          el.removeAttribute('contenteditable');
        });
      }
    }

    // === イベントハンドラー設定（常に実行）===

    // 編集内容をストアに同期する関数
    const syncToStore = () => {
      const contentDiv = shadow.querySelector('.component-content');
      if (!contentDiv) return;

      isUpdatingRef.current = true;
      const clone = contentDiv.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('[contenteditable]').forEach((el) => {
        el.removeAttribute('contenteditable');
      });
      clone.classList.remove('editing');
      const newHtml = clone.innerHTML;

      if (newHtml !== lastHtmlRef.current) {
        lastHtmlRef.current = newHtml;
        updateComponentHtml(componentId, newHtml);
      }

      requestAnimationFrame(() => {
        isUpdatingRef.current = false;
      });
    };

    const cleanupFunctions: (() => void)[] = [];

    const handleKeyDown = (e: KeyboardEvent) => {
      // < と > をエスケープ（HTMLタグとして解釈されるのを防止）
      if (e.key === '<' || e.key === '>') {
        e.preventDefault();
        const entity = e.key === '<' ? '&lt;' : '&gt;';
        document.execCommand('insertHTML', false, entity);
        // 入力中はStoreに同期しない（編集完了時にまとめて同期）
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        const target = e.target as HTMLElement;
        if (target.isContentEditable) {
          e.preventDefault();
          const selection = document.getSelection();
          if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
            selection.collapseToEnd();
          }
          document.execCommand('insertHTML', false, '<br>');
          // 入力中はStoreに同期しない
        }
      }
      if (e.key === 'Escape') {
        // Escape時は編集完了としてStoreに同期
        syncToStore();
        setIsEditing(false);
      }
    };

    // 入力中はStoreに同期しない（パフォーマンスと入力干渉を防ぐ）
    // 編集完了時（blur/Escape/他のコンポーネントクリック）にのみ同期

    const handleFocusOut = () => {
      // フォーカスが外れたら編集完了としてStoreに同期
      syncToStore();
    };

    // 編集モード時は各contenteditable要素に直接イベントリスナーを付ける
    if (isEditing) {
      console.log('[FloatingToolbar] isEditing=true, setting up event listeners');
      const editableTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'td', 'th', 'li', 'label'];

      editableTags.forEach((tag) => {
        shadow.querySelectorAll(`.component-content ${tag}`).forEach((el) => {
          // data-editableがある要素、または子要素がBRのみの要素を編集可能に
          const hasOnlyBrOrTextChildren = Array.from(el.childNodes).every(
            (node) => node.nodeType === Node.TEXT_NODE ||
                      (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'BR')
          );
          const isEditable = el.hasAttribute('data-editable') ||
                             (hasOnlyBrOrTextChildren && el.textContent?.trim());

          if (isEditable) {
            const htmlEl = el as HTMLElement;
            htmlEl.contentEditable = 'true';
            console.log('[FloatingToolbar] Made contenteditable:', htmlEl.tagName, htmlEl.textContent?.substring(0, 30));

            // マウスアップ時に選択を検出してツールバーを表示
            const handleMouseUp = () => {
              console.log('[FloatingToolbar] mouseup fired on:', htmlEl.tagName);
              // 少し遅延させて選択が確定するのを待つ
              setTimeout(() => {
                const selection = document.getSelection();
                console.log('[FloatingToolbar] selection:', selection);
                console.log('[FloatingToolbar] isCollapsed:', selection?.isCollapsed);
                console.log('[FloatingToolbar] rangeCount:', selection?.rangeCount);

                if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
                  const range = selection.getRangeAt(0);
                  const selectedText = range.toString();
                  console.log('[FloatingToolbar] selectedText:', selectedText);

                  if (selectedText && selectedText.trim()) {
                    // 選択範囲の位置を取得
                    const rect = range.getBoundingClientRect();
                    console.log('[FloatingToolbar] rect:', rect);
                    console.log('[FloatingToolbar] showing toolbar at:', {
                      x: rect.left + rect.width / 2 - 50,
                      y: rect.top,
                    });
                    setToolbarState({
                      visible: true,
                      position: {
                        x: rect.left + rect.width / 2 - 50,
                        y: rect.top,
                      },
                      range: range.cloneRange(),
                    });
                  }
                } else {
                  console.log('[FloatingToolbar] no valid selection, hiding toolbar');
                  // 選択がない場合はツールバーを非表示
                  setToolbarState(prev => ({ ...prev, visible: false, range: null }));
                }
              }, 10);
            };

            // 各要素に直接イベントリスナーを付ける
            // 入力中は同期しない。blur/keydown(Escape)時のみ同期
            htmlEl.addEventListener('blur', handleFocusOut);
            htmlEl.addEventListener('keydown', handleKeyDown);
            htmlEl.addEventListener('mouseup', handleMouseUp);

            cleanupFunctions.push(() => {
              htmlEl.removeEventListener('blur', handleFocusOut);
              htmlEl.removeEventListener('keydown', handleKeyDown);
              htmlEl.removeEventListener('mouseup', handleMouseUp);
            });
          }
        });
      });
    }

    return () => {
      cleanupFunctions.forEach(fn => fn());
    };
    // component?.innerHtmlのみに依存（componentオブジェクト全体ではなく）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [component?.innerHtml, isEditing, componentId, updateComponentHtml]);

  // 選択解除時に編集モードも解除（編集内容を同期してから）
  useEffect(() => {
    if (!isSelected && isEditing) {
      // 選択解除前に編集内容をStoreに同期
      if (shadowRootRef.current) {
        const contentDiv = shadowRootRef.current.querySelector('.component-content');
        if (contentDiv) {
          isUpdatingRef.current = true;
          const clone = contentDiv.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('[contenteditable]').forEach((el) => {
            el.removeAttribute('contenteditable');
          });
          clone.classList.remove('editing');
          const newHtml = clone.innerHTML;
          if (newHtml !== lastHtmlRef.current) {
            lastHtmlRef.current = newHtml;
            updateComponentHtml(componentId, newHtml);
          }
          requestAnimationFrame(() => {
            isUpdatingRef.current = false;
          });
        }
      }
      setIsEditing(false);
    }
  }, [isSelected, isEditing, componentId, updateComponentHtml]);

  const handleSelect = useCallback(() => {
    setSelectedComponentId(componentId);
  }, [componentId, setSelectedComponentId]);

  const handleDoubleClick = useCallback(() => {
    if (isSelected) {
      setIsEditing(true);
    }
  }, [isSelected]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('このコンポーネントを削除しますか？')) {
      deleteComponent(componentId);
    }
  }, [componentId, deleteComponent]);

  // フローティングツールバーでスタイル適用
  const handleApplyStyle = useCallback((style: StyleOption) => {
    const { range } = toolbarState;
    if (!range || !shadowRootRef.current) {
      setToolbarState(prev => ({ ...prev, visible: false, range: null }));
      return;
    }

    const selectedText = range.toString();
    if (!selectedText) {
      setToolbarState(prev => ({ ...prev, visible: false, range: null }));
      return;
    }

    // 選択テキストをスタイルで囲む
    const wrappedHtml = style.htmlTemplate.replace('{text}', selectedText);

    // 選択範囲を削除して新しいHTMLを挿入
    range.deleteContents();

    const temp = document.createElement('div');
    temp.innerHTML = wrappedHtml;
    const fragment = document.createDocumentFragment();
    while (temp.firstChild) {
      fragment.appendChild(temp.firstChild);
    }
    range.insertNode(fragment);

    // 選択をクリア
    const selection = document.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }

    // ツールバーを閉じる
    setToolbarState({ visible: false, position: { x: 0, y: 0 }, range: null });

    // Storeに同期
    const shadow = shadowRootRef.current;
    const contentDiv = shadow.querySelector('.component-content');
    if (contentDiv) {
      isUpdatingRef.current = true;
      const clone = contentDiv.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('[contenteditable]').forEach((el) => {
        el.removeAttribute('contenteditable');
      });
      clone.classList.remove('editing');
      const newHtml = clone.innerHTML;
      if (newHtml !== lastHtmlRef.current) {
        lastHtmlRef.current = newHtml;
        updateComponentHtml(componentId, newHtml);
      }
      requestAnimationFrame(() => {
        isUpdatingRef.current = false;
      });
    }
  }, [toolbarState, componentId, updateComponentHtml]);

  // ツールバーを閉じる
  const handleCloseToolbar = useCallback(() => {
    setToolbarState({ visible: false, position: { x: 0, y: 0 }, range: null });
  }, []);

  if (!component) return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group rounded-lg transition-all ${
        isSelected
          ? isEditing
            ? 'ring-2 ring-green-500 ring-offset-2'
            : 'ring-2 ring-blue-500 ring-offset-2'
          : 'hover:ring-1 hover:ring-gray-300'
      }`}
      onClick={handleSelect}
      onDoubleClick={handleDoubleClick}
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

      {/* フローティングツールバー（テキスト選択時に表示） */}
      {isEditing && toolbarState.visible && (
        <FloatingToolbar
          position={toolbarState.position}
          onApplyStyle={handleApplyStyle}
          onClose={handleCloseToolbar}
        />
      )}
    </div>
  );
});

export default function VisualPreviewEditor() {
  const componentOrder = useEmailComposerStore((state) => state.componentOrder);
  const components = useEmailComposerStore((state) => state.components);
  const selectedComponentId = useEmailComposerStore((state) => state.selectedComponentId);
  const headerHtml = useEmailComposerStore((state) => state.headerHtml);
  const footerHtml = useEmailComposerStore((state) => state.footerHtml);
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
            ドラッグで並び替え / 選択後ダブルクリックで編集モード
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

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 min-h-full overflow-hidden">
          {/* ヘッダー部分（固定・編集不可） */}
          {headerHtml && (
            <div
              className="opacity-80 pointer-events-none border-b-2 border-dashed border-gray-300"
              dangerouslySetInnerHTML={{ __html: sanitizeHTML(headerHtml) }}
            />
          )}

          {/* コンポーネント編集エリア */}
          {componentOrder.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-400 bg-blue-50/30 border-2 border-dashed border-blue-200 m-4 rounded-lg">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                <p className="text-lg mb-2 text-blue-600">コンポーネント挿入エリア</p>
                <p className="text-sm text-blue-500">左のサイドバーからスニペットをドラッグ&ドロップ</p>
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
                <div className="p-4 space-y-4 bg-blue-50/20 min-h-[100px]">
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

          {/* フッター部分（固定・編集不可） */}
          {footerHtml && (
            <div
              className="opacity-80 pointer-events-none border-t-2 border-dashed border-gray-300"
              dangerouslySetInnerHTML={{ __html: sanitizeHTML(footerHtml) }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
