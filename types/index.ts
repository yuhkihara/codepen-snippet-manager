export interface Snippet {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  html: string;
  css: string | null;
  js: string | null;
  category: string;
  tags: string[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Revision {
  id: string;
  snippet_id: string;
  version: number;
  html: string;
  css: string | null;
  js: string | null;
  note: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface TextStyle {
  id: string;
  owner_id: string;
  name: string;
  html_template: string;
  icon_color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
