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

// コンポーネント挿入マーカー
const COMPONENT_MARKER = '<!--ここにコンポーネントを入れる-->';
const COMPONENT_MARKER_END = '<!--/ここにコンポーネントを入れる-->';

interface EmailComposerStore {
  // 基本メタデータ
  templateId: string;
  title: string;
  category: string;
  tags: string[];
  isDirty: boolean;

  // テンプレート構造（マーカー前後のHTML）
  headerHtml: string;
  footerHtml: string;

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

// 自動的にdata-editableを付与する対象タグ（子要素のないリーフ要素のみ、divは除外）
const AUTO_EDITABLE_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'td', 'th', 'li', 'label'];

/**
 * テキスト要素に自動でdata-editable属性を付与
 * 既にdata-editableがある要素はスキップ
 * 元のHTMLフォーマットを保持するため、開始タグのみを置換
 */
function addAutoEditableAttributesToHtml(html: string, componentId: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  let editableIndex = 0;
  const tagsToProcess: Array<{ tag: string; oldOpenTag: string; newOpenTag: string }> = [];

  // DOMで対象要素を特定
  AUTO_EDITABLE_TAGS.forEach((tag) => {
    doc.querySelectorAll(tag).forEach((el) => {
      // 既にdata-editableがある場合はスキップ
      if (el.hasAttribute('data-editable')) return;

      // 子要素（Element）がある場合はスキップ（span等の子タグを壊さないため）
      if (el.children.length > 0) return;

      // テキストコンテンツがある場合のみ対象（真のリーフ要素）
      if (el.textContent?.trim()) {
        const fieldName = `field-${componentId.slice(0, 8)}-${editableIndex++}`;

        // 元の開始タグを構築（属性を含む）
        const attrs = Array.from(el.attributes)
          .map(attr => `${attr.name}="${attr.value}"`)
          .join(' ');
        const oldOpenTag = attrs ? `<${tag} ${attrs}>` : `<${tag}>`;
        const newOpenTag = attrs
          ? `<${tag} ${attrs} data-editable="${fieldName}">`
          : `<${tag} data-editable="${fieldName}">`;

        tagsToProcess.push({ tag, oldOpenTag, newOpenTag });
      }
    });
  });

  // 元のHTML文字列内で開始タグを置換（フォーマットを保持）
  let result = html;
  tagsToProcess.forEach(({ oldOpenTag, newOpenTag }) => {
    // 属性の順序や空白が異なる可能性があるため、柔軟にマッチ
    // 最初にマッチしたものだけを置換
    const escaped = oldOpenTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 属性間の空白を柔軟にマッチ
    const flexiblePattern = escaped.replace(/\s+/g, '\\s+');
    const regex = new RegExp(flexiblePattern, 'i');
    result = result.replace(regex, newOpenTag);
  });

  return result;
}

/**
 * HTMLからコンポーネントをパースして構造化データに変換
 * autoAddEditable=trueの場合、テキスト要素に自動でdata-editableを付与
 */
