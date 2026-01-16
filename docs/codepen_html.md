# CodePen風スニペット管理アプリ 実装仕様書（完全版・SSOT）

> **📚 関連ドキュメント:**
> - [実装状況](./IMPLEMENTATION_STATUS.md) - 実装進捗とリリース判定
> - [実装計画](./implementation_plan.md) - フェーズ別実装計画
> - [アーキテクチャ図](./architecture-diagram.md) - システム構成とデータフロー
> - [メールコンポーザー仕様書](./email-composer-spec.md) - HTMLメール作成機能の詳細仕様
> - [トラブルシューティング](./TROUBLESHOOTING.md) - 問題解決ガイド
> - [プロジェクトREADME](../../README.md) - プロジェクト全体概要
> - [監査レポート](./audits/) - コード監査結果

**最終更新**: 2025-11-20
**実装状況**: ✅ 完了（本番環境デプロイ可能）

---

## プロジェクト概要
認証済みユーザーがHTMLコードを作成・保存し、リアルタイムプレビューを表示できるWebアプリケーション。

## 技術スタック
- **フロントエンド**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **エディタ**: Monaco Editor
- **バックエンド**: Supabase Auth + PostgreSQL + RLS
- **状態管理**: Zustand
- **バリデーション**: Zod
- **通知**: sonner
- **セキュリティ**: DOMPurify (isomorphic-dompurify)
- **ユーティリティ**: lru-cache

初期セットアップ
bashnpx create-next-app@latest snippet-manager --typescript --tailwind --app
cd snippet-manager
npm install @supabase/ssr @supabase/supabase-js zustand zod @monaco-editor/react sonner lru-cache
npm install -D @types/node

# Supabase型生成
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.types.ts

環境変数
bash# .env.local
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

データベーススキーマ
Supabaseの SQL Editor で以下を実行:
sql-- profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX profiles_username_unique_ci ON profiles (lower(username));

-- snippets
CREATE TABLE snippets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description TEXT CHECK (char_length(description) <= 1000),
  html TEXT NOT NULL DEFAULT '' CHECK (char_length(html) <= 100000),
  css TEXT,
  js TEXT,
  category TEXT NOT NULL DEFAULT 'その他',
  tags TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, name)
);

-- revisions
CREATE TABLE revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snippet_id UUID NOT NULL REFERENCES snippets(id) ON DELETE CASCADE,
  version INT NOT NULL,
  html TEXT NOT NULL,
  css TEXT,
  js TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(snippet_id, version)
);

-- インデックス
CREATE INDEX idx_snippets_owner_updated ON snippets(owner_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_snippets_public_updated ON snippets(updated_at DESC) WHERE is_public = TRUE AND deleted_at IS NULL;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_snippets_title_search ON snippets USING GIN (title gin_trgm_ops) WHERE deleted_at IS NULL;

-- トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER snippets_updated_at BEFORE UPDATE ON snippets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS有効化
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE snippets ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE revisions ENABLE ROW LEVEL SECURITY;

-- RLSポリシー
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "snippets_select_public_or_own" ON snippets FOR SELECT USING (deleted_at IS NULL AND (is_public = true OR auth.uid() = owner_id));
CREATE POLICY "snippets_insert_own" ON snippets FOR INSERT WITH CHECK (auth.uid() = owner_id AND deleted_at IS NULL);
CREATE POLICY "snippets_update_own" ON snippets FOR UPDATE USING (auth.uid() = owner_id AND deleted_at IS NULL) WITH CHECK (auth.uid() = owner_id AND deleted_at IS NULL);
CREATE POLICY "snippets_delete_own" ON snippets FOR DELETE USING (auth.uid() = owner_id);

CREATE POLICY "categories_select_own" ON categories FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "categories_insert_own" ON categories FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "categories_update_own" ON categories FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "categories_delete_own" ON categories FOR DELETE USING (auth.uid() = owner_id);

CREATE POLICY "revisions_select_public_or_own" ON revisions FOR SELECT USING (EXISTS (SELECT 1 FROM snippets WHERE snippets.id = revisions.snippet_id AND snippets.deleted_at IS NULL AND (snippets.is_public = true OR snippets.owner_id = auth.uid())));
CREATE POLICY "revisions_insert_own" ON revisions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM snippets WHERE snippets.id = revisions.snippet_id AND snippets.owner_id = auth.uid()));
CREATE POLICY "revisions_update_own" ON revisions FOR UPDATE USING (EXISTS (SELECT 1 FROM snippets WHERE snippets.id = revisions.snippet_id AND snippets.owner_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM snippets WHERE snippets.id = revisions.snippet_id AND snippets.owner_id = auth.uid()));
CREATE POLICY "revisions_delete_own" ON revisions FOR DELETE USING (EXISTS (SELECT 1 FROM snippets WHERE snippets.id = revisions.snippet_id AND snippets.owner_id = auth.uid()));

