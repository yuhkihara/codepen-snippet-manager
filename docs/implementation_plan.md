# CodePen風スニペット管理アプリ 実装計画書

> **📚 関連ドキュメント:**
> - [実装仕様書](./codepen_html.md) - Single Source of Truth（SSOT）
> - [実装状況](./IMPLEMENTATION_STATUS.md) - 実装進捗とリリース判定
> - [アーキテクチャ図](./architecture-diagram.md) - システム構成とデータフロー
> - [メールコンポーザー仕様書](./email-composer-spec.md) - HTMLメール作成機能の詳細仕様
> - [トラブルシューティング](./TROUBLESHOOTING.md) - 問題解決ガイド
> - [プロジェクトREADME](../../README.md) - プロジェクト全体概要
> - [監査レポート](./audits/) - コード監査結果

**最終更新**: 2025-11-17
**実装状況**: ✅ 完了（本番環境デプロイ可能）

## プロジェクト概要
認証済みユーザーがHTMLコードを作成・保存し、リアルタイムプレビューを表示できるWebアプリケーション

## 技術スタック
- **フロントエンド**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **エディタ**: Monaco Editor
- **バックエンド**: Supabase (Auth + PostgreSQL + RLS)
- **状態管理**: Zustand
- **バリデーション**: Zod
- **通知**: sonner

---

## 実装フェーズ

### Phase 1: 環境構築とプロジェクトセットアップ
**目標**: 開発環境の準備とプロジェクトの初期化

#### 1.1 プロジェクト作成
- [ ] Next.js プロジェクト作成 (`npx create-next-app@latest snippet-manager`)
- [ ] 必要なパッケージのインストール
  ```bash
  npm install @supabase/ssr @supabase/supabase-js zustand zod @monaco-editor/react sonner lru-cache
  npm install -D @types/node
  ```

#### 1.2 Supabase プロジェクト設定
- [ ] Supabase プロジェクト作成
- [ ] データベーススキーマの実行（profiles, snippets, revisions）
- [ ] RLSポリシーの設定
- [ ] インデックスとトリガーの作成

#### 1.3 GitHub OAuth 設定
- [ ] GitHub OAuth App 作成
- [ ] Supabase Authentication で GitHub プロバイダー設定
- [ ] Callback URL 設定: `http://localhost:3000/auth/callback`

#### 1.4 環境変数設定
- [ ] `.env.local` ファイル作成
  ```
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
  ```

#### 1.5 型定義生成
- [ ] Supabase 型定義の生成
  ```bash
  npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.types.ts
  ```

---

### Phase 2: 基盤実装
**目標**: 認証とルーティングの基盤構築

#### 2.1 Supabase クライアント設定
- [ ] `lib/supabase/client.ts` 実装（ブラウザ用）
- [ ] `lib/supabase/server.ts` 実装（サーバー用）

#### 2.2 ミドルウェア実装
- [ ] `middleware.ts` 実装
- [ ] 認証チェックとリダイレクト処理
- [ ] 公開ルートの定義

#### 2.3 型定義
- [ ] `types/index.ts` に Snippet インターフェース定義
- [ ] `types/database.types.ts` の確認

#### 2.4 バリデーション
- [ ] `lib/validations.ts` 実装
- [ ] Zod スキーマ定義（createSnippetSchema, updateSnippetSchema）

---

### Phase 3: 認証機能
**目標**: ログイン/ログアウト機能の実装

#### 3.1 ログインページ
- [ ] `app/(public)/login/page.tsx` 実装
- [ ] GitHub ログインボタン
- [ ] UI/UX デザイン

#### 3.2 認証コールバック
- [ ] `app/auth/callback/route.ts` 実装
- [ ] セッション交換処理
- [ ] プロフィール自動作成（upsert）

#### 3.3 レイアウト
- [ ] `app/(public)/layout.tsx` 実装
- [ ] `app/(dashboard)/layout.tsx` 実装（ヘッダー、ナビゲーション）