function parseComponentFromHtml(
  html: string,
  id: string,
  snippetId?: string,
  autoAddEditable: boolean = false
): ComponentNode {
  // スニペットから追加された場合は自動でdata-editableを付与（HTML文字列を直接操作）
  let processedHtml = html;
  if (autoAddEditable || snippetId) {
    processedHtml = addAutoEditableAttributesToHtml(html, id);
  }

  // data-editable要素を抽出（読み取り専用でDOMを使用）
  const parser = new DOMParser();
  const doc = parser.parseFromString(processedHtml, 'text/html');

  const editableFields: Record<string, EditableField> = {};
  doc.querySelectorAll('[data-editable]').forEach((el) => {
    const name = el.getAttribute('data-editable')!;
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
    innerHtml: processedHtml,  // 元のHTMLフォーマットを保持
  };
}

/**
 * コンポーネントをHTMLにシリアライズ（元のフォーマットを保持）
 */
function serializeComponent(component: ComponentNode): string {
  let html = component.innerHtml;

  // editableFieldsの値をHTMLに反映（正規表現で元のフォーマットを保持）
  Object.entries(component.editableFields).forEach(([name, field]) => {
    const regex = new RegExp(
      `(<[^>]+data-editable="${name}"[^>]*>)([\\s\\S]*?)(</)`,
      'i'
    );
    const escapedValue = escapeHtml(field.value).replace(/\n/g, '<br>');
    html = html.replace(regex, `$1${escapedValue}$3`);
  });

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
 * <!--ここにコンポーネントを入れる-->マーカーがある場合はその範囲内のみをコンポーネント化
 */
function parseHtmlToComponents(html: string): {
  components: Record<string, ComponentNode>;
  componentOrder: string[];
  headerHtml: string;
  footerHtml: string;
} {
  const components: Record<string, ComponentNode> = {};
  const componentOrder: string[] = [];
  let headerHtml = '';
  let footerHtml = '';
  let componentAreaHtml = html;

  // マーカーで分割
  const startMarkerIndex = html.indexOf(COMPONENT_MARKER);
  const endMarkerIndex = html.indexOf(COMPONENT_MARKER_END);

  if (startMarkerIndex !== -1) {
    headerHtml = html.substring(0, startMarkerIndex);

    if (endMarkerIndex !== -1 && endMarkerIndex > startMarkerIndex) {
      // 開始・終了マーカーの両方がある場合
      componentAreaHtml = html.substring(
        startMarkerIndex + COMPONENT_MARKER.length,
        endMarkerIndex
      );
      footerHtml = html.substring(endMarkerIndex + COMPONENT_MARKER_END.length);
    } else {
      // 開始マーカーのみの場合は、それ以降すべてがコンポーネント領域
      componentAreaHtml = html.substring(startMarkerIndex + COMPONENT_MARKER.length);
    }
  }

  // コンポーネントマーカーでコンポーネントを検出
  const markerRegex = /<!-- component:([\w-]+) -->([\s\S]*?)<!-- \/component:\1 -->/g;
  let match;
  let hasMarkers = false;

  while ((match = markerRegex.exec(componentAreaHtml)) !== null) {
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

  // コンポーネントマーカーがない場合はトップレベル要素ごとに分割
  if (!hasMarkers && componentAreaHtml.trim()) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(componentAreaHtml, 'text/html');
    const topLevelElements = doc.body.children;

    if (topLevelElements.length > 0) {
      Array.from(topLevelElements).forEach((element) => {
        const id = crypto.randomUUID();
        const elementHtml = element.outerHTML;
        const component = parseComponentFromHtml(elementHtml, id);
        component.type = 'section';
        components[id] = component;
        componentOrder.push(id);
      });
    } else if (componentAreaHtml.trim()) {
      const id = crypto.randomUUID();
      const component = parseComponentFromHtml(componentAreaHtml, id);
      component.type = 'template';
      components[id] = component;
      componentOrder.push(id);
    }
  }

  return { components, componentOrder, headerHtml, footerHtml };
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
    headerHtml: '',
    footerHtml: '',
    components: {},
    componentOrder: [],
    selectedComponentId: null,
    editingField: null,
    editMode: 'visual',
    history: { past: [], future: [] },
    updateSeq: 0,

    // ===== 初期化 =====

    loadTemplate: (template) => {
      const { components, componentOrder, headerHtml, footerHtml } = parseHtmlToComponents(template.html);

      set((state) => {
        state.templateId = template.id;
        state.title = template.title;
        state.category = template.category;
        state.tags = template.tags || [];
        state.isDirty = false;
        state.headerHtml = headerHtml;
        state.footerHtml = footerHtml;
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
        state.headerHtml = '';
        state.footerHtml = '';
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
      // addComponentから追加する場合は常にautoAddEditable=trueで呼び出す
      const component = parseComponentFromHtml(snippetHtml, id, snippetId, true);

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
      const { components, componentOrder, headerHtml, footerHtml } = parseHtmlToComponents(html);

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

        state.headerHtml = headerHtml;
        state.footerHtml = footerHtml;
        state.components = components;
        state.componentOrder = componentOrder;
        state.isDirty = true;
        state.updateSeq++;
      });
    },

    getHtml: () => {
      const { components, componentOrder, headerHtml, footerHtml } = get();

      // コンポーネント部分を生成
      const componentsHtml = componentOrder
        .map((id) => {
          const component = components[id];
          if (!component) return '';
          return serializeComponent(component);
        })
        .join('\n\n');

      // マーカーがある場合はheader + marker + components + marker-end + footerを返す
      if (headerHtml || footerHtml) {
        return `${headerHtml}${COMPONENT_MARKER}\n${componentsHtml}\n${COMPONENT_MARKER_END}${footerHtml}`;
      }

      // マーカーがない場合はコンポーネントのみ
      return componentsHtml;
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
