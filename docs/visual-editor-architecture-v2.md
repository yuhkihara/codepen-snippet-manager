# メールプレビュー ビジュアルエディター アーキテクチャ v2

**作成日**: 2026-01-17
**ステータス**: ✅ 実装完了（2026-01-17）

---

## 変更履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|----------|
| v1 | 2026-01-17 | 初版作成 |
| v2 | 2026-01-17 | 批判的レビュー反映: SSOT問題、レースコンディション、エラーハンドリング追加 |
| v2.1 | 2026-01-17 | 実装完了、rawHtmlパターン追加、Monaco同期修正 |
| v2.2 | 2026-01-17 | Visual Editor入力中の同期を編集完了時のみに変更 |

---

## 1. 設計方針の変更点

### 1.1 iframe → Shadow DOM

**理由**:
- メールプレビュー内でJavaScript実行は不要
- postMessage通信のオーバーヘッド削減
- DOM直接アクセスによる実装簡素化
- レースコンディションのリスク軽減

```tsx
// Shadow DOMによるスタイル分離
const PreviewContainer = () => {
  const shadowRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);

  useEffect(() => {
    if (shadowRef.current && !shadowRootRef.current) {
      shadowRootRef.current = shadowRef.current.attachShadow({ mode: 'open' });
    }
  }, []);

  return <div ref={shadowRef} />;
};
```

### 1.2 単一データソース（SSOT）の徹底

**変更前（v1）**:
```
Monaco Editor (状態A) ←→ Zustand (状態B) ←→ iframe DOM (状態C)
         ↑                                           ↑
         └─────────── 3つの独立した状態 ─────────────┘
```

**変更後（v2）**:
```
                    ┌─────────────────┐
                    │  Zustand Store  │
                    │  (唯一の真実)    │
                    │                 │
                    │  - AST構造      │
                    │  - 選択状態     │
                    │  - 編集状態     │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌──────────┐  ┌──────────┐  ┌──────────┐
       │  Monaco   │  │  Shadow   │  │  操作    │
       │  Editor   │  │  DOM      │  │  履歴    │
       │  (View)   │  │  (View)   │  │  (View)  │
       └──────────┘  └──────────┘  └──────────┘
```

### 1.3 AST（抽象構文木）ベースの状態管理

HTMLテキストではなく、パース済みの構造体を保持:

```typescript
// コンポーネントの構造化表現
interface ComponentNode {
  id: string;                              // 一意識別子 (crypto.randomUUID())
  type: string;                            // header, content, footer, cta
  sourceSnippetId?: string;                // 元スニペットのID
  editableFields: Map<string, EditableField>;
  children: string;                        // 内部HTMLは文字列のまま保持
  attributes: Record<string, string>;
}

interface EditableField {
  name: string;
  currentValue: string;                    // プレーンテキスト（改行は\n）
  originalValue: string;                   // 変更検知用
}

// Storeの構造
interface EmailComposerState {
  // コンポーネントのマップ（順序はcomponentOrderで管理）
  components: Map<string, ComponentNode>;
  componentOrder: string[];               // IDの配列で順序を一元管理

  // 選択・編集状態
  selectedComponentId: string | null;
  editingField: { componentId: string; fieldName: string } | null;

  // 操作履歴
  history: HistoryState;

  // 派生状態（セレクタで計算）
  // getHtml(): string - AST → HTML変換
}
```

---

## 2. コンポーネント識別システム（改訂）

### 2.1 データ属性規約（変更なし）

```html
<!-- コンポーネントのルート要素 -->
<div data-component-id="550e8400-e29b-41d4-a716-446655440000"
     data-component-type="header">
  <h1 data-editable="title">編集可能テキスト</h1>
  <p data-editable="subtitle">サブタイトル</p>
</div>
```

### 2.2 ID生成（改善）

```typescript
// crypto.randomUUID()を使用（衝突リスクなし）
function generateComponentId(): string {
  return crypto.randomUUID();
}
```

### 2.3 ネスト禁止ルール（追加）

コンポーネントのネストは禁止し、フラットな構造を維持:

```html
<!-- 許可: フラット構造 -->
<div data-component-id="id-1">...</div>
<div data-component-id="id-2">...</div>

<!-- 禁止: ネスト構造 -->
<div data-component-id="id-1">
  <div data-component-id="id-2">...</div>  <!-- NG -->
</div>
```

---

## 3. システムアーキテクチャ（改訂）

### 3.1 コンポーネント構成