---

### Phase 4: 状態管理とユーティリティ
**目標**: グローバル状態とヘルパー関数の実装

#### 4.1 エディタストア
- [ ] `store/editorStore.ts` 実装
- [ ] Zustand ストア定義（html, title, description, viewMode）
- [ ] アクション定義（setHtml, setTitle, setDescription, setViewMode, reset）

#### 4.2 楽観的ロック
- [ ] `lib/optimistic-lock.ts` 実装
- [ ] `updateSnippetWithLock` 関数（競合検出機能）

#### 4.3 自動保存フック
- [ ] `hooks/useAutosave.ts` 実装
- [ ] 3秒ディバウンス
- [ ] 競合エラーハンドリング
- [ ] トースト通知

---

### Phase 5: エディタ機能
**目標**: コードエディタとプレビュー機能の実装

#### 5.1 エディタコンポーネント
- [ ] `components/editor/EditorPane.tsx` 実装
- [ ] Monaco Editor の統合
- [ ] エディタ設定（テーマ、フォントサイズ、ワードラップ等）

#### 5.2 プレビューコンポーネント
- [ ] `components/editor/PreviewPane.tsx` 実装
- [ ] iframe サンドボックス
- [ ] postMessage による安全な HTML レンダリング
- [ ] 300ms ディバウンス

#### 5.3 ビュー切替
- [ ] `components/editor/ViewToggle.tsx` 実装
- [ ] コード/プレビュー切替ボタン

---

### Phase 6: スニペット管理機能
**目標**: スニペットのCRUD操作

#### 6.1 一覧ページ
- [ ] `app/(dashboard)/snippets/page.tsx` 実装
- [ ] 自分のスニペット一覧表示
- [ ] 新規作成ボタン
- [ ] グリッドレイアウト

#### 6.2 スニペットカード
- [ ] `components/snippets/SnippetCard.tsx` 実装（必要に応じて）
- [ ] タイトル、説明、更新日時表示

#### 6.3 新規作成ページ
- [ ] `app/(dashboard)/snippets/new/page.tsx` 実装
- [ ] スニペット作成フォーム
- [ ] バリデーション

#### 6.4 詳細ページ
- [ ] `app/(dashboard)/snippets/[id]/page.tsx` 実装
- [ ] スニペット詳細表示
- [ ] 編集ボタン

#### 6.5 編集ページ
- [ ] `app/(dashboard)/snippets/[id]/edit/page.tsx` 実装
- [ ] エディタとプレビューの統合
- [ ] 自動保存機能の適用
- [ ] スニペットデータの読み込み

---

### Phase 7: 公開機能
**目標**: スニペットの公開と閲覧

#### 7.1 公開ページ
- [ ] `app/(public)/p/[id]/page.tsx` 実装
- [ ] 公開スニペットの表示（is_public = true のみ）
- [ ] iframe によるプレビュー
- [ ] RLS による権限チェック

#### 7.2 公開設定
- [ ] スニペット編集ページに公開/非公開トグル追加（オプション）

---

### Phase 8: セキュリティとパフォーマンス
**目標**: セキュリティ強化と最適化

#### 8.1 セキュリティヘッダー
- [ ] `next.config.js` 実装
- [ ] CSP (Content Security Policy) 設定
- [ ] X-Frame-Options 設定
- [ ] X-Content-Type-Options 設定

#### 8.2 エラーハンドリング
- [ ] エラーバウンダリ（必要に応じて）
- [ ] 404/500 ページ（必要に応じて）

---

### Phase 9: テストとデバッグ
**目標**: 動作確認とバグ修正

#### 9.1 機能テスト
- [ ] GitHub 認証でログイン
- [ ] プロフィール自動作成確認
- [ ] スニペット新規作成
- [ ] 自動保存動作（3秒後）
- [ ] コード/結果切替
- [ ] 楽観的ロック動作（2タブで競合テスト）
- [ ] 公開ページ閲覧

