import { create } from 'zustand';

interface EmailComposerStore {
  templateId: string;
  html: string;
  title: string;
  category: string;
  tags: string[];
  isDirty: boolean;

  loadTemplate: (template: { id: string; html: string; title: string; category: string; tags: string[] }) => void;
  setTemplateId: (id: string) => void;
  setHtml: (html: string) => void;
  insertSnippet: (html: string, position: number) => void;
  setTitle: (title: string) => void;
  setCategory: (category: string) => void;
  setTags: (tags: string[]) => void;
  setIsDirty: (isDirty: boolean) => void;
  reset: () => void;
}

export const useEmailComposerStore = create<EmailComposerStore>((set, get) => ({
  templateId: '',
  html: '',
  title: '',
  category: 'その他',
  tags: [],
  isDirty: false,

  // 初期テンプレート読み込み（isDirtyをfalseのまま一括設定）
  loadTemplate: (template) => set({
    templateId: template.id,
    html: template.html,
    title: template.title,
    category: template.category,
    tags: template.tags || [],
    isDirty: false
  }),

  setTemplateId: (id) => set({ templateId: id }),
  setHtml: (html) => set({ html, isDirty: true }),

  insertSnippet: (snippetHtml, position) => {
    const currentHtml = get().html;
    const before = currentHtml.slice(0, position);
    const after = currentHtml.slice(position);
    const newHtml = before + '\n' + snippetHtml + '\n' + after;
    set({ html: newHtml, isDirty: true });
  },

  setTitle: (title) => set({ title, isDirty: true }),
  setCategory: (category) => set({ category, isDirty: true }),
  setTags: (tags) => set({ tags, isDirty: true }),
  setIsDirty: (isDirty) => set({ isDirty }),

  reset: () => set({
    templateId: '',
    html: '',
    title: '',
    category: 'その他',
    tags: [],
    isDirty: false
  }),
}));