```
┌─────────────────────────────────────────────────────────────────────┐
│                      EmailComposerClient                            │
│  ┌──────────────┬──────────────────┬─────────────────────────────┐ │
│  │              │                  │                             │ │
│  │  Snippets    │  Monaco Editor   │  VisualPreviewEditor        │ │
│  │  Sidebar     │  (HTML View)     │  (Shadow DOM)               │ │
│  │              │                  │                             │ │
│  │              │  ┌────────────┐  │  ┌───────────────────────┐ │ │
│  │              │  │ 双方向     │  │  │ ComponentRenderer     │ │ │
│  │              │  │ バインド   │  │  │ ├─ SelectionOverlay   │ │ │
│  │              │  └────────────┘  │  │ ├─ DragHandle         │ │ │
│  │              │                  │  │ └─ InlineEditor       │ │ │
│  │              │                  │  └───────────────────────┘ │ │
│  └──────────────┴──────────────────┴─────────────────────────────┘ │
│                              │                                      │
│                    ┌─────────▼─────────┐                           │
│                    │   Zustand Store   │                           │
│                    │   (AST + State)   │                           │
│                    └─────────┬─────────┘                           │
│                              │                                      │
│                    ┌─────────▼─────────┐                           │
│                    │  History Manager  │                           │
│                    │  (Undo/Redo)      │                           │
│                    └───────────────────┘                           │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 新規コンポーネント一覧

| コンポーネント | 責務 |
|---------------|------|
| `VisualPreviewEditor.tsx` | Shadow DOMコンテナ、全体制御 |
| `ComponentRenderer.tsx` | 各コンポーネントの描画 |
| `SelectionOverlay.tsx` | 選択状態のビジュアル表示 |
| `DragHandle.tsx` | ドラッグハンドルUI |
| `InlineTextEditor.tsx` | contenteditable制御（TipTap使用） |
| `DropIndicator.tsx` | ドロップ位置のインジケータ |

### 3.3 Zustand Store（完全版）

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface ComponentNode {
  id: string;
  type: string;
  sourceSnippetId?: string;
  editableFields: Record<string, EditableField>;
  innerHtml: string;
}

interface EditableField {
  name: string;
  value: string;
}

interface HistoryEntry {
  type: 'add' | 'delete' | 'reorder' | 'text_change';
  timestamp: number;
  data: unknown;
  inverse: () => void;  // Undo用の逆操作
}

interface HistoryState {
  past: HistoryEntry[];
  future: HistoryEntry[];
}

interface EmailComposerState {
  // コアデータ
  components: Record<string, ComponentNode>;
  componentOrder: string[];
  templateId: string;
  category: string;

  // 選択・編集状態
  selectedComponentId: string | null;
  editingField: { componentId: string; fieldName: string } | null;

  // 履歴
  history: HistoryState;

  // ロック（レースコンディション防止）
  isUpdating: boolean;
  updateSeq: number;

  // アクション
  addComponent: (snippetHtml: string, snippetId: string, index?: number) => void;
  deleteComponent: (componentId: string) => void;
  reorderComponents: (fromIndex: number, toIndex: number) => void;
  updateEditableText: (componentId: string, fieldName: string, text: string) => void;
  setSelectedComponentId: (id: string | null) => void;
  setEditingField: (field: { componentId: string; fieldName: string } | null) => void;

  // 履歴操作
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // 派生データ
  getHtml: () => string;
  getComponentAt: (index: number) => ComponentNode | undefined;
}

export const useEmailComposerStore = create<EmailComposerState>()(
  immer((set, get) => ({
    components: {},
    componentOrder: [],
    templateId: '',
    category: '',
    selectedComponentId: null,
    editingField: null,
    history: { past: [], future: [] },
    isUpdating: false,
    updateSeq: 0,

    addComponent: (snippetHtml, snippetId, index) => {
      const id = crypto.randomUUID();
      const component = parseComponentFromHtml(snippetHtml, id, snippetId);

      set((state) => {
        // 履歴に追加
        state.history.past.push({
          type: 'add',
          timestamp: Date.now(),
          data: { id, index },
          inverse: () => get().deleteComponent(id),
        });
        state.history.future = [];

        // コンポーネント追加
        state.components[id] = component;
        if (index !== undefined) {
          state.componentOrder.splice(index, 0, id);
        } else {
          state.componentOrder.push(id);
        }
        state.updateSeq++;
      });
    },

    reorderComponents: (fromIndex, toIndex) => {
      set((state) => {
        const [removed] = state.componentOrder.splice(fromIndex, 1);
        state.componentOrder.splice(toIndex, 0, removed);

        state.history.past.push({
          type: 'reorder',
          timestamp: Date.now(),
          data: { fromIndex, toIndex },
          inverse: () => get().reorderComponents(toIndex, fromIndex),
        });
        state.history.future = [];
        state.updateSeq++;
      });
    },

    updateEditableText: (componentId, fieldName, text) => {
      set((state) => {
        const component = state.components[componentId];
        if (!component) return;

        const oldValue = component.editableFields[fieldName]?.value || '';
        component.editableFields[fieldName] = { name: fieldName, value: text };

        // 履歴（デバウンス考慮が必要）
        state.history.past.push({
          type: 'text_change',
          timestamp: Date.now(),
          data: { componentId, fieldName, oldValue, newValue: text },
          inverse: () => get().updateEditableText(componentId, fieldName, oldValue),
        });
        state.history.future = [];
        state.updateSeq++;
      });
    },

    undo: () => {
      const { past } = get().history;
      if (past.length === 0) return;

      const entry = past[past.length - 1];
      set((state) => {
        state.history.past.pop();
        state.history.future.unshift(entry);
      });
      entry.inverse();
    },

    redo: () => {
      const { future } = get().history;
      if (future.length === 0) return;

      const entry = future[0];
      set((state) => {
        state.history.future.shift();
        state.history.past.push(entry);
      });
      // redoは元の操作を再実行（inverseのinverse）
    },

    canUndo: () => get().history.past.length > 0,
    canRedo: () => get().history.future.length > 0,

    getHtml: () => {
      const { components, componentOrder } = get();
      return componentOrder
        .map((id) => {
          const component = components[id];
          if (!component) return '';
          return serializeComponent(component);
        })
        .join('\n');
    },

    // ... 他のアクション
  }))
);

// ヘルパー関数
function parseComponentFromHtml(
  html: string,
  id: string,
  snippetId: string
): ComponentNode {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // data-editable要素を抽出
  const editableFields: Record<string, EditableField> = {};
  doc.querySelectorAll('[data-editable]').forEach((el) => {
    const name = el.getAttribute('data-editable')!;
    editableFields[name] = {
      name,
      value: el.textContent || '',
    };
  });

  // ラッパーを追加してシリアライズ
  const wrapper = doc.createElement('div');
  wrapper.setAttribute('data-component-id', id);
  wrapper.setAttribute('data-component-type', 'snippet');
  wrapper.innerHTML = html;

  return {
    id,
    type: 'snippet',
    sourceSnippetId: snippetId,
    editableFields,
    innerHtml: html,
  };
}

function serializeComponent(component: ComponentNode): string {
  // editableFieldsの値をinnerHtmlに適用してシリアライズ
  let html = component.innerHtml;

  // DOMParserで解析し、data-editable要素を更新
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  Object.entries(component.editableFields).forEach(([name, field]) => {
    const el = doc.querySelector(`[data-editable="${name}"]`);
    if (el) {
      // 改行を<br>に変換
      el.innerHTML = field.value.replace(/\n/g, '<br>');
    }
  });

  const serializer = new XMLSerializer();
  const body = doc.body;

  return `<!-- component:${component.id} -->\n<div data-component-id="${component.id}" data-component-type="${component.type}">\n${body.innerHTML}\n</div>\n<!-- /component:${component.id} -->`;
}
```

