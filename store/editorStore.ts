import { create } from 'zustand';

interface EditorStore {
  html: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  viewMode: 'code' | 'preview';
  setHtml: (html: string) => void;
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setCategory: (category: string) => void;
  setTags: (tags: string[]) => void;
  setViewMode: (mode: 'code' | 'preview') => void;
  reset: () => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  html: '',
  title: '',
  description: '',
  category: 'その他',
  tags: [],
  viewMode: 'code',
  setHtml: (html) => set({ html }),
  setTitle: (title) => set({ title }),
  setDescription: (description) => set({ description }),
  setCategory: (category) => set({ category }),
  setTags: (tags) => set({ tags }),
  setViewMode: (mode) => set({ viewMode: mode }),
  reset: () => set({ html: '', title: '', description: '', category: 'その他', tags: [], viewMode: 'code' }),
}));
