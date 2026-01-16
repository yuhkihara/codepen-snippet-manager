import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// ===== Types =====

interface EditableField {
  name: string;
  value: string;
}

interface ComponentNode {
  id: string;
  type: string;
  sourceSnippetId?: string;
  editableFields: Record<string, EditableField>;
  innerHtml: string;
}

interface HistoryEntry {
  type: 'add' | 'delete' | 'reorder' | 'text_change' | 'html_change';
  timestamp: number;
  snapshot: {
    components: Record<string, ComponentNode>;
    componentOrder: string[];
  };
}

interface EditingState {
  componentId: string;
  fieldName: string;
}

interface EmailComposerStore {
  // 基本メタデータ
  templateId: string;
  title: string;
  category: string;
  tags: string[];
  isDirty: boolean;

  // AST構造によるコンポーネント管理
  components: Record<string, ComponentNode>;
  componentOrder: string[];

  // ビジュアル編集状態
  selectedComponentId: string | null;
  editingField: EditingState | null;

  // 編集モード: visual = ビジュアル編集優先, code = コード編集優先
  editMode: 'visual' | 'code';

  // 履歴（Undo/Redo）
  history: {
    past: HistoryEntry[];
    future: HistoryEntry[];
  };

  // シーケンス番号（変更検知用）
  updateSeq: number;

  // ===== Actions =====

  // 初期化
  loadTemplate: (template: {
    id: string;
    html: string;
    title: string;
    category: string;
    tags: string[];
  }) => void;
  reset: () => void;

  // メタデータ
  setTitle: (title: string) => void;
  setCategory: (category: string) => void;
  setTags: (tags: string[]) => void;
  setIsDirty: (isDirty: boolean) => void;

  // コンポーネント操作
  addComponent: (snippetHtml: string, snippetId: string, index?: number) => void;
  deleteComponent: (componentId: string) => void;
  reorderComponents: (fromIndex: number, toIndex: number) => void;
  updateEditableText: (componentId: string, fieldName: string, text: string) => void;

  // ビジュアル編集状態
  setSelectedComponentId: (id: string | null) => void;
  setEditingField: (field: EditingState | null) => void;
  setEditMode: (mode: 'visual' | 'code') => void;

  // HTML操作（Monaco Editor連携）
  setHtml: (html: string) => void;
  getHtml: () => string;

  // 後方互換性（既存コード用）
  get html(): string;
  insertSnippet: (html: string, position: number) => void;
  setTemplateId: (id: string) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

// ===== Helper Functions =====

/**
 * HTMLからコンポーネントをパースして構造化データに変換
 */
function parseComponentFromHtml(
  html: string,
  id: string,
  snippetId?: string
): ComponentNode {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // data-editable要素を抽出
  const editableFields: Record<string, EditableField> = {};
  doc.querySelectorAll('[data-editable]').forEach((el) => {
    const name = el.getAttribute('data-editable')!;
    // innerTextで改行を保持
    editableFields[name] = {
      name,
      value: el.textContent || '',
    };
  });

  return {
    id,
    type: snippetId ? 'snippet' : 'template',
    sourceSnippetId: snippetId,
    editableFields,
    innerHtml: html,
  };
}

/**
 * コンポーネントをHTMLにシリアライズ
 */
function serializeComponent(component: ComponentNode): string {
  let html = component.innerHtml;

  // editableFieldsの値をHTMLに反映
  if (Object.keys(component.editableFields).length > 0) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    Object.entries(component.editableFields).forEach(([name, field]) => {
      const el = doc.querySelector(`[data-editable="${name}"]`);
      if (el) {
        // 改行を<br>に変換、HTMLエスケープ
        el.innerHTML = escapeHtml(field.value).replace(/\n/g, '<br>');
      }
    });

    html = doc.body.innerHTML;
  }

  return `<!-- component:${component.id} -->\n<div data-component-id="${component.id}" data-component-type="${component.type}">\n${html}\n</div>\n<!-- /component:${component.id} -->`;
}

/**
 * HTMLエスケープ
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 生HTMLからコンポーネント構造を再構築
 * コメントマーカーがある場合はそれを使用、なければトップレベル要素ごとに分割
 */
