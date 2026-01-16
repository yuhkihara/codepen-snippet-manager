# Snippet Manager アーキテクチャ図

> **📚 関連ドキュメント:**
> - [実装仕様書](./codepen_html.md) - Single Source of Truth（SSOT）
> - [実装状況](./IMPLEMENTATION_STATUS.md) - 実装進捗とリリース判定
> - [実装計画](./implementation_plan.md) - フェーズ別実装計画
> - [メールコンポーザー仕様書](./email-composer-spec.md) - HTMLメール作成機能の詳細仕様
> - [トラブルシューティング](./TROUBLESHOOTING.md) - 問題解決ガイド
> - [プロジェクトREADME](../README.md) - プロジェクト全体概要
> - [監査レポート](./audits/) - コード監査結果

**最終更新**: 2025-11-17
**実装状況**: ✅ 完了（本番環境デプロイ可能）

## システム全体構成

```mermaid
graph TB
    User[ユーザー]
    Browser[ブラウザ]
    NextApp[Next.js App<br/>App Router]
    Supabase[Supabase]

    User -->|アクセス| Browser
    Browser -->|リクエスト| NextApp
    NextApp -->|認証・データ| Supabase

    subgraph "Frontend"
        NextApp
        Components[Reactコンポーネント]
        Store[Zustand Store]
        Hooks[Custom Hooks]

        NextApp --> Components
        Components --> Store
        Components --> Hooks
    end

    subgraph "Backend Services"
        Supabase
        Auth[Supabase Auth<br/>GitHub OAuth]
        DB[(PostgreSQL<br/>+ RLS)]

        Supabase --> Auth
        Supabase --> DB
    end
```

## コンポーネント構造

```mermaid
graph LR
    App[app/]
    Components[components/]

    App --> Layout[layout.tsx]
    App --> Pages[各ページ]
    App --> EmailComposer[email-composer/]

    Components --> Auth[auth/]
    Components --> Editor[editor/]
    Components --> Snippets[snippets/]
    Components --> EmailComposerComps[email-composer/]
    Components --> UI[ui/]

    Auth --> SignIn[SignIn]
    Auth --> UserProfile[UserProfile]

    Editor --> CodeEditor[CodeEditor<br/>Monaco Editor]
    Editor --> Preview[Preview]

    Snippets --> SnippetList[SnippetList]
    Snippets --> SnippetDetail[SnippetDetail]
    Snippets --> SnippetCard[SnippetCard]

    EmailComposerComps --> EmailComposerClient[EmailComposerClient]
    EmailComposerComps --> EmailCodeEditor[EmailCodeEditor<br/>Monaco + D&D]
    EmailComposerComps --> EmailPreviewPane[EmailPreviewPane]
    EmailComposerComps --> SnippetsSidebar[SnippetsSidebar]
    EmailComposerComps --> DraggableSnippetCard[DraggableSnippetCard]
    EmailComposerComps --> EmailComposerHeader[EmailComposerHeader]
    EmailComposerComps --> SaveEmailDialog[SaveEmailDialog]
```

## データフロー

```mermaid
sequenceDiagram
    participant U as User
    participant C as Component
    participant S as Zustand Store
    participant H as Custom Hook
    participant SB as Supabase Client
    participant DB as Database

    U->>C: アクション実行
    C->>S: 状態更新リクエスト
    S->>H: データ取得/更新
    H->>SB: API呼び出し
    SB->>DB: クエリ実行
    DB-->>SB: 結果返却
    SB-->>H: データ返却
    H-->>S: 状態更新
    S-->>C: 再レンダリング
    C-->>U: UI更新
```

## 認証フロー

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant App as Next.js App
    participant Auth as Supabase Auth
    participant GH as GitHub OAuth

    U->>App: ログインボタンクリック
    App->>Auth: signInWithOAuth(github)
    Auth->>GH: OAuth認証リクエスト
    GH-->>U: GitHub認証画面
    U->>GH: 認証情報入力
    GH-->>Auth: 認証トークン
    Auth-->>App: セッション確立
    App-->>U: ダッシュボードへリダイレクト