ディレクトリ構造
snippet-manager/
├── app/
│   ├── (public)/
│   │   ├── login/page.tsx
│   │   ├── p/[id]/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── snippets/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       └── edit/page.tsx
│   │   └── layout.tsx
│   ├── auth/callback/route.ts
│   ├── icon.tsx
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── editor/
│   │   ├── EditorPane.tsx
│   │   ├── PreviewPane.tsx
│   │   └── ViewToggle.tsx
│   ├── snippets/
│   │   ├── SnippetCard.tsx
│   │   └── SnippetForm.tsx
│   └── ui/
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── validations.ts
│   ├── optimistic-lock.ts
│   └── utils.ts
├── hooks/
│   └── useAutosave.ts
├── store/
│   └── editorStore.ts
├── types/
│   ├── database.types.ts
│   └── index.ts
├── middleware.ts
└── next.config.js

主要ファイル実装
lib/supabase/client.ts
typescriptimport { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
lib/supabase/server.ts
typescriptimport { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database.types';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}
middleware.ts
typescriptimport { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/auth/callback', '/p', '/_next', '/favicon.ico'];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicRoute(pathname)) return NextResponse.next();

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(redirectUrl);
  }
  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
types/index.ts
typescriptexport interface Snippet {
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

export interface Category {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}
lib/validations.ts
typescriptimport { z } from 'zod';

export const createSnippetSchema = z.object({
  title: z.string().min(1, 'タイトルは必須').max(200),
  description: z.string().max(1000).optional(),
  html: z.string().min(1, 'HTMLコードは必須').max(100000),
});

export const updateSnippetSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  html: z.string().min(1).max(100000).optional(),
});
store/editorStore.ts
typescriptimport { create } from 'zustand';

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
lib/optimistic-lock.ts
typescriptimport { createClient } from '@/lib/supabase/client';

export async function updateSnippetWithLock(
  id: string,
  expectedUpdatedAt: string,
  updates: { title?: string; html?: string; description?: string; category?: string; tags?: string[] }
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('snippets')
    .update(updates)
    .eq('id', id)
    .eq('updated_at', expectedUpdatedAt)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new Error('CONFLICT');
    throw error;
  }
  if (!data) throw new Error('CONFLICT');
  return data;
}
hooks/useAutosave.ts
typescript'use client';
import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { updateSnippetWithLock } from '@/lib/optimistic-lock';
import { toast } from 'sonner';

