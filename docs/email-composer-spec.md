# HTMLメールコンポーザー機能 仕様書

> **📚 関連ドキュメント:**
> - [実装状況](./IMPLEMENTATION_STATUS.md) - 実装進捗とリリース判定
> - [トラブルシューティング](./TROUBLESHOOTING.md) - 問題解決ガイド
> - [アーキテクチャ図](./architecture-diagram.md) - システム構成とデータフロー
> - [基本仕様書](./codepen_html.md) - スニペット管理機能の仕様
> - [プロジェクトREADME](../README.md) - プロジェクト全体概要

**最終更新**: 2025-11-17
**実装状況**: ✅ 完了（本番環境デプロイ可能）

---

## 📋 プロジェクト概要

既存のスニペット管理アプリに、スニペットを組み合わせてHTMLメール全体を作成できる高度なメールコンポーザー機能を追加。

### 目的

- **#テンプレート** タグのスニペットをベースに、HTMLメールを効率的に作成
- **高度なドラッグ&ドロップ**による直感的なスニペット挿入
- **リアルタイムプレビュー**による視覚的なメール作成体験
- **セキュリティ対策**の徹底（XSS防止、Hydration Error解決）

---

## 🎯 実装済み機能

### ✅ 1. テンプレート機能の拡張

#### 「このテンプレートを使う」ボタン

**対象**: `#テンプレート` または `#template` タグを持つスニペット

**配置場所**: スニペット詳細ページ (`components/snippets/SnippetDetail.tsx`)

**実装内容**:
```tsx
const isTemplate = snippet.tags?.some(
  tag => tag === '#テンプレート' || tag === 'テンプレート' || tag === '#template' || tag === 'template'
);

{isTemplate && (
  <Link href={`/email-composer/${snippet.id}`}>
    <button className="w-full sm:w-auto bg-gradient-to-r from-primary-600 to-accent-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-shadow duration-150">
      📧 このテンプレートを使う
    </button>
  </Link>
)}
```

---

### ✅ 2. メールコンポーザーページ

#### ルート

`/email-composer/[templateId]`

#### レイアウト（最新版 - 2025-11-17更新）

**デスクトップ（≥ lg）**: 横3列レイアウト
```
┌───────────────┬────────────────┬────────────────┐
│               │                │                │
│ スニペット    │ コードエディタ │ プレビュー     │
│ 一覧          │ (Monaco)       │ (読み取り専用) │
│               │                │                │
│ (w-80/96)     │ (flex-1)       │ (flex-1)       │
└───────────────┴────────────────┴────────────────┘
```

**モバイル（< lg）**: 縦3列レイアウト
```
┌─────────────────┐
│ スニペット一覧  │
├─────────────────┤
│ コードエディタ  │
│ (h-64)          │
├─────────────────┤
│                 │
│ プレビュー      │
│                 │
└─────────────────┘
```

**実装ファイル**: `components/email-composer/EmailComposerClient.tsx`

---

### ✅ 3. スニペット一覧サイドバー

**表示条件**:
- テンプレートと同じ `category` を持つスニペット
- `#テンプレート` タグを除外
- `deleted_at IS NULL` のみ

**表示形式**:
- タグごとにグループ化して整列
- 各スニペットはドラッグ可能なカード形式
- カードにはタイトル、説明、HTML文字数を表示

**実装ファイル**: `components/email-composer/SnippetsSidebar.tsx`

**データ取得**:
```typescript
const { data: snippets } = await supabase
  .from('snippets')
  .select('*')
  .eq('owner_id', user.id)
  .eq('category', template.category)
  .is('deleted_at', null)
  .order('updated_at', { ascending: false });

// フィルタリング: #テンプレート タグを除外
const filteredSnippets = snippets?.filter(
  s => !s.tags?.some(tag =>
    tag === '#テンプレート' || tag === 'テンプレート' || tag === '#template' || tag === 'template'
  )
) || [];
```

---

### ✅ 4. ドラッグ可能なスニペットカード

**実装ファイル**: `components/email-composer/DraggableSnippetCard.tsx`

**機能**:
- HTML5 Drag and Drop API を使用
- `dataTransfer.setData('text/plain', snippet.html)` でHTMLを転送
- ドラッグ中の視覚的フィードバック（opacity-50, scale-95）
- ダブルクリックでプレビューモーダル表示