```

## データベーススキーマ

```mermaid
erDiagram
    auth_users ||--o{ profiles : "has profile"
    auth_users ||--o{ snippets : creates
    auth_users ||--o{ categories : creates
    snippets ||--o{ revisions : "has history"

    profiles {
        uuid id PK
        text username
        text avatar_url
        timestamp created_at
        timestamp updated_at
    }

    snippets {
        uuid id PK
        uuid owner_id FK
        text title
        text description
        text html
        text css
        text js
        text category
        text_array tags
        boolean is_public
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    categories {
        uuid id PK
        text name
        uuid owner_id FK
        timestamp created_at
    }

    revisions {
        uuid id PK
        uuid snippet_id FK
        int version
        text html
        text css
        text js
        text note
        timestamp created_at
    }
```

> **注:** 完全なスキーマ定義とRLSポリシーは [`codepen_html.md`](./codepen_html.md) を参照してください。

## 状態管理構造

```mermaid
graph TB
    subgraph "Zustand Stores"
        AuthStore[authStore<br/>- user<br/>- session<br/>- signIn/Out]
        SnippetStore[snippetStore<br/>- snippets<br/>- currentSnippet<br/>- CRUD操作]
        EditorStore[editorStore<br/>- html/css/js<br/>- title/description<br/>- category/tags<br/>- viewMode]
        EmailComposerStore[emailComposerStore<br/>NEW<br/>- templateId<br/>- html<br/>- title/category/tags<br/>- isDirty<br/>- loadTemplate]
        UIStore[uiStore<br/>- theme<br/>- layout<br/>- modals]
    end

    Components[コンポーネント] --> AuthStore
    Components --> SnippetStore
    Components --> EditorStore
    Components --> EmailComposerStore
    Components --> UIStore
```

## 技術スタック詳細

```mermaid
graph LR
    subgraph "Frontend"
        Next[Next.js 15<br/>App Router]
        React[React 19]
        TS[TypeScript]
        TW[Tailwind CSS]
        Monaco[Monaco Editor]
    end

    subgraph "State & Validation"
        Zustand[Zustand]
        Zod[Zod]
    end

    subgraph "Backend & Auth"
        Supabase[Supabase]
        PostgreSQL[(PostgreSQL)]
        RLS[Row Level Security]
    end

    subgraph "UI & UX"
        Sonner[Sonner<br/>通知]
        Shadcn[shadcn/ui]
    end

    Next --> React
    React --> TS
    React --> TW
    React --> Monaco
    React --> Zustand
    React --> Zod
    React --> Sonner
    React --> Shadcn
    Next --> Supabase
    Supabase --> PostgreSQL
    Supabase --> RLS
```

## HTMLメールコンポーザーのデータフロー

```mermaid
sequenceDiagram
    participant U as User
    participant SD as SnippetDetail
    participant EC as EmailComposerClient
    participant S as emailComposerStore
    participant Sidebar as SnippetsSidebar
    participant Card as DraggableSnippetCard
    participant Editor as EmailCodeEditor
    participant Preview as EmailPreviewPane
    participant DB as Supabase

    U->>SD: #テンプレート タグのスニペットを閲覧
    SD->>U: 「このテンプレートを使う」ボタン表示
    U->>SD: ボタンクリック
    SD->>EC: /email-composer/[templateId] に遷移
    EC->>DB: テンプレート & 同カテゴリスニペット取得
    DB-->>EC: データ返却
    EC->>S: loadTemplate(template)
    S-->>EC: 状態更新
    EC->>Sidebar: スニペット一覧表示
    EC->>Editor: テンプレートHTMLを表示
    EC->>Preview: プレビュー表示

    U->>Card: スニペットをドラッグ開始
    Card->>Card: setData(html)
    U->>Editor: エディタにドロップ
    Editor->>Editor: カーソル位置を確認
    alt カーソル未指定
        Editor->>U: toast.error('行を指定してください')
    else カーソル位置OK
        Editor->>Editor: pushEditOperations(snippetHTML)
        Editor->>Editor: revealPositionInCenter()
        Editor->>S: setHtml(newValue)
        S-->>Editor: 状態更新
        Editor-->>Preview: html更新通知
        Preview->>Preview: iframe更新
        Preview-->>U: リアルタイムプレビュー表示
    end

    U->>EC: 保存ボタンクリック
    EC->>S: html, title, category, tags取得
    S-->>EC: 現在の状態返却
    EC->>DB: 新規スニペットとして保存（#メールタグ自動付与）
    DB-->>EC: 保存完了
    EC->>U: /snippets/[newId] にリダイレクト
```

## ドラッグ&ドロップのフロー（詳細）

```mermaid
sequenceDiagram
    participant U as User
    participant Card as DraggableSnippetCard
    participant Editor as EmailCodeEditor
    participant Monaco as Monaco Editor API
    participant Store as emailComposerStore

    Note over U,Store: ドラッグ開始
    U->>Card: onDragStart
    Card->>Card: setIsDragging(true)
    Card->>Card: e.dataTransfer.setData('text/plain', html)

    Note over U,Store: ドラッグ中
    U->>Editor: onDragEnter
    Editor->>Editor: dragCounterRef++
    alt dragCounter === 1
        Editor->>Editor: isDraggingRef.current = true
        Editor->>Editor: setIsDragOver(true)
        Editor->>U: オーバーレイ表示
    end

    Note over Monaco: カーソル保護
    Monaco->>Monaco: onDidChangeCursorPosition
    Monaco->>Monaco: if (isDraggingRef) return
    Note over Monaco: ドラッグ中はカーソル位置を更新しない

    Note over U,Store: ドロップ
    U->>Editor: onDrop
    Editor->>Editor: dragCounterRef = 0
    Editor->>Editor: isDraggingRef.current = false
    Editor->>Editor: setIsDragOver(false)
    Editor->>Editor: カーソル位置確認
    alt カーソル未指定
        Editor->>U: toast.error
    else カーソル位置OK
        Editor->>Monaco: model.pushEditOperations(...)
        Monaco->>Monaco: HTMLを挿入
        Editor->>Monaco: setPosition(newPosition)
        Editor->>Monaco: revealPositionInCenter(newPosition)
        Monaco-->>U: 挿入位置を画面中央に表示
        Editor->>Store: setHtml(model.getValue())
        Store-->>Editor: isDirty = true
    end

    Card->>Card: onDragEnd
    Card->>Card: setIsDragging(false)
```

## ユーティリティライブラリ

```mermaid
graph TB
    subgraph "Utilities"
        FormatDate[lib/formatDate.ts<br/>タイムゾーン固定<br/>Asia/Tokyo]
        Sanitize[lib/sanitize.ts<br/>DOMPurify<br/>XSS防止]
        OptimisticLock[lib/optimistic-lock.ts<br/>競合検出]
        Validations[lib/validations.ts<br/>Zodスキーマ]
    end

    Components[コンポーネント] --> FormatDate
    Components --> Sanitize
    Components --> OptimisticLock
    Components --> Validations
```

## セキュリティ対策

### Hydration Error完全解決
- **問題**: サーバー(UTC)とクライアント(JST)で日付表示が異なり、React Error #418が発生
- **解決**: `lib/formatDate.ts` でタイムゾーンを`Asia/Tokyo`に固定し、サーバー・クライアント双方で同じ結果を保証
- **効果**: `suppressHydrationWarning`不要、根本的に差分が発生しない実装

### XSS対策
- **DOMPurify**: すべてのHTML表示で`sanitizeHTML()`を使用
- **iframe sandbox**: `allow-scripts`のみ許可、`allow-same-origin`は禁止
- **CSP**: Content Security Policyで外部リソースを制限

### 認証・認可
- **Supabase Auth**: GitHub OAuthで認証
- **RLS**: Row Level Securityで権限管理
- **Middleware**: 認証チェックとリダイレクト

## パフォーマンス最適化

### Monaco Editorのドロップ機能
- **ドラッグカウンター方式**: 無限ループを防止
- **pointer-events: none**: オーバーレイのイベント干渉を防止
- **カーソル位置保護**: ドラッグ中の`onDidChangeCursorPosition`を無視
- **自動スクロール**: `revealPositionInCenter()`で挿入位置を表示

### デバウンス処理
- **プレビュー**: 300msデバウンス
- **自動保存**: 3秒デバウンス（エディタ）
- **コードエディタ**: 300msデバウンス（メールコンポーザー）

### React最適化
- **React.memo**: コンポーネントメモ化
- **useMemo/useCallback**: 不要な再計算を防止
- **dynamic import**: Monacoエディタの遅延読み込み

---

## 関連ドキュメント

| ドキュメント | 説明 |
|------------|------|
| [codepen_html.md](./codepen_html.md) | 完全な実装仕様書（SSOT） |
| [email-composer-spec.md](./email-composer-spec.md) | HTMLメールコンポーザーの詳細仕様 |
| [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | 実装進捗とリリース判定 |
| [implementation_plan.md](./implementation_plan.md) | フェーズ別実装計画 |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | React Error #418、ドロップ機能の解決ガイド |
| [audits/](./audits/) | コード監査レポート一覧 |
| [../README.md](../README.md) | プロジェクト全体概要 |

---

**Last Updated**: 2026-01-17
**Update**: Documentation restructured, links fixed