export function useAutosave(snippetId: string, initialUpdatedAt: string) {
  const { html, title, description, category, tags } = useEditorStore();
  const lastSavedRef = useRef({ html, title, description, category, tags });
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);

  useEffect(() => {
    const hasChanges =
      html !== lastSavedRef.current.html ||
      title !== lastSavedRef.current.title ||
      description !== lastSavedRef.current.description ||
      category !== lastSavedRef.current.category ||
      JSON.stringify(tags) !== JSON.stringify(lastSavedRef.current.tags);
    if (!hasChanges) return;

    const timer = setTimeout(async () => {
      try {
        const updated = await updateSnippetWithLock(snippetId, updatedAt, {
          html, title, description, category, tags
        });
        setUpdatedAt(updated.updated_at);
        lastSavedRef.current = { html, title, description, category, tags };
        toast.success('保存しました');
      } catch (error: any) {
        if (error.message === 'CONFLICT') {
          toast.error('競合が発生しました。ページを再読み込みしてください。', { duration: 10000 });
        } else {
          toast.error('保存に失敗しました');
        }
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [html, title, description, category, tags, snippetId, updatedAt]);
}
components/editor/EditorPane.tsx
typescript'use client';
import { Editor } from '@monaco-editor/react';
import { useEditorStore } from '@/store/editorStore';

export default function EditorPane() {
  const { html, setHtml } = useEditorStore();
  return (
    <Editor
      height="100%"
      defaultLanguage="html"
      value={html}
      onChange={(value) => setHtml(value || '')}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
      }}
    />
  );
}
components/editor/PreviewPane.tsx
typescript'use client';
import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';

export default function PreviewPane() {
  const { html } = useEditorStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          { type: 'UPDATE_HTML', html },
          window.location.origin
        );
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [html]);

  const sandboxDoc = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;padding:16px;font-family:system-ui,-apple-system,sans-serif;}</style></head><body><div id="root"></div><script>const ALLOWED_ORIGIN='${typeof window !== 'undefined' ? window.location.origin : ''}';window.addEventListener('message',(event)=>{if(event.origin!==ALLOWED_ORIGIN){console.warn('Rejected postMessage from',event.origin);return;}if(event.data.type==='UPDATE_HTML'){const root=document.getElementById('root');if(root){root.innerHTML=event.data.html;}}});</script></body></html>`;

  return <iframe ref={iframeRef} srcDoc={sandboxDoc} className="w-full h-full border-0 bg-white" sandbox="allow-scripts" title="プレビュー" />;
}
components/editor/ViewToggle.tsx
typescript'use client';
import { useEditorStore } from '@/store/editorStore';

export default function ViewToggle() {
  const { viewMode, setViewMode } = useEditorStore();
  return (
    <div className="flex gap-2">
      <button onClick={() => setViewMode('code')} className={`px-4 py-2 rounded ${viewMode === 'code' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>コード</button>
      <button onClick={() => setViewMode('preview')} className={`px-4 py-2 rounded ${viewMode === 'preview' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>結果</button>
    </div>
  );
}
app/(public)/login/page.tsx
typescript'use client';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const supabase = createClient();
  const handleGitHubLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8 p-8">
        <h1 className="text-3xl font-bold text-center">ログイン</h1>
        <button onClick={handleGitHubLogin} className="w-full bg-gray-900 text-white py-3 px-4 rounded-lg hover:bg-gray-800">GitHubでログイン</button>
      </div>
    </div>
  );
}
app/auth/callback/route.ts
typescriptimport { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/snippets';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await supabase.from('profiles').upsert({ id: data.user.id, username: data.user.user_metadata?.user_name || null, avatar_url: data.user.user_metadata?.avatar_url || null }, { onConflict: 'id' });
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login`);
}
app/(dashboard)/snippets/page.tsx
typescriptimport { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function SnippetsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: snippets } = await supabase.from('snippets').select('*').eq('owner_id', user.id).is('deleted_at', null).order('updated_at', { ascending: false });

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">マイスニペット</h1>
        <Link href="/snippets/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg">新規作成</Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {snippets?.map((snippet) => (
          <Link key={snippet.id} href={`/snippets/${snippet.id}`} className="border rounded-lg p-4 hover:shadow-lg transition">
            <h3 className="font-bold text-lg">{snippet.title}</h3>
            {snippet.description && <p className="text-gray-600 text-sm mt-2">{snippet.description}</p>}
            <p className="text-xs text-gray-400 mt-2">{new Date(snippet.updated_at).toLocaleDateString('ja-JP')}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
app/(dashboard)/snippets/[id]/edit/page.tsx
typescript'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useEditorStore } from '@/store/editorStore';
import { useAutosave } from '@/hooks/useAutosave';
import EditorPane from '@/components/editor/EditorPane';
import PreviewPane from '@/components/editor/PreviewPane';
import ViewToggle from '@/components/editor/ViewToggle';
import { toast } from 'sonner';

export default function EditSnippetPage() {
  const params = useParams();
  const router = useRouter();
  const { setHtml, setTitle, setDescription, viewMode } = useEditorStore();
  const supabase = createClient();

  useEffect(() => {
    async function loadSnippet() {
      const { data, error } = await supabase.from('snippets').select('*').eq('id', params.id as string).single();
      if (error || !data) {
        toast.error('スニペットが見つかりません');
        router.push('/snippets');
        return;
      }
      setTitle(data.title);
      setDescription(data.description || '');
      setHtml(data.html);
    }
    loadSnippet();
  }, [params.id]);

  useAutosave(params.id as string, new Date().toISOString());

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">エディタ</h1>
        <ViewToggle />
      </header>
      <main className="flex-1 overflow-hidden">{viewMode === 'code' ? <EditorPane /> : <PreviewPane />}</main>
    </div>
  );
}
app/(public)/p/[id]/page.tsx
typescriptimport { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';

export default async function PublicSnippetPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: snippet, error } = await supabase.from('snippets').select('*').eq('id', params.id).eq('is_public', true).is('deleted_at', null).single();
  if (error || !snippet) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b p-4">
        <h1 className="text-2xl font-bold">{snippet.title}</h1>
        {snippet.description && <p className="text-gray-600 mt-2">{snippet.description}</p>}
      </header>
      <main className="container mx-auto p-4">
        <iframe srcDoc={snippet.html} className="w-full h-[calc(100vh-200px)] border rounded-lg" sandbox="allow-scripts" title={snippet.title} />
      </main>
    </div>
  );
}
next.config.js
javascriptconst nextConfig = {
  async headers() {
    return [
      { source: '/p/:path*', headers: [{ key: 'Content-Security-Policy', value: "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none';" }] },
      { source: '/snippets/:path*/edit', headers: [{ key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; frame-ancestors 'self'; connect-src 'self' https://*.supabase.co;" }] },
      { source: '/:path*', headers: [{ key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; frame-ancestors 'self'; connect-src 'self' https://*.supabase.co;" }, { key: 'X-Frame-Options', value: 'SAMEORIGIN' }, { key: 'X-Content-Type-Options', value: 'nosniff' }] },
    ];
  },
};
module.exports = nextConfig;

## HTMLメールコンポーザー機能

### 概要

`#テンプレート` タグを持つスニペットをベースに、ドラッグ&ドロップでスニペットを組み合わせてHTMLメール全体を作成できる機能。

> **詳細仕様書**: `snippet-manager/docs/email-composer-spec.md` を参照

### 主な機能

1. **テンプレート選択**
   - スニペット詳細ページで `#テンプレート` または `#template` タグを持つスニペットに「📧 このテンプレートを使う」ボタンを表示
   - ボタンクリックで `/email-composer/[templateId]` に遷移

2. **3画面レイアウト**
   - 左: 同じカテゴリのスニペット一覧（#テンプレートタグは除外）
   - 右上: メールのリアルタイムプレビュー（iframe）
   - 右下: HTMLコードエディタ（Monaco Editor）

3. **ドラッグ&ドロップ**
   - 左側のスニペットカードをドラッグ
   - 右下のコードエディタにドロップ
   - カーソル位置に正確に挿入

4. **保存機能**
   - 手動保存ボタンで新規スニペットとして保存
   - `#メール` タグが自動付与
   - タイトル、説明、カテゴリ、タグを設定可能

### 技術的な実装詳細

**新規ファイル:**
- `app/(dashboard)/email-composer/[templateId]/page.tsx` - サーバーコンポーネント
- `components/email-composer/EmailComposerClient.tsx` - メインクライアント
- `components/email-composer/SnippetsSidebar.tsx` - スニペット一覧
- `components/email-composer/DraggableSnippetCard.tsx` - ドラッグ可能カード
- `components/email-composer/EmailPreviewPane.tsx` - プレビュー表示
- `components/email-composer/EmailCodeEditor.tsx` - コードエディタ（ドロップ受付）
- `components/email-composer/EmailComposerHeader.tsx` - ヘッダー
- `components/email-composer/SaveEmailDialog.tsx` - 保存ダイアログ
- `store/emailComposerStore.ts` - Zustand状態管理

**変更ファイル:**
- `components/snippets/SnippetDetail.tsx` - テンプレートボタン追加
- `next.config.js` - Monaco Editor用CSP設定追加

### ドラッグ&ドロップの実装

**DraggableSnippetCard.tsx:**
```typescript
const handleDragStart = (e: React.DragEvent) => {
  setIsDragging(true);
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('text/plain', snippet.html);
  e.dataTransfer.setData('application/json', JSON.stringify({
    id: snippet.id,
    html: snippet.html,
    title: snippet.title
  }));
};
```

**EmailCodeEditor.tsx:**
```typescript
const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  const snippetHtml = e.dataTransfer.getData('text/plain');
  const editor = editorRef.current;
  const position = editor.getPosition();

  if (position) {
    editor.executeEdits('drop-snippet', [{
      range: {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      },
      text: '\n' + snippetHtml + '\n',
    }]);

    // カーソルを挿入後に移動
    const lines = snippetHtml.split('\n');
    editor.setPosition({
      lineNumber: position.lineNumber + lines.length,
      column: 1,
    });
    editor.focus();

    // ストアを手動更新
    setHtml(editor.getValue());
  }
};
```

### Zustand Store

**store/emailComposerStore.ts:**
```typescript
interface EmailComposerStore {
  templateId: string;
  html: string;
  title: string;
  category: string;
  tags: string[];
  isDirty: boolean;

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
```

### CSP設定（next.config.js）

Monaco EditorがCDNからスクリプトをロードするため、CSP設定を追加：

```javascript
{
  source: '/email-composer/:path*',
  headers: [{
    key: 'Content-Security-Policy',
    value: "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; ..."
  }]
}
```

### React Hydration Error対策

EmailPreviewPaneでSSR/CSR同期の問題を回避：

```typescript
const [isMounted, setIsMounted] = useState(false);

useEffect(() => {
  setIsMounted(true);
}, []);

useEffect(() => {
  if (!iframeRef.current || !isMounted) return;

  const iframe = iframeRef.current;
  const doc = iframe.contentDocument || iframe.contentWindow?.document;

  if (doc) {
    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>body { margin: 0; padding: 16px; font-family: system-ui; }</style>
</head>
<body>
  <div id="root">${html}</div>
</body>
</html>`);
    doc.close();
  }
}, [html, isMounted]);
```

### 未実装機能（将来対応）

- ❌ 自動保存機能（3秒デバウンス + 楽観的ロック）
- ❌ hooks/useEmailAutosave.ts

---

## 追加ユーティリティ（2025-11-17実装）

### lib/formatDate.ts

**目的**: React Hydration Error #418の根本解決

**問題**: サーバー(UTC)とクライアント(JST)でタイムゾーンが異なり、`toLocaleDateString()`が異なる結果を返す

**解決**: タイムゾーンを`Asia/Tokyo`に固定して、サーバー・クライアント双方で同じ結果を保証

```typescript
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dateObj);
}