---

## 4. ドラッグ&ドロップ（dnd-kit採用）

### 4.1 ライブラリ選定理由

| ライブラリ | 選定理由 |
|-----------|---------|
| **@dnd-kit/core** | React 18/19対応、アクセシビリティ、タッチ対応、軽量 |
| @dnd-kit/sortable | ソート機能の拡張 |
| @dnd-kit/utilities | CSS Transform等のユーティリティ |

### 4.2 実装パターン

```tsx
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';

function VisualPreviewEditor() {
  const { componentOrder, reorderComponents } = useEmailComposerStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = componentOrder.indexOf(active.id as string);
    const newIndex = componentOrder.indexOf(over.id as string);
    reorderComponents(oldIndex, newIndex);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={componentOrder}
        strategy={verticalListSortingStrategy}
      >
        {componentOrder.map((id) => (
          <SortableComponent key={id} id={id} />
        ))}
      </SortableContext>
      <DragOverlay>
        {/* ドラッグ中のプレビュー */}
      </DragOverlay>
    </DndContext>
  );
}

function SortableComponent({ id }: { id: string }) {
  const { components, selectedComponentId, setSelectedComponentId } =
    useEmailComposerStore();
  const component = components[id];

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => setSelectedComponentId(id)}
      className={selectedComponentId === id ? 'ring-2 ring-blue-500' : ''}
    >
      {/* ドラッグハンドル */}
      <div {...attributes} {...listeners} className="cursor-grab">
        <GripVertical />
      </div>

      {/* コンポーネント本体 */}
      <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(component.innerHtml) }} />
    </div>
  );
}
```