#### 9.2 RLS テスト
- [ ] 他人のスニペットは閲覧不可
- [ ] 自分のスニペットのみ編集可能
- [ ] 公開スニペットは誰でも閲覧可能

---

### Phase 11: HTMLメールコンポーザー機能 ✅
**目標**: テンプレートベースのHTMLメール作成機能

> **詳細仕様**: `snippet-manager/docs/email-composer-spec.md` を参照

#### 11.1 基盤準備 ✅
- [x] `store/emailComposerStore.ts` 実装
- [x] `/email-composer/[templateId]/page.tsx` 実装（サーバーコンポーネント）
- [x] `EmailComposerClient.tsx` 実装（メインクライアント）
- [x] 3画面レイアウト構築
- [x] テンプレートデータ取得処理
- [x] スニペット一覧取得処理（同カテゴリ、#テンプレート除外）

#### 11.2 スニペットサイドバー ✅
- [x] `SnippetsSidebar.tsx` 実装
- [x] タグごとのグループ化
- [x] `DraggableSnippetCard.tsx` 実装
- [x] HTML5 Drag and Drop API 統合

#### 11.3 プレビューペイン ✅
- [x] `EmailPreviewPane.tsx` 実装
- [x] iframeベースのプレビュー
- [x] React Hydration Error 対策（useEffect + doc.write()）

#### 11.4 コードエディタ ✅
- [x] `EmailCodeEditor.tsx` 実装
- [x] Monaco Editor 統合
- [x] 300msデバウンス処理
- [x] ドラッグ&ドロップ受け入れ（カーソル位置に挿入）
- [x] executeEdits API でカーソル位置制御

#### 11.5 ヘッダー & 保存機能 ⚠️
- [x] `EmailComposerHeader.tsx` 実装
- [x] `SaveEmailDialog.tsx` 実装
- [x] 手動保存機能
- [x] #メール タグ自動付与
- [ ] 自動保存機能（未実装 - 将来対応）
- [ ] hooks/useEmailAutosave.ts（未実装 - 将来対応）

#### 11.6 テンプレートボタン ✅
- [x] `SnippetDetail.tsx` 更新
- [x] #テンプレート タグ判定ロジック
- [x] 「このテンプレートを使う」ボタン追加

#### 11.7 CSP & エラー修正 ✅
- [x] next.config.js に cdn.jsdelivr.net 追加
- [x] Monaco Editor CSP エラー解決
- [x] React Hydration Error #418 修正
- [x] ドロップ位置問題解決（コードエディタ方式に変更）

---

### Phase 10: デプロイ準備
**目標**: 本番環境へのデプロイ

#### 10.1 環境変数設定
- [ ] Vercel/Netlify 等のプラットフォームで環境変数設定
- [ ] 本番用 Supabase URL と ANON_KEY

#### 10.2 ビルド確認
- [ ] `npm run build` でビルドエラーがないか確認
- [ ] TypeScript エラー修正

#### 10.3 デプロイ
- [ ] Vercel/Netlify へデプロイ
- [ ] GitHub OAuth の本番 Callback URL 更新

---

## マイルストーン

| マイルストーン | 完了目安 | 主要成果物 | 状態 |
|--------------|---------|-----------|------|
| M1: 環境構築完了 | Week 1 | プロジェクト作成、Supabase 設定、型定義 | ✅ |
| M2: 認証機能完了 | Week 1 | ログイン/ログアウト、ミドルウェア | ✅ |
| M3: エディタ機能完了 | Week 2 | Monaco Editor、プレビュー、自動保存 | ✅ |
| M4: CRUD 完了 | Week 2 | スニペット一覧、作成、編集、詳細 | ✅ |
| M5: 公開機能完了 | Week 3 | 公開ページ、RLS 検証 | ✅ |
| M6: セキュリティ・テスト完了 | Week 3 | CSP、テスト項目完了 | ✅ |
| M7: デプロイ完了 | Week 4 | 本番環境稼働 | ⚠️ |
| **M8: メールコンポーザー完了** | **Week 5** | **HTMLメール作成機能** | **✅** |