function parseHtmlToComponents(html: string): {
  components: Record<string, ComponentNode>;
  componentOrder: string[];
} {
  const components: Record<string, ComponentNode> = {};
  const componentOrder: string[] = [];

  // コメントマーカーでコンポーネントを検出
  const markerRegex = /<!-- component:([\w-]+) -->([\s\S]*?)<!-- \/component:\1 -->/g;
  let match;
  let hasMarkers = false;

  while ((match = markerRegex.exec(html)) !== null) {
    hasMarkers = true;
    const [, id, innerContent] = match;

    // 内部のdivからHTMLを抽出
    const parser = new DOMParser();
    const doc = parser.parseFromString(innerContent, 'text/html');
    const componentDiv = doc.querySelector('[data-component-id]');

    if (componentDiv) {
      const componentHtml = componentDiv.innerHTML;
      const componentType = componentDiv.getAttribute('data-component-type') || 'unknown';

      const component = parseComponentFromHtml(componentHtml, id);
      component.type = componentType;

      components[id] = component;
      componentOrder.push(id);
    }
  }

  // マーカーがない場合はトップレベル要素ごとに分割
  if (!hasMarkers && html.trim()) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const topLevelElements = doc.body.children;

    if (topLevelElements.length > 0) {
      // トップレベル要素が複数ある場合は個別にコンポーネント化
      Array.from(topLevelElements).forEach((element) => {
        const id = crypto.randomUUID();
        const elementHtml = element.outerHTML;
        const component = parseComponentFromHtml(elementHtml, id);
        component.type = 'section';
        components[id] = component;
        componentOrder.push(id);
      });
    } else {
      // 要素がない場合（テキストのみなど）は全体を1つのコンポーネントに
      const id = crypto.randomUUID();
      const component = parseComponentFromHtml(html, id);
      component.type = 'template';
      components[id] = component;
      componentOrder.push(id);
    }
  }

  return { components, componentOrder };
}

// ===== Constants =====

const MAX_HISTORY_SIZE = 50;
const HISTORY_DEBOUNCE_MS = 500;

// ===== Store =====

