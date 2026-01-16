'use client';

/**
 * Visual Editor Proof of Concept v2
 *
 * Integrates:
 * - Shadow DOM for style isolation
 * - @dnd-kit for drag and drop reordering
 * - @tiptap for inline text editing
 * - Zustand-like state management pattern
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEditor, EditorContent } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import HardBreak from '@tiptap/extension-hard-break';
import Placeholder from '@tiptap/extension-placeholder';
import { debounce } from 'lodash-es';
import { sanitizeHTML } from '@/lib/sanitize';

// ===== Types =====

interface EditableField {
  name: string;
  value: string;
}

interface ComponentData {
  id: string;
  type: string;
  html: string;
  editableFields: Record<string, EditableField>;
}

interface EditingState {
  componentId: string;
  fieldName: string;
}

// ===== Sample Data =====

const SAMPLE_COMPONENTS: ComponentData[] = [
  {
    id: crypto.randomUUID(),
    type: 'header',
    html: `
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; text-align: center; color: white;">
        <h1 data-editable="title" style="margin: 0 0 8px 0; font-size: 28px;">Welcome to Our Newsletter</h1>
        <p data-editable="subtitle" style="margin: 0; opacity: 0.9;">Stay updated with the latest news</p>
      </div>
    `,
    editableFields: {
      title: { name: 'title', value: 'Welcome to Our Newsletter' },
      subtitle: { name: 'subtitle', value: 'Stay updated with the latest news' },
    },
  },
  {
    id: crypto.randomUUID(),
    type: 'content',
    html: `
      <div style="padding: 24px;">
        <h2 data-editable="heading" style="color: #1a202c; margin: 0 0 16px 0;">Featured Article</h2>
        <p data-editable="body" style="color: #4a5568; line-height: 1.6; margin: 0;">
          This is a sample paragraph that demonstrates inline editing.
          Double-click to edit directly in the preview.
        </p>
      </div>
    `,
    editableFields: {
      heading: { name: 'heading', value: 'Featured Article' },
      body: { name: 'body', value: 'This is a sample paragraph that demonstrates inline editing.\nDouble-click to edit directly in the preview.' },
    },
  },
  {
    id: crypto.randomUUID(),
    type: 'cta',
    html: `
      <div style="padding: 24px; text-align: center; background: #f7fafc;">
        <p data-editable="cta-text" style="color: #4a5568; margin: 0 0 16px 0;">Ready to get started?</p>
        <a href="#" style="display: inline-block; background: #4299e1; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Get Started
        </a>
      </div>
    `,
    editableFields: {
      'cta-text': { name: 'cta-text', value: 'Ready to get started?' },
    },
  },
];

// ===== Sortable Component =====

interface SortableComponentProps {
  component: ComponentData;
  isSelected: boolean;
  editingField: EditingState | null;
  onSelect: (id: string) => void;
  onDoubleClick: (componentId: string, fieldName: string) => void;
  onTextChange: (componentId: string, fieldName: string, text: string) => void;
  onEditComplete: () => void;
}

function SortableComponent({
  component,
  isSelected,
  editingField,
  onSelect,
  onDoubleClick,
  onTextChange,
  onEditComplete,
}: SortableComponentProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: component.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);

  // Shadow DOMの初期化とコンテンツ更新
  useEffect(() => {
    if (!containerRef.current) return;

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

    // HTMLを更新
    let html = component.html;

    // editableFieldsの値をHTMLに反映
    Object.entries(component.editableFields).forEach(([name, field]) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const el = doc.querySelector(`[data-editable="${name}"]`);
      if (el) {
        // 改行を<br>に変換
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
          onDoubleClick(component.id, fieldName);
        }
      }
    };

    shadow.addEventListener('dblclick', handleDblClick);

    return () => {
      shadow.removeEventListener('dblclick', handleDblClick);
    };
  }, [component, onDoubleClick]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
      onClick={() => onSelect(component.id)}
    >
      {/* ドラッグハンドル */}
      <div
        {...attributes}
        {...listeners}
        className="absolute -left-8 top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-200 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/>
          <circle cx="15" cy="5" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
        </svg>
      </div>

      {/* Shadow DOMコンテナ */}
      <div ref={containerRef} className="min-h-[20px]" />

      {/* インラインエディタ（編集中のフィールドがある場合） */}
      {editingField && editingField.componentId === component.id && (
        <InlineEditor
          componentId={component.id}
          fieldName={editingField.fieldName}
          initialValue={component.editableFields[editingField.fieldName]?.value || ''}
          onTextChange={onTextChange}
          onComplete={onEditComplete}
        />
      )}
    </div>
  );
}

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
        placeholder: 'Type here...',
      }),
    ],
    content: `<p>${initialValue.replace(/\n/g, '</p><p>')}</p>`,
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[1em] p-2',
      },
    },
    onUpdate: ({ editor }) => {
      // 各段落を改行で結合
      const text = editor.getText();
      debouncedChange(text);
    },
    // SSR対応: Next.jsでのhydration mismatch防止
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
      <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-lg">
        <div className="text-sm text-gray-500 mb-2">
          Editing: <span className="font-mono">{fieldName}</span>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <EditorContent editor={editor} />
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={onComplete}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel (Esc)
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
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== Main Component =====