**実装内容**:
```tsx
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

---

### ✅ 5. HTMLコードエディタ（Monaco Editor）

**実装ファイル**: `components/email-composer/EmailCodeEditor.tsx`

**機能**:
- Monaco Editor統合
- 300msデバウンス処理
- Zustand storeとの双方向バインディング
- **高度なドラッグ&ドロップ機能**（詳細は下記）

#### 5.1 高度なドラッグ&ドロップ機能

**✅ ドラッグカウンター方式**（無限ループ防止）
```tsx
const dragCounterRef = useRef(0);

const handleDragEnter = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  dragCounterRef.current += 1;
  if (dragCounterRef.current === 1) {
    isDraggingRef.current = true;
    setIsDragOver(true);
  }
};

const handleDragLeave = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  dragCounterRef.current -= 1;
  if (dragCounterRef.current === 0) {
    isDraggingRef.current = false;
    setIsDragOver(false);
  }
};
```

**✅ ドラッグ中のカーソル位置保護**
```tsx
const isDraggingRef = useRef(false);

editor.onDidChangeCursorPosition((e) => {
  // ドラッグ中はカーソル位置を更新しない（元の位置を保持）
  if (isDraggingRef.current) return;

  lastCursorPositionRef.current = {
    lineNumber: e.position.lineNumber,
    column: e.position.column,
  };
});
```

**✅ 挿入位置の自動表示**
```tsx
// カーソルを設定し、挿入位置を画面中央に表示
editor.setPosition(newPosition);
editor.revealPositionInCenter(newPosition);
```

**✅ カーソル位置バリデーション**
```tsx
if (!lastCursorPositionRef.current) {
  toast.error('行を指定してからドロップしてください', {
    description: 'エディタ内でカーソル位置を指定してから、もう一度ドロップしてください。',
    duration: 4000,
  });
  return;
}
```

**✅ オーバーレイ表示**
- `pointer-events: none` でイベント干渉を防止
- ドラッグ中に挿入先行番号を表示

---

### ✅ 6. リアルタイムプレビュー

**実装ファイル**: `components/email-composer/EmailPreviewPane.tsx`

**機能**:
- iframeでサンドボックス化（`allow-scripts` のみ）
- DOMPurifyによるXSS攻撃防止
- Hydration Error完全解決
- リアルタイム同期（300msデバウンス）

**セキュリティ実装**:
```tsx
import { sanitizeHTML } from '@/lib/sanitize';

// 初期HTML
const initialFullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>body { margin: 0; padding: 16px; }</style>
</head>
<body>
  <div id="root">${sanitizeHTML(html)}</div>
</body>
</html>`;

// postMessageでの更新
iframe.contentWindow.postMessage(
  { type: 'UPDATE_HTML', html: sanitizeHTML(html) },
  '*'
);
```

---

### ✅ 7. セキュリティ対策

#### 7.1 XSS攻撃防止

**実装ファイル**: `lib/sanitize.ts`

```typescript
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'div', 'span', 'p', 'a', 'img', 'table', 'tr', 'td', 'th',
      'tbody', 'thead', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4',
      'h5', 'h6', 'strong', 'em', 'br', 'hr', 'style'
    ],
    ALLOWED_ATTR: [
      'class', 'style', 'href', 'src', 'alt', 'width', 'height',
      'border', 'cellpadding', 'cellspacing', 'align', 'valign'
    ],
  });
}
```

**適用箇所**:
- `components/email-composer/EmailPreviewPane.tsx`
- `components/email-composer/SnippetPreviewModal.tsx`
- `components/editor/PreviewPane.tsx`
- `components/snippets/SnippetDetail.tsx`
- `app/(public)/p/[id]/page.tsx`

#### 7.2 Hydration Error完全解決

**実装ファイル**: `lib/formatDate.ts`

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
```

**効果**:
- サーバー(UTC)とクライアント(JST)で日付が完全一致
- `suppressHydrationWarning`不要
- React Error #418の根本的解決

---

### ✅ 8. 保存機能

**実装ファイル**: `components/email-composer/SaveEmailDialog.tsx`

**機能**:
- タイトル・説明入力
- `#メール` タグの自動追加
- 新規スニペットとして保存
- 保存後、一覧ページにリダイレクト

**実装内容**:
```tsx
const handleSave = async () => {
  const { data, error } = await supabase
    .from('snippets')
    .insert({
      owner_id: user.id,
      title,
      description,
      html,
      category,
      tags: [...tags, '#メール'],
      is_public: false,
    });
};
```

---

## 🔧 技術スタック