export function formatDateLong(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(dateObj);
}

export function formatDateTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
}
```

**使用箇所**:
- `components/snippets/SnippetsList.tsx`
- `components/snippets/SnippetDetail.tsx`
- `app/(public)/p/[id]/page.tsx`

**効果**:
- `suppressHydrationWarning`不要
- ±1日のズレを防止
- サーバー/クライアントで常に同じ日付表示

### lib/sanitize.ts

**目的**: XSS攻撃の防止

**実装**: DOMPurify (isomorphic-dompurify)を使用したHTMLサニタイズ

```typescript
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span', 'img', 'table', 'tr', 'td', 'th', 'thead', 'tbody'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style'],
  });
}
```

**使用箇所**:
- `components/editor/PreviewPane.tsx`
- `components/email-composer/EmailPreviewPane.tsx`
- `components/snippets/SnippetPreviewModal.tsx`

**セキュリティ強化**:
- すべてのHTML表示でサニタイズ適用
- iframe sandbox (`allow-scripts`のみ)
- CSP (Content Security Policy)

---

## 実装手順

プロジェクト作成と依存関係インストール
Supabaseプロジェクト作成
SQLスキーマ実行
GitHub OAuth設定（Callback: http://localhost:3000/auth/callback）
Supabase Authentication > Providers > GitHub設定
.env.local 作成
npm run dev


テスト項目

 GitHub認証でログイン
 プロフィール自動作成
 スニペット新規作成
 自動保存（3秒後）
 コード/結果切替
 他人のスニペットは閲覧不可（RLS）
 楽観的ロック動作（2タブで競合）
 公開ページ閲覧

この仕様書に従って実装してください。再試行Claudeは間違えることがあります。回答内容を必ずご確認ください。
---

## 関連ドキュメント一覧

| ドキュメント | 内容 | 最終更新 |
|------------|------|---------|
| [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | 実装進捗とリリース判定 | 2025-11-17 |
| [implementation_plan.md](./implementation_plan.md) | フェーズ別実装計画 | 2025-11-17 |
| [architecture-diagram.md](./architecture-diagram.md) | システム構成とデータフロー | 2025-11-17 |
| [email-composer-spec.md](./email-composer-spec.md) | HTMLメールコンポーザーの詳細仕様 | 2025-11-17 |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | React Error #418、ドロップ機能の解決ガイド | 2025-11-17 |
| [audits/](./audits/) | コード監査レポート一覧 | 継続更新 |
| [../../README.md](../../README.md) | プロジェクト全体概要 | 2025-11-16 |

---

**最終更新**: 2025-11-20
**更新内容**: Favicon設定追加（app/icon.tsx）
