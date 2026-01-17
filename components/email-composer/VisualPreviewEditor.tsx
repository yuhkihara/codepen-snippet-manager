'use client';

/**
 * Visual Preview Editor
 *
 * Features:
 * - Drag & drop reordering with @dnd-kit
 * - Inline text editing with @tiptap
 * - Shadow DOM for style isolation
 * - Real-time sync with Monaco Editor via Zustand store
 * - Context menu for text styling (bold, colored text)
 */

import { useState, useCallback, useRef, useEffect, memo } from 'react';
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
import { Trash2, GripVertical, Undo, Redo } from 'lucide-react';

// ===== Context Menu Types =====

/**
 * Context menu item definition.
 * Designed for future extensibility (e.g., user-configurable items from settings).
 */
interface ContextMenuItem {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** HTML wrapper for the selected text. Use {text} as placeholder. */
  htmlTemplate: string;
  /** Optional icon component */
  icon?: React.ReactNode;
}

/**
 * Default context menu items.
 * These can be extended via settings in the future.
 */
const DEFAULT_CONTEXT_MENU_ITEMS: ContextMenuItem[] = [
  {
    id: 'bold',
    label: '太字',
    htmlTemplate: '<strong>{text}</strong>',
  },
  {
    id: 'red',
    label: '赤字',
    htmlTemplate: '<span style="color:#d70035;">{text}</span>',
  },
  {
    id: 'blue',
    label: '青字',
    htmlTemplate: '<span style="color:#0086ab;">{text}</span>',
  },
];

// ===== Context Menu Component =====

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onSelect: (item: ContextMenuItem) => void;
  onClose: () => void;
}

/**
 * Custom context menu component displayed on right-click.
 */
const ContextMenu = memo(function ContextMenu({
  x,
  y,
  items,
  onSelect,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // メニュー外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // 少し遅延させてから登録（右クリックイベント自体で閉じないように）
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // 画面端でのはみ出し防止
  const adjustedStyle: React.CSSProperties = {
    position: 'fixed',
    left: x,
    top: y,
    zIndex: 9999,
  };

  return (
    <div
      ref={menuRef}
      style={adjustedStyle}
      className="bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]"
    >
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item)}
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 transition-colors"
        >
          {item.icon && <span className="w-4 h-4">{item.icon}</span>}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
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

  // コンテキストメニュー状態
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    range: Range;
  } | null>(null);

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

            // 各要素に直接イベントリスナーを付ける
            // 入力中は同期しない。blur/keydown(Escape)時のみ同期
            htmlEl.addEventListener('blur', handleFocusOut);
            htmlEl.addEventListener('keydown', handleKeyDown);

            cleanupFunctions.push(() => {
              htmlEl.removeEventListener('blur', handleFocusOut);
              htmlEl.removeEventListener('keydown', handleKeyDown);
            });
          }
        });
      });

      // Shadow DOM内でのcontextmenuイベントをキャプチャ
      const handleShadowContextMenu = (e: Event) => {
        const mouseEvent = e as MouseEvent;

        // Shadow DOM内の選択を取得
        // getSelection()はShadow DOM内では特殊な処理が必要
        // ShadowRoot.getSelection()は実験的APIのため型定義を拡張
        const shadowWithSelection = shadow as ShadowRoot & { getSelection?: () => Selection | null };
        const selection = shadowWithSelection.getSelection
          ? shadowWithSelection.getSelection()
          : document.getSelection();

        if (!selection || selection.isCollapsed || !selection.rangeCount) {
          // 選択テキストがない場合はデフォルト動作
          return;
        }

        const range = selection.getRangeAt(0);
        const selectedText = range.toString();

        if (!selectedText || selectedText.trim() === '') {
          // 選択テキストが空の場合はデフォルト動作
          return;
        }

        // デフォルトのコンテキストメニューを抑制
        mouseEvent.preventDefault();
        mouseEvent.stopPropagation();

        // コンテキストメニューを表示
        setContextMenu({
          x: mouseEvent.clientX,
          y: mouseEvent.clientY,
          range: range.cloneRange(),
        });
      };

      const contentDiv = shadow.querySelector('.component-content');
      if (contentDiv) {
        contentDiv.addEventListener('contextmenu', handleShadowContextMenu);
        cleanupFunctions.push(() => {
          contentDiv.removeEventListener('contextmenu', handleShadowContextMenu);
        });
      }
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

  // コンテキストメニュー項目選択時の処理
  const handleContextMenuSelect = useCallback((item: ContextMenuItem) => {
    if (!contextMenu || !shadowRootRef.current) {
      setContextMenu(null);
      return;
    }

    const { range } = contextMenu;
    const selectedText = range.toString();

    if (!selectedText) {
      setContextMenu(null);
      return;
    }

    // 選択テキストをHTMLテンプレートで囲む
    const wrappedHtml = item.htmlTemplate.replace('{text}', selectedText);

    // 選択範囲を削除して新しいHTMLを挿入
    range.deleteContents();

    // HTMLを挿入（DocumentFragmentを使用）
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

    // コンテキストメニューを閉じる
    setContextMenu(null);

    // Storeに同期（編集完了扱い）
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
  }, [contextMenu, componentId, updateComponentHtml]);

  // コンテキストメニューを閉じる
  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  if (!component) return null;

  return (
    <>
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
      </div>

      {/* コンテキストメニュー（編集モード時のみ） */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={DEFAULT_CONTEXT_MENU_ITEMS}
          onSelect={handleContextMenuSelect}
          onClose={handleContextMenuClose}
        />
      )}
    </>
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