---

## 注意事項

1. **セキュリティ**
   - RLS ポリシーを必ず設定し、認可チェックを徹底
   - iframe サンドボックスで XSS 対策
   - CSP ヘッダーでコンテンツ保護

2. **パフォーマンス**
   - Monaco Editor の遅延読み込み検討
   - プレビューのディバウンス（300ms）
   - 自動保存のディバウンス（3秒）

3. **ユーザビリティ**
   - 保存中の状態表示
   - エラー時の明確なメッセージ
   - レスポンシブデザイン

4. **拡張性**
   - CSS/JS エディタの追加準備（テーブル構造は対応済み）
   - リビジョン機能の実装準備（テーブル構造は対応済み）
   - タグ機能の追加検討

---

## 次のステップ

1. Phase 1 からスタート
2. 各フェーズのチェックリストを順次完了
3. マイルストーンごとに動作確認
4. 問題があれば随時修正

この計画に沿って実装を進めていきます。

---

## 最新の改善とバグ修正 (2025-11-17)

### React Error #418（Hydration Mismatch）完全解決 ✅
- **問題**: サーバー(UTC)とクライアント(JST)でタイムゾーンが異なり、日付表示が±1日ズレる
- **根本原因**: `toLocaleDateString()`がサーバーとクライアントで異なる結果を返す
- **解決策**: `lib/formatDate.ts`作成
  - `Intl.DateTimeFormat`でタイムゾーンを`Asia/Tokyo`に固定
  - サーバー・クライアント双方で同じ結果を保証
- **修正ファイル**:
  - `components/snippets/SnippetsList.tsx`
  - `components/snippets/SnippetDetail.tsx`
  - `app/(public)/p/[id]/page.tsx`
  - `app/layout.tsx` - `suppressHydrationWarning`削除
- **詳細**: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md#react-hydration-error-418)

### Monaco Editorドロップ機能の完全修正 ✅
- **問題1**: ドロップイベントが発火しない（無限Drag Over/Leaveループ）
  - **解決**: ドラッグカウンター方式 + `pointer-events: none`
- **問題2**: 意図しない位置に挿入される
  - **解決**: ドラッグ中のカーソル位置更新を無効化
- **問題3**: ドロップ後に挿入位置が見えない
  - **解決**: `revealPositionInCenter()`で自動スクロール
- **問題4**: カーソル未指定時にドロップできてしまう
  - **解決**: バリデーション追加、toast警告表示
- **修正ファイル**: `components/email-composer/EmailCodeEditor.tsx`
- **詳細**: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md#ドロップ機能の問題)

### デスクトップレイアウト改善 ✅
- **変更**: コードエディタとプレビューを横並び（デスクトップ）に変更
- **修正ファイル**: `components/email-composer/EmailComposerClient.tsx`
- **Before**: 縦並び（プレビュー上、コード下）
- **After**: 横並び（コード左、プレビュー右）- lg:以上

---

## 関連ドキュメント一覧

| ドキュメント | 内容 | 最終更新 |
|------------|------|---------|
| [codepen_html.md](./codepen_html.md) | 完全な実装仕様書（SSOT） | 2025-11-17 |
| [email-composer-spec.md](./email-composer-spec.md) | HTMLメールコンポーザーの詳細仕様 | 2025-11-17 |
| [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | 実装進捗とリリース判定 | 2025-11-17 |
| [architecture-diagram.md](./architecture-diagram.md) | システム構成とデータフロー | 2025-11-17 |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | React Error #418、ドロップ機能の解決ガイド | 2025-11-17 |
| [audits/](./audits/) | コード監査レポート一覧 | 継続更新 |
| [../../README.md](../../README.md) | プロジェクト全体概要 | 2025-11-16 |

---

**最終更新**: 2025-11-17
**更新内容**: 最新の改善とバグ修正を追記、関連ドキュメント一覧を追加