---

## 5. インラインテキスト編集（TipTap採用）

> **実装時の変更**: 実際の実装ではネイティブ`contenteditable`を使用。
> TipTapは複雑すぎるため採用を見送り。
> また、リアルタイム同期（デバウンス付き）ではなく、**編集完了時のみ同期**する方式に変更。

### 5.1 ライブラリ選定理由

| ライブラリ | 選定理由 |
|-----------|---------|
| **@tiptap/react** | ProseMirrorベース、React統合、IME対応済み |
| @tiptap/starter-kit | 基本機能セット |
| @tiptap/extension-placeholder | プレースホルダー表示 |

### 5.2 実装パターン

```tsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

interface InlineTextEditorProps {
  componentId: string;
  fieldName: string;
  initialValue: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}

function InlineTextEditor({
  componentId,
  fieldName,
  initialValue,
  onSave,
  onCancel,
}: InlineTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // シンプルなテキスト編集のみ
        heading: false,
        bulletList: false,
        orderedList: false,
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: 'テキストを入力...',
      }),
    ],
    content: initialValue,
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[1em] focus:ring-2 focus:ring-green-500',
      },
    },
    onUpdate: ({ editor }) => {
      // リアルタイム同期（デバウンス付き）
      debouncedSync(editor.getText());
    },
  });

  const debouncedSync = useMemo(
    () =>
      debounce((text: string) => {
        onSave(text);
      }, 150),
    [onSave]
  );

  // Escapeで編集キャンセル
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  // クリック外で保存
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onSave(editor?.getText() || '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editor, onSave]);

  return (
    <div ref={containerRef} className="inline-editor">
      <EditorContent editor={editor} />
    </div>
  );
}
```

### 5.3 改行→`<br>`変換

TipTapの出力をプレーンテキストで取得し、Store更新時に変換:

```typescript
// Storeのserialize時に変換
function serializeComponent(component: ComponentNode): string {
  // ...
  Object.entries(component.editableFields).forEach(([name, field]) => {
    const el = doc.querySelector(`[data-editable="${name}"]`);
    if (el) {
      // プレーンテキストの改行を<br>に変換
      el.innerHTML = escapeHtml(field.value).replace(/\n/g, '<br>');
    }
  });
  // ...
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

---

## 6. Monaco Editor同期

### 6.1 Store → Monaco（一方向）

Monaco EditorはStoreの派生データとして扱い、直接編集は別モードで対応:

```tsx
function EmailCodeEditor() {
  const { getHtml, updateSeq } = useEmailComposerStore();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const lastSyncedSeqRef = useRef(0);

  // Store変更時にMonacoを更新
  useEffect(() => {
    if (!editorRef.current) return;
    if (lastSyncedSeqRef.current === updateSeq) return;

    const html = getHtml();
    const model = editorRef.current.getModel();
    if (!model) return;

    // カーソル位置を保存
    const position = editorRef.current.getPosition();
    const scrollTop = editorRef.current.getScrollTop();

    // 差分更新（全体置換ではなく）
    const currentValue = model.getValue();
    if (currentValue !== html) {
      model.pushEditOperations(
        [],
        [{ range: model.getFullModelRange(), text: html }],
        () => null
      );
    }

    // カーソル位置を復元
    if (position) {
      const lineCount = model.getLineCount();
      editorRef.current.setPosition({
        lineNumber: Math.min(position.lineNumber, lineCount),
        column: position.column,
      });
    }
    editorRef.current.setScrollTop(scrollTop);

    lastSyncedSeqRef.current = updateSeq;
  }, [updateSeq, getHtml]);

  return <MonacoEditor ref={editorRef} />;
}
```

### 6.2 Monaco直接編集モード（オプション）

Monaco Editorでの直接編集が必要な場合は、モード切り替えで対応:

```typescript
interface EmailComposerState {
  // ...
  editMode: 'visual' | 'code';
  setEditMode: (mode: 'visual' | 'code') => void;
}
```

- `visual`モード: StoreがSSOT、Monacoは読み取り専用風
- `code`モード: Monacoの内容でStoreを上書き、ビジュアル編集は無効

---

## 7. エラーハンドリング

### 7.1 エラー境界

```tsx
class VisualEditorErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('VisualEditor Error:', error, errorInfo);
    // エラー報告サービスへ送信
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 text-red-700 rounded">
          <h3>プレビューの読み込みに失敗しました</h3>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            再試行
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### 7.2 HTML解析エラー