export const useEmailComposerStore = create<EmailComposerStore>()(
  immer((set, get) => ({
    // 初期状態
    templateId: '',
    title: '',
    category: 'その他',
    tags: [],
    isDirty: false,
    components: {},
    componentOrder: [],
    selectedComponentId: null,
    editingField: null,
    editMode: 'visual',
    history: { past: [], future: [] },
    updateSeq: 0,

    // ===== 初期化 =====

    loadTemplate: (template) => {
      const { components, componentOrder } = parseHtmlToComponents(template.html);

      set((state) => {
        state.templateId = template.id;
        state.title = template.title;
        state.category = template.category;
        state.tags = template.tags || [];
        state.isDirty = false;
        state.components = components;
        state.componentOrder = componentOrder;
        state.selectedComponentId = null;
        state.editingField = null;
        state.history = { past: [], future: [] };
        state.updateSeq = 0;
      });
    },

    reset: () => {
      set((state) => {
        state.templateId = '';
        state.title = '';
        state.category = 'その他';
        state.tags = [];
        state.isDirty = false;
        state.components = {};
        state.componentOrder = [];
        state.selectedComponentId = null;
        state.editingField = null;
        state.history = { past: [], future: [] };
        state.updateSeq = 0;
      });
    },

    // ===== メタデータ =====

    setTitle: (title) => set((state) => {
      state.title = title;
      state.isDirty = true;
    }),

    setCategory: (category) => set((state) => {
      state.category = category;
      state.isDirty = true;
    }),

    setTags: (tags) => set((state) => {
      state.tags = tags;
      state.isDirty = true;
    }),

    setIsDirty: (isDirty) => set((state) => {
      state.isDirty = isDirty;
    }),

    setTemplateId: (id) => set((state) => {
      state.templateId = id;
    }),

    // ===== コンポーネント操作 =====

    addComponent: (snippetHtml, snippetId, index) => {
      const id = crypto.randomUUID();
      const component = parseComponentFromHtml(snippetHtml, id, snippetId);

      set((state) => {
        // 履歴に保存
        state.history.past.push({
          type: 'add',
          timestamp: Date.now(),
          snapshot: {
            components: { ...state.components },
            componentOrder: [...state.componentOrder],
          },
        });
        if (state.history.past.length > MAX_HISTORY_SIZE) {
          state.history.past.shift();
        }
        state.history.future = [];

        // コンポーネント追加
        state.components[id] = component;
        if (index !== undefined && index >= 0) {
          state.componentOrder.splice(index, 0, id);
        } else {
          state.componentOrder.push(id);
        }

        state.isDirty = true;
        state.updateSeq++;
      });
    },

    deleteComponent: (componentId) => {
      set((state) => {
        if (!state.components[componentId]) return;

        // 履歴に保存
        state.history.past.push({
          type: 'delete',
          timestamp: Date.now(),
          snapshot: {
            components: { ...state.components },
            componentOrder: [...state.componentOrder],
          },
        });
        if (state.history.past.length > MAX_HISTORY_SIZE) {
          state.history.past.shift();
        }
        state.history.future = [];

        // コンポーネント削除
        delete state.components[componentId];
        state.componentOrder = state.componentOrder.filter((id) => id !== componentId);

        // 選択状態をクリア
        if (state.selectedComponentId === componentId) {
          state.selectedComponentId = null;
        }
        if (state.editingField?.componentId === componentId) {
          state.editingField = null;
        }

        state.isDirty = true;
        state.updateSeq++;
      });
    },

    reorderComponents: (fromIndex, toIndex) => {
      set((state) => {
        if (fromIndex === toIndex) return;
        if (fromIndex < 0 || fromIndex >= state.componentOrder.length) return;
        if (toIndex < 0 || toIndex >= state.componentOrder.length) return;

        // 履歴に保存
        state.history.past.push({
          type: 'reorder',
          timestamp: Date.now(),
          snapshot: {
            components: { ...state.components },
            componentOrder: [...state.componentOrder],
          },
        });
        if (state.history.past.length > MAX_HISTORY_SIZE) {
          state.history.past.shift();
        }
        state.history.future = [];

        // 並び替え
        const [removed] = state.componentOrder.splice(fromIndex, 1);
        state.componentOrder.splice(toIndex, 0, removed);

        state.isDirty = true;
        state.updateSeq++;
      });
    },

    updateEditableText: (componentId, fieldName, text) => {
      set((state) => {
        const component = state.components[componentId];
        if (!component) return;

        const lastEntry = state.history.past[state.history.past.length - 1];

        // デバウンス: 直近の同じフィールドへの変更は履歴を統合
        if (
          lastEntry &&
          lastEntry.type === 'text_change' &&
          Date.now() - lastEntry.timestamp < HISTORY_DEBOUNCE_MS
        ) {
          // 履歴更新のみ（新規エントリは作らない）
          lastEntry.timestamp = Date.now();
        } else {
          // 新規履歴エントリ
          state.history.past.push({
            type: 'text_change',
            timestamp: Date.now(),
            snapshot: {
              components: JSON.parse(JSON.stringify(state.components)),
              componentOrder: [...state.componentOrder],
            },
          });
          if (state.history.past.length > MAX_HISTORY_SIZE) {
            state.history.past.shift();
          }
        }
        state.history.future = [];

        // テキスト更新
        component.editableFields[fieldName] = { name: fieldName, value: text };

        state.isDirty = true;
        state.updateSeq++;
      });
    },

    // ===== ビジュアル編集状態 =====

    setSelectedComponentId: (id) => set((state) => {
      state.selectedComponentId = id;
    }),

    setEditingField: (field) => set((state) => {
      state.editingField = field;
    }),

    setEditMode: (mode) => set((state) => {
      state.editMode = mode;
    }),

    // ===== HTML操作 =====

    setHtml: (html) => {
      const { components, componentOrder } = parseHtmlToComponents(html);

      set((state) => {
        // 履歴に保存
        state.history.past.push({
          type: 'html_change',
          timestamp: Date.now(),
          snapshot: {
            components: { ...state.components },
            componentOrder: [...state.componentOrder],
          },
        });
        if (state.history.past.length > MAX_HISTORY_SIZE) {
          state.history.past.shift();
        }
        state.history.future = [];

        state.components = components;
        state.componentOrder = componentOrder;
        state.isDirty = true;
        state.updateSeq++;
      });
    },

    getHtml: () => {
      const { components, componentOrder } = get();
      return componentOrder
        .map((id) => {
          const component = components[id];
          if (!component) return '';
          return serializeComponent(component);
        })
        .join('\n\n');
    },

    // 後方互換性: htmlプロパティへのアクセス
    get html() {
      return get().getHtml();
    },

    // 後方互換性: insertSnippet（Monaco Editorからの挿入用）
    insertSnippet: (snippetHtml, position) => {
      // 位置情報は無視して末尾に追加
      get().addComponent(snippetHtml, '');
    },

    // ===== Undo/Redo =====

    undo: () => {
      set((state) => {
        if (state.history.past.length === 0) return;

        const currentSnapshot = {
          components: JSON.parse(JSON.stringify(state.components)),
          componentOrder: [...state.componentOrder],
        };

        const entry = state.history.past.pop()!;
        state.history.future.unshift({
          type: entry.type,
          timestamp: Date.now(),
          snapshot: currentSnapshot,
        });

        state.components = entry.snapshot.components;
        state.componentOrder = entry.snapshot.componentOrder;
        state.updateSeq++;
      });
    },

    redo: () => {
      set((state) => {
        if (state.history.future.length === 0) return;

        const currentSnapshot = {
          components: JSON.parse(JSON.stringify(state.components)),
          componentOrder: [...state.componentOrder],
        };

        const entry = state.history.future.shift()!;
        state.history.past.push({
          type: entry.type,
          timestamp: Date.now(),
          snapshot: currentSnapshot,
        });

        state.components = entry.snapshot.components;
        state.componentOrder = entry.snapshot.componentOrder;
        state.updateSeq++;
      });
    },

    canUndo: () => get().history.past.length > 0,
    canRedo: () => get().history.future.length > 0,
  }))
);
