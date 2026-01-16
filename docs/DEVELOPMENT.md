# Snippet Manager - 開発ドキュメント

> **関連ドキュメント:**
> - プロジェクト概要: [README.md](../README.md)
> - 実装仕様書 (SSOT): [codepen_html.md](codepen_html.md)
> - 実装ステータス: [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)
> - アーキテクチャ図: [architecture-diagram.md](architecture-diagram.md)
> - AI向け指示: [CLAUDE.md](../CLAUDE.md)

## プロジェクト概要

CodePen風のHTMLスニペット管理アプリケーション。Next.js 15、Supabase、Monaco Editorを使用して構築。

## 技術スタック

- **フロントエンド**: Next.js 15 (App Router), React 19, TypeScript
- **スタイリング**: Tailwind CSS
- **認証**: Supabase Auth (GitHub OAuth)
- **データベース**: Supabase (PostgreSQL)
- **状態管理**: Zustand
- **エディタ**: Monaco Editor
- **デプロイ**: Vercel

## 実装済み機能

### ✅ コア機能
- GitHub認証ログイン/ログアウト
- スニペットのCRUD操作
- Monaco Editorによるコード編集
- リアルタイムHTMLプレビュー
- 自動保存機能（3秒後）
- 楽観的ロックによる競合検出

### ✅ カテゴリ・タグ管理
- カスタムカテゴリの作成・編集・削除
- タグの追加・削除
- 複数タグでのAND条件絞り込み
- カテゴリ別カラム表示

### ✅ UI/UX機能
- HTMLコードのコピー機能
- スニペットプレビューサムネイル
- グリッド/カテゴリ別表示切り替え
- ユーザープロフィール表示（GitHubアバター対応）
- レスポンシブデザイン

### ✅ セキュリティ
- Content Security Policy (CSP)
- サンドボックス化されたiframeプレビュー
- Row Level Security (RLS)
- XSS対策

## データベーススキーマ

### snippets テーブル
```sql
CREATE TABLE snippets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  html text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'その他',
  tags text[] DEFAULT '{}',
  is_public boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);
```

### categories テーブル
```sql
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(owner_id, name)
);
```

## 開発フロー

### 1. セットアップ

```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.local.example .env.local
# .env.localにSupabaseの認証情報を追加

# 開発サーバー起動
npm run dev
```

### 2. 主要な実装パターン

#### 自動保存の実装
```typescript
// hooks/useAutosave.ts
export function useAutosave(snippetId: string, initialUpdatedAt: string) {
  const { html, title, description, category, tags } = useEditorStore();

  useEffect(() => {
    const timer = setTimeout(async () => {
      await updateSnippetWithLock(snippetId, updatedAt, {
        html, title, description, category, tags
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [html, title, description, category, tags]);
}
```

#### 楽観的ロック
```typescript
// lib/optimistic-lock.ts
export async function updateSnippetWithLock(
  id: string,
  expectedUpdatedAt: string,
  updates: SnippetUpdates
) {
  const { data, error } = await supabase
    .from('snippets')
    .update(updates)
    .eq('id', id)
    .eq('updated_at', expectedUpdatedAt) // 楽観的ロック
    .select()
    .single();

  if (error?.code === 'PGRST116') throw new Error('CONFLICT');
  return data;
}
```

#### サンドボックスプレビュー
```typescript
// components/editor/PreviewPane.tsx
<iframe
  srcDoc={srcdoc}
  sandbox="allow-scripts"  // XSS対策
  className="w-full h-full"
/>
```

### 3. セキュリティ設定

#### Content Security Policy
```javascript
// next.config.js
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com; ..."
        }
      ]
    }
  ];
}
```

#### Row Level Security
```sql
-- Supabaseで設定
CREATE POLICY "Users can view own snippets"
  ON snippets FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own snippets"
  ON snippets FOR INSERT
  WITH CHECK (auth.uid() = owner_id);
```

## デプロイ手順

### 1. Vercelへのデプロイ

```bash
# Vercel CLIのインストール
npm i -g vercel

# ログイン
vercel login

# デプロイ
vercel --prod
```

### 2. 環境変数の設定

Vercelダッシュボードで以下を設定:

- `NEXT_PUBLIC_APP_URL`: 本番環境URL
- `NEXT_PUBLIC_SUPABASE_URL`: SupabaseプロジェクトURL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase匿名キー

### 3. Supabaseの設定

1. **Authentication > URL Configuration**
   - Site URL: `https://snippet-manager-one.vercel.app`
   - Redirect URLs: `https://snippet-manager-one.vercel.app/auth/callback`

2. **OAuth Providers**
   - GitHub OAuthを有効化
   - Callback URL: `https://zpmnprefaahbpeknnbty.supabase.co/auth/v1/callback`

## トラブルシューティング

### Monaco Editorが読み込まれない
- CDNをunpkg.comに変更
- CSPでunpkg.comを許可

### iframe sandboxエラー
- `allow-same-origin`を削除
- `srcDoc`属性を使用してXSS対策

### 自動保存が動作しない
- `updatedAt`の初期化タイミングを確認
- `useEffect`の依存配列を確認

### カテゴリ追加時のエラー
- `owner_id`を明示的に設定
- UNIQUE制約の重複をチェック

## 今後の拡張案

- [ ] CSS/JavaScriptエディタの追加
- [ ] スニペットの共有機能
- [ ] フォーク/クローン機能
- [ ] コメント機能
- [ ] いいね/お気に入り機能
- [ ] 検索機能の強化
- [ ] エクスポート機能（Gist, CodePen等）
- [ ] バージョン履歴
- [ ] コラボレーション機能

## ライセンス

MIT

## 開発者

Built with [Claude Code](https://claude.com/claude-code)