```typescript
function parseComponentFromHtml(html: string, id: string, snippetId: string): ComponentNode | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // パースエラーチェック
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      console.error('HTML Parse Error:', parseError.textContent);
      toast.error('HTMLの解析に失敗しました');
      return null;
    }

    // ... 通常の処理
  } catch (error) {
    console.error('parseComponentFromHtml Error:', error);
    toast.error('コンポーネントの追加に失敗しました');
    return null;
  }
}
```

### 7.3 操作失敗時のリカバリ

```typescript
const addComponent = (snippetHtml: string, snippetId: string, index?: number) => {
  const component = parseComponentFromHtml(snippetHtml, crypto.randomUUID(), snippetId);

  if (!component) {
    // 解析失敗時は何もしない
    return;
  }

  set((state) => {
    try {
      state.components[component.id] = component;
      if (index !== undefined) {
        state.componentOrder.splice(index, 0, component.id);
      } else {
        state.componentOrder.push(component.id);
      }
      // 履歴追加
      state.history.past.push(/* ... */);
      state.history.future = [];
      state.updateSeq++;
    } catch (error) {
      console.error('addComponent Error:', error);
      toast.error('コンポーネントの追加に失敗しました');
      // stateは変更されない（immerのトランザクション）
    }
  });
};
```

---

## 8. パフォーマンス最適化

### 8.1 メモ化

```tsx
// コンポーネント単位でメモ化
const SortableComponent = memo(function SortableComponent({ id }: { id: string }) {
  const component = useEmailComposerStore((state) => state.components[id]);
  const isSelected = useEmailComposerStore(
    (state) => state.selectedComponentId === id
  );
  // ...
});
```

### 8.2 履歴のサイズ制限

```typescript
const MAX_HISTORY_SIZE = 50;

set((state) => {
  state.history.past.push(entry);
  // 古い履歴を削除
  if (state.history.past.length > MAX_HISTORY_SIZE) {
    state.history.past.shift();
  }
});
```

### 8.3 テキスト変更のデバウンス統合

```typescript
// 連続したテキスト変更を1つの履歴エントリに統合
const HISTORY_DEBOUNCE_MS = 500;

set((state) => {
  const lastEntry = state.history.past[state.history.past.length - 1];

  if (
    lastEntry &&
    lastEntry.type === 'text_change' &&
    lastEntry.data.componentId === componentId &&
    lastEntry.data.fieldName === fieldName &&
    Date.now() - lastEntry.timestamp < HISTORY_DEBOUNCE_MS
  ) {
    // 既存エントリを更新
    lastEntry.data.newValue = text;
    lastEntry.timestamp = Date.now();
  } else {
    // 新規エントリ
    state.history.past.push({ /* ... */ });
  }
});
```

---

## 9. 実装フェーズ（完了）

### Phase 1: 基盤構築 ✅
- [x] Zustand Store（AST構造）の実装
- [x] parseComponentFromHtml / serializeComponent
- [x] Shadow DOMコンテナの実装
- [x] 依存ライブラリのインストール（dnd-kit, tiptap）

### Phase 2: コンポーネント選択 ✅
- [x] ComponentRenderer実装
- [x] クリックで選択状態
- [x] SelectionOverlay（選択枠表示）
- [ ] キーボード操作（矢印キーで選択移動、Delete で削除）- 未実装

### Phase 3: ドラッグ&ドロップ ✅
- [x] dnd-kit統合
- [x] DragHandle UI
- [x] DropIndicator
- [x] Monaco同期

### Phase 4: インラインテキスト編集 ✅
- [x] TipTap統合
- [x] ダブルクリックで編集開始
- [x] 改行→`<br>`変換
- [x] Escape/blur で編集終了

### Phase 5: 統合・最適化 ✅
- [x] Undo/Redo
- [x] エラーハンドリング
- [x] パフォーマンスチューニング
- [ ] E2Eテスト - 未実装

### 追加実装（2026-01-17）
- [x] rawHtmlパターン（Monaco入力を保持）
- [x] lastIndexOf()によるネストdiv対応
- [x] Monaco-Visual Editor双方向同期

---

## 10. 依存ライブラリ

```json
{
  "dependencies": {
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@tiptap/react": "^2.4.0",
    "@tiptap/starter-kit": "^2.4.0",
    "@tiptap/extension-placeholder": "^2.4.0"
  }
}
```

---

## 関連ドキュメント

- [visual-editor-architecture.md](./visual-editor-architecture.md) - v1（アーカイブ）
- [email-composer-spec.md](./email-composer-spec.md) - 既存仕様
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - トラブルシューティング