| 技術 | 用途 |
|------|------|
| Next.js 15 | App Router、SSR/CSR |
| React 19 | UI構築 |
| TypeScript | 型安全性 |
| Monaco Editor | コードエディタ |
| Zustand | 状態管理 |
| DOMPurify | XSS攻撃防止 |
| Supabase | 認証・データベース |
| Tailwind CSS | スタイリング |
| sonner | トースト通知 |

---

## 📁 ファイル構造

```
snippet-manager/
├── app/(dashboard)/
│   └── email-composer/
│       └── [templateId]/
│           └── page.tsx              # メインページ（Server Component）
├── components/email-composer/
│   ├── EmailComposerClient.tsx       # レイアウト管理
│   ├── EmailComposerHeader.tsx       # ヘッダー
│   ├── SnippetsSidebar.tsx           # スニペット一覧
│   ├── DraggableSnippetCard.tsx      # ドラッグ可能カード
│   ├── EmailCodeEditor.tsx           # Monaco Editorコードエディタ
│   ├── EmailPreviewPane.tsx          # リアルタイムプレビュー
│   ├── SaveEmailDialog.tsx           # 保存ダイアログ
│   └── SnippetPreviewModal.tsx       # プレビューモーダル
├── store/
│   └── emailComposerStore.ts         # Zustand状態管理
├── lib/
│   ├── sanitize.ts                   # HTMLサニタイゼーション
│   └── formatDate.ts                 # 日付フォーマット（タイムゾーン固定）
└── docs/
    ├── email-composer-spec.md        # 本仕様書
    ├── IMPLEMENTATION_STATUS.md      # 実装状況
    ├── TROUBLESHOOTING.md            # トラブルシューティング
    └── audits/
        ├── hydration_audit_20251117.md           # Hydration監査
        └── codex-hydration-audit-20251117.md     # Codex監査
```

---

## 🎨 UI/UX 特徴

### レスポンシブデザイン

- **デスクトップ**: 横3列レイアウト（スニペット | コード | プレビュー）
- **モバイル**: 縦3列レイアウト（効率的な編集）

### ビジュアルフィードバック

- ドラッグ中のオーバーレイ表示
- 挿入先行番号の表示
- ドラッグ中のカード透明度変更（opacity-50）
- ドロップ成功時のトースト通知

### アクセシビリティ

- キーボード操作対応
- 適切なARIA属性
- フォーカス管理

---

## 🐛 解決済みの問題

### React Hydration Error #418（✅ 完全解決）

**問題**: サーバー・クライアント間の日付フォーマット差異

**解決策**:
- `lib/formatDate.ts` で`Asia/Tokyo`固定
- サーバー・クライアント双方で同じ結果を保証
- `suppressHydrationWarning`を削除

**詳細**: [Hydration監査レポート](./audits/hydration_audit_20251117.md)

### Monacoドロップ機能の問題（✅ 完全解決）

**問題1**: ドロップイベント無限ループ
**解決策**: ドラッグカウンター方式 + `pointer-events: none`

**問題2**: 意図しない位置に挿入
**解決策**: ドラッグ中のカーソル位置更新を無効化

**問題3**: 挿入位置が画面外
**解決策**: `editor.revealPositionInCenter()` で自動スクロール

**問題4**: カーソル位置未指定
**解決策**: バリデーションと警告表示

**詳細**: [トラブルシューティング](./TROUBLESHOOTING.md)

---

## ✅ リリース判定

**ステータス**: ✅ **本番環境デプロイ可能**

**確認済み項目**:
- ✅ すべての🔴最高優先度問題を解決
- ✅ React Error #418の根本原因を解決
- ✅ Monacoドロップ機能が完全に動作
- ✅ セキュリティ問題なし（XSS対策完了）
- ✅ パフォーマンス問題なし
- ✅ レスポンシブデザイン対応

**監査レポート**:
- [実装状況](./IMPLEMENTATION_STATUS.md)
- [Hydration監査](./audits/hydration_audit_20251117.md)
- [Codex監査](./audits/codex-hydration-audit-20251117.md)

---

## 📚 関連ドキュメント

| ドキュメント | 説明 |
|------------|------|
| [README.md](../README.md) | プロジェクト全体概要、技術スタック |
| [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | 実装進捗、リリース判定 |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | 問題解決ガイド |
| [architecture-diagram.md](./architecture-diagram.md) | システム構成図 |
| [codepen_html.md](./codepen_html.md) | 基本スニペット管理機能 |
| [CLAUDE.md](../CLAUDE.md) | 実装ルール、ドキュメント管理 |

---

**Last Updated**: 2026-01-17