export function VisualEditorPoCv2() {
  const [components, setComponents] = useState<ComponentData[]>(SAMPLE_COMPONENTS);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<EditingState | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ドラッグ開始
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  // ドラッグ終了（並び替え）
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    setComponents((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  }, []);

  // コンポーネント選択
  const handleSelect = useCallback((id: string) => {
    setSelectedComponentId(id);
  }, []);

  // ダブルクリックで編集開始
  const handleDoubleClick = useCallback((componentId: string, fieldName: string) => {
    setEditingField({ componentId, fieldName });
  }, []);

  // テキスト変更
  const handleTextChange = useCallback((componentId: string, fieldName: string, text: string) => {
    setComponents((prev) =>
      prev.map((comp) => {
        if (comp.id !== componentId) return comp;
        return {
          ...comp,
          editableFields: {
            ...comp.editableFields,
            [fieldName]: { name: fieldName, value: text },
          },
        };
      })
    );
  }, []);

  // 編集完了
  const handleEditComplete = useCallback(() => {
    setEditingField(null);
  }, []);

  // 生成HTML
  // SSR時はDOMParserが使えないため、クライアントサイドでのみ実行
  const generatedHtml = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return components
      .map((comp) => {
        let html = comp.html;
        Object.entries(comp.editableFields).forEach(([name, field]) => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const el = doc.querySelector(`[data-editable="${name}"]`);
          if (el) {
            el.innerHTML = field.value.replace(/\n/g, '<br>');
          }
          html = doc.body.innerHTML;
        });
        return `<!-- component:${comp.id} -->\n<div data-component-id="${comp.id}" data-component-type="${comp.type}">\n${html}\n</div>\n<!-- /component:${comp.id} -->`;
      })
      .join('\n\n');
  }, [components]);

  const activeComponent = components.find((c) => c.id === activeId);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Visual Editor PoC v2 - dnd-kit + TipTap
        </h1>
        <p className="text-gray-600 mb-6">
          Drag components to reorder. Click to select. Double-click editable text to edit.
        </p>

        <div className="grid grid-cols-2 gap-6">
          {/* Visual Preview */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gray-800 text-white px-4 py-2 text-sm font-medium flex items-center justify-between">
              <span>Visual Preview (dnd-kit + Shadow DOM)</span>
              <span className="text-xs text-gray-400">{components.length} components</span>
            </div>
            <div className="p-8 pl-12">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={components.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4">
                    {components.map((component) => (
                      <SortableComponent
                        key={component.id}
                        component={component}
                        isSelected={selectedComponentId === component.id}
                        editingField={editingField}
                        onSelect={handleSelect}
                        onDoubleClick={handleDoubleClick}
                        onTextChange={handleTextChange}
                        onEditComplete={handleEditComplete}
                      />
                    ))}
                  </div>
                </SortableContext>

                <DragOverlay>
                  {activeComponent && (
                    <div className="opacity-80 shadow-2xl rounded-lg overflow-hidden">
                      <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(activeComponent.html) }} />
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            </div>
          </div>

          {/* Generated HTML */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gray-800 text-white px-4 py-2 text-sm font-medium">
              Generated HTML (Real-time Sync)
            </div>
            <pre className="p-4 text-xs overflow-auto max-h-[600px] bg-gray-900 text-green-400">
              <code>{generatedHtml}</code>
            </pre>
          </div>
        </div>

        {/* Debug Status */}
        <div className="mt-6 bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-900 mb-2">Debug Status</h2>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Selected:</span>{' '}
              <span className="font-mono text-blue-600">
                {selectedComponentId?.slice(0, 8) || 'none'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Editing:</span>{' '}
              <span className="font-mono text-green-600">
                {editingField ? `${editingField.fieldName}` : 'none'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Dragging:</span>{' '}
              <span className="font-mono text-orange-600">
                {activeId?.slice(0, 8) || 'none'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Components:</span>{' '}
              <span className="font-mono">{components.length}</span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
          <h3 className="font-semibold mb-2">Test Instructions:</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>Hover over a component to see the drag handle (left side)</li>
            <li>Drag the handle to reorder components</li>
            <li>Click to select a component (blue ring)</li>
            <li>Double-click on editable text to open the TipTap editor modal</li>
            <li>Edit text and click Save or press Escape to cancel</li>
            <li>Watch the HTML panel update in real-time</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
