# デプロイガイド - Supabase + Vercel

このガイドでは、yuhkihara/codepen プロジェクトをSupabaseとVercelにデプロイする手順を説明します。

---

## 📋 前提条件

- GitHubアカウント
- Supabaseアカウント ([supabase.com](https://supabase.com))
- Vercelアカウント ([vercel.com](https://vercel.com))

---

## 🗄️ Step 1: Supabaseプロジェクトのセットアップ

### 1.1 プロジェクト作成

1. [Supabase Dashboard](https://supabase.com/dashboard) にアクセス
2. "New Project" をクリック
3. 以下を設定:
   - **Name**: `codepen-snippets` (任意)
   - **Database Password**: 強力なパスワードを設定（保存しておく）
   - **Region**: 最寄りのリージョン（例: Northeast Asia (Tokyo)）
4. "Create new project" をクリック

### 1.2 データベーススキーマの作成

プロジェクト作成後、SQL Editorでデータベーススキーマを実行します:

1. 左サイドバーの **SQL Editor** をクリック
2. **New query** をクリック
3. 以下のSQLを貼り付けて実行:

```sql
-- profiles テーブル
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX profiles_username_unique_ci ON profiles (lower(username));

-- snippets テーブル
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

-- categories テーブル
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, name)
);

-- revisions テーブル
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

-- インデックス作成
CREATE INDEX idx_snippets_owner_updated ON snippets(owner_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_snippets_public_updated ON snippets(updated_at DESC) WHERE is_public = TRUE AND deleted_at IS NULL;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_snippets_title_search ON snippets USING GIN (title gin_trgm_ops) WHERE deleted_at IS NULL;

-- トリガー関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガー適用
CREATE TRIGGER snippets_updated_at BEFORE UPDATE ON snippets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS有効化
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE snippets ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE revisions ENABLE ROW LEVEL SECURITY;

-- RLSポリシー: profiles
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- RLSポリシー: snippets
CREATE POLICY "snippets_select_public_or_own" ON snippets FOR SELECT USING (deleted_at IS NULL AND (is_public = true OR auth.uid() = owner_id));
CREATE POLICY "snippets_insert_own" ON snippets FOR INSERT WITH CHECK (auth.uid() = owner_id AND deleted_at IS NULL);
CREATE POLICY "snippets_update_own" ON snippets FOR UPDATE USING (auth.uid() = owner_id AND deleted_at IS NULL) WITH CHECK (auth.uid() = owner_id AND deleted_at IS NULL);
CREATE POLICY "snippets_delete_own" ON snippets FOR DELETE USING (auth.uid() = owner_id);

-- RLSポリシー: categories
CREATE POLICY "categories_select_own" ON categories FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "categories_insert_own" ON categories FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "categories_update_own" ON categories FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "categories_delete_own" ON categories FOR DELETE USING (auth.uid() = owner_id);

-- RLSポリシー: revisions
CREATE POLICY "revisions_select_public_or_own" ON revisions FOR SELECT USING (EXISTS (SELECT 1 FROM snippets WHERE snippets.id = revisions.snippet_id AND snippets.deleted_at IS NULL AND (snippets.is_public = true OR snippets.owner_id = auth.uid())));
CREATE POLICY "revisions_insert_own" ON revisions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM snippets WHERE snippets.id = revisions.snippet_id AND snippets.owner_id = auth.uid()));
CREATE POLICY "revisions_update_own" ON revisions FOR UPDATE USING (EXISTS (SELECT 1 FROM snippets WHERE snippets.id = revisions.snippet_id AND snippets.owner_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM snippets WHERE snippets.id = revisions.snippet_id AND snippets.owner_id = auth.uid()));
CREATE POLICY "revisions_delete_own" ON revisions FOR DELETE USING (EXISTS (SELECT 1 FROM snippets WHERE snippets.id = revisions.snippet_id AND snippets.owner_id = auth.uid()));
```

4. **RUN** をクリックして実行

### 1.3 GitHub OAuth設定

1. [GitHub Settings > Developer settings > OAuth Apps](https://github.com/settings/developers) にアクセス
2. **New OAuth App** をクリック
3. 以下を設定:
   - **Application name**: `CodePen Snippets` (任意)
   - **Homepage URL**: `https://your-project.supabase.co` (Supabase Project URL)
   - **Authorization callback URL**: `https://your-project.supabase.co/auth/v1/callback`
4. **Register application** をクリック
5. **Client ID** と **Client Secret** を保存

次に、SupabaseでGitHub認証を有効化:

1. Supabase Dashboard > **Authentication** > **Providers** に移動
2. **GitHub** を選択
3. **Enable Sign in with GitHub** をオン
4. GitHub OAuth Appの **Client ID** と **Client Secret** を入力
5. **Save** をクリック

### 1.4 Google OAuth設定

#### Google Cloud Console設定

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクトを選択（または新規作成）
3. **APIs & Services** > **OAuth consent screen** に移動
4. User Typeを **External** に設定し、**CREATE** をクリック
5. 以下の必須情報を入力:
   - **App name**: `CodePen Snippets` (任意)
   - **User support email**: あなたのメールアドレス
   - **Developer contact information**: あなたのメールアドレス
6. **SAVE AND CONTINUE** をクリック
7. Scopesの設定で以下を追加:
   - `email`
   - `profile`
   - `openid`
8. **SAVE AND CONTINUE** で進み、**BACK TO DASHBOARD** をクリック

#### OAuth 2.0クライアント作成

1. **APIs & Services** > **Credentials** に移動
2. **+ CREATE CREDENTIALS** > **OAuth client ID** をクリック
3. 以下を設定:
   - **Application type**: `Web application`
   - **Name**: `CodePen Snippets Web Client` (任意)
   - **Authorized JavaScript origins**:
     - `https://your-project.supabase.co`
   - **Authorized redirect URIs**:
     - `https://your-project.supabase.co/auth/v1/callback`
4. **CREATE** をクリック
5. **Client ID** と **Client Secret** を保存

#### SupabaseでGoogle認証を有効化

1. Supabase Dashboard > **Authentication** > **Providers** に移動
2. **Google** を選択
3. **Enable Sign in with Google** をオン
4. Google OAuth Appの **Client ID** と **Client Secret** を入力
5. **Save** をクリック

### 1.5 Supabase認証情報の取得

1. Supabase Dashboard > **Settings** > **API** に移動
2. 以下をメモ:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon (Publishable key)**: `eyJhbGc...`

⚠️ **注意**: `service_role (Secret key)` ではなく、`anon (Publishable key)` を使用してください。

---

## 🚀 Step 2: Vercelにデプロイ

### 2.1 Vercelプロジェクト作成

1. [Vercel Dashboard](https://vercel.com/dashboard) にアクセス
2. **Add New... > Project** をクリック
3. **Import Git Repository** から `yuhkihara/codepen` を選択
4. **Root Directory** を `snippet-manager` に設定
5. **Environment Variables** に以下を追加:

```bash
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

6. **Deploy** をクリック

### 2.2 GitHub OAuth CallbackURLの更新

Vercelデプロイ後、GitHub OAuth Appの設定を更新:

1. [GitHub OAuth Apps](https://github.com/settings/developers) に戻る
2. 作成したOAuth Appを選択
3. **Authorization callback URL** を以下に追加（既存のものに加えて）:
   - `https://your-app.vercel.app/auth/callback`
4. **Update application** をクリック

### 2.3 Supabase Redirect URLsの設定

1. Supabase Dashboard > **Authentication** > **URL Configuration** に移動
2. **Redirect URLs** に以下を追加:
   - `https://your-app.vercel.app/auth/callback`
3. **Save** をクリック

---

## ✅ Step 3: 動作確認

### 3.1 GitHub認証の確認

1. Vercelのデプロイ完了URLにアクセス
2. ログインページで **GitHubでログイン** をクリック
3. GitHub認証を完了
4. スニペット一覧ページが表示されることを確認
5. 新規スニペット作成をテスト

### 3.2 Google認証の確認

1. 一度ログアウト
2. ログインページで **Googleでログイン** をクリック
3. Google認証を完了
4. スニペット一覧ページが表示されることを確認
5. プロフィールにGoogleアカウント情報（名前・アバター）が反映されているか確認

---

## 🔧 トラブルシューティング

### GitHub認証エラー

- GitHub OAuth CallbackURLが正しいか確認
- Supabase Redirect URLsに本番URLが追加されているか確認
- 環境変数が正しく設定されているか確認

### Google認証エラー

- Google Cloud ConsoleでOAuth同意画面が正しく設定されているか確認
- OAuthクライアントの **Authorized redirect URIs** に `https://your-project.supabase.co/auth/v1/callback` が含まれているか確認
- Supabase DashboardでGoogle OAuthが有効化され、Client IDとClient Secretが正しく入力されているか確認
- アプリが「テストモード」の場合、テストユーザーとして登録されたGoogleアカウントでのみログイン可能です

### データベースエラー

- SupabaseのSQL Editorでスキーマが正しく実行されたか確認
- RLSポリシーが正しく設定されているか確認

### ビルドエラー

- `snippet-manager` ディレクトリがRoot Directoryに設定されているか確認
- 環境変数がすべて設定されているか確認

---

## 📚 関連ドキュメント

- [Supabase Documentation](https://supabase.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [実装仕様書](./codepen_html.md)
- [実装状況](./IMPLEMENTATION_STATUS.md)

---

**デプロイ完了！** 🎉
