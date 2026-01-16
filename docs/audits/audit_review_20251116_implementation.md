# コードレビュー監査レポート

**日付**: 2025-11-16
**対象**: メールコンポーザー機能実装（7コミット）
**レビュアー**: Claude Code
**監査タイプ**: コードレビュー

---

## 📋 監査概要

メールコンポーザー機能の実装コードを以下の観点でレビューしました：

1. コードの品質と可読性
2. セキュリティの問題
3. パフォーマンスの改善点
4. ベストプラクティスの遵守

**レビュー対象コミット:**
```
cdd1f77 fix: React Hydration Error #418を完全に修正
6f789bc fix: Snippet型の不一致を修正
bdf9225 feat: スニペットダブルクリックプレビューと#テンプレート除外
592a106 fix: プレビュー編集時のスクロール位置リセット問題を修正
c6da411 fix: ドロップ位置のずれとスクロール問題を修正
3048bd8 fix: React Hydration Error #418とSecurityErrorを修正（srcdoc方式）
```

**レビュー対象ファイル:**
- EmailPreviewPane.tsx
- EmailCodeEditor.tsx
- DraggableSnippetCard.tsx
- SnippetsSidebar.tsx
- SnippetPreviewModal.tsx

---

## 1. 🎯 コードの品質と可読性

### ✅ 良い点

1. **React Hooks の適切な使用**
   - useMemo でパフォーマンス最適化
   - useRef で不要な再レンダリングを防止
   - useEffect で副作用を適切に管理

2. **わかりやすいコメント**
   - `// 初回のみiframeを完全に設定`
   - `// スクロール位置を保存`
   - 処理の意図が明確

3. **状態管理の明確化**
   - isIframeReady で準備完了を管理
   - isDragOver でドラッグ状態を視覚化

### ⚠️ 改善点

#### 1.1 Snippet型の重複定義

**問題**: 各コンポーネントで同じ型を定義

**場所**:
- DraggableSnippetCard.tsx (4-13行)
- SnippetsSidebar.tsx (6-14行)
- SnippetPreviewModal.tsx (4-13行)

**現在の実装**:
```typescript
// 3つのファイルで同じ定義が重複
interface Snippet {
  id: string;
  title: string;
  description: string | null;
  html: string;
  category: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}
```

**改善案**: 共通型ファイルに集約

```typescript
// types/email-composer.ts（新規作成推奨）
export interface Snippet {
  id: string;
  title: string;
  description: string | null;
  html: string;
  category: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

// 各コンポーネント
import type { Snippet } from '@/types/email-composer';
```

**優先度**: 🟡 中

---

## 2. 🔐 セキュリティの問題

### 🔴 最高優先度

#### 2.1 DOMPurify が実装されていない（必須）

**問題**: 監査レポート（audit_review_20251116.md）の最高優先度指摘が未対応

**場所**: EmailPreviewPane.tsx 36行目

**現在の実装**:
```typescript
// iframe内でHTMLを直接設定（XSSリスク）
root.innerHTML = event.data.html;
```

**リスク**:
- XSS（クロスサイトスクリプティング）攻撃に脆弱
- ユーザーが悪意のあるスクリプトを含むスニペットを挿入可能
- `<script>alert('XSS')</script>` などが実行される

**改善案**: DOMPurify を必須で導入

1. **依存関係追加**:
```bash
npm install isomorphic-dompurify
npm install -D @types/dompurify
```

2. **lib/sanitize.ts を作成**:
```typescript
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'div', 'p', 'span', 'a', 'img', 'table', 'tr', 'td', 'th',
      'tbody', 'thead', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'strong', 'em', 'br', 'hr', 'ul', 'ol', 'li'
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'style', 'class', 'id', 'alt', 'title',
      'width', 'height', 'align', 'border', 'cellpadding', 'cellspacing'
    ],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link', 'style'],
    FORBID_ATTR: [
      'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus',
      'onblur', 'onchange', 'onsubmit'
    ],
  });
}
```

3. **EmailPreviewPane.tsx で使用**:
```typescript
import { sanitizeHTML } from '@/lib/sanitize';

// iframe内スクリプト
root.innerHTML = sanitizeHTML(event.data.html);
```

4. **SnippetPreviewModal.tsx でも使用**:
```typescript
srcDoc={`<!DOCTYPE html>
<html>
<head>...</head>
<body>
  ${sanitizeHTML(snippet.html)}
</body>
</html>`}
```

**優先度**: 🔴 最高（必須・リリース前に必ず対応）

---

### 🟠 高優先度

#### 2.2 iframe sandbox の検証

**現在の実装**:
```typescript
<iframe sandbox="allow-scripts" />
```

**検証結果**: ✅ 正しい
- `allow-scripts` のみ（postMessage用）
- `allow-same-origin` なし（監査レポート推奨に準拠）

**優先度**: ✅ 対応済み

---

## 3. ⚡ パフォーマンスの改善点

### ✅ 良い点

1. **useMemo の活用**
   - initScript: 一度だけ生成
   - initialFullHtml: 依存配列を最小化

2. **デバウンス処理**
   - EmailCodeEditor: 300msデバウンス
   - 過度な更新を防止

### ⚠️ 改善点

#### 3.1 postMessage の頻度

**問題**: html変更のたびにpostMessage送信

**場所**: EmailPreviewPane.tsx 82-98行

**現在の実装**:
```typescript
useEffect(() => {
  if (isIframeReady && iframe.contentWindow) {
    iframe.contentWindow.postMessage(
      { type: 'UPDATE_HTML', html },
      '*'
    );
  }
}, [html, isIframeReady, initialFullHtml]);
```

**改善案**: デバウンスを追加

```typescript
useEffect(() => {
  if (!isIframeReady || !iframe.contentWindow) return;

  const timer = setTimeout(() => {
    iframe.contentWindow.postMessage(
      { type: 'UPDATE_HTML', html },
      '*'
    );
  }, 100); // 100ms デバウンス

  return () => clearTimeout(timer);
}, [html, isIframeReady]);
```

**メリット**: CPU使用率削減、スムーズな編集体験

**優先度**: 🟡 中

---

## 4. 📚 ベストプラクティスの遵守

### ⚠️ 改善点

#### 4.1 エラーハンドリングの不足

**問題**: エラー処理が実装されていない

**場所**: EmailPreviewPane.tsx

**リスク**:
- postMessage 送信失敗時のフォールバック なし
- iframe読み込み失敗時の処理 なし
- 不正なHTMLの処理 なし

**改善案**:

```typescript
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    try {
      if (event.data.type === 'IFRAME_READY') {
        setIsIframeReady(true);
      } else if (event.data.type === 'IFRAME_ERROR') {
        console.error('Iframe error:', event.data.error);
        // エラー通知をユーザーに表示
      }
    } catch (error) {
      console.error('Message handling error:', error);
    }
  };

  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, []);
```

**優先度**: 🟠 高

---

#### 4.2 アクセシビリティの不足

**問題**: WCAG 2.1 AA基準に未準拠

**場所**:
- EmailPreviewPane.tsx: aria-label なし
- DraggableSnippetCard.tsx: キーボード操作未対応

**現在の実装**:
```typescript
<iframe
  ref={iframeRef}
  sandbox="allow-scripts"
  title="メールプレビュー"  // ✅ title はあり
  // ❌ aria-label なし
/>
```

**改善案**:

```typescript
// EmailPreviewPane.tsx
<iframe
  ref={iframeRef}
  sandbox="allow-scripts"
  title="メールプレビュー"
  aria-label="HTMLメールのリアルタイムプレビュー"
  role="region"
/>

// DraggableSnippetCard.tsx
<div
  draggable
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
  onDoubleClick={handleDoubleClick}
  onKeyDown={handleKeyDown}  // 追加
  tabIndex={0}               // 追加
  role="button"              // 追加
  aria-label={`${snippet.title}をドラッグして挿入`}
  className="..."
>
```

**キーボード操作サポート**:
```typescript
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (onDoubleClick) {
      onDoubleClick(snippet);
    }
  }
};
```

**優先度**: 🟡 中

---

## 総合評価

### 🎯 実装の良い点

1. ✅ React Hydration Error を完全に解決
2. ✅ スクロール位置の維持を実装
3. ✅ ドロップ位置の正確な計算
4. ✅ useMemo でパフォーマンス最適化
5. ✅ iframe sandbox を正しく設定

### 🔴 必須修正項目（リリース前）

| 優先度 | 項目 | 対応期限 |
|--------|------|----------|
| 🔴 最高 | DOMPurify の実装 | 即座 |
| 🟠 高 | エラーハンドリングの追加 | 1週間以内 |

### 🟡 推奨改善項目

| 優先度 | 項目 | 対応期限 |
|--------|------|----------|
| 🟡 中 | Snippet型の共通化 | 2週間以内 |
| 🟡 中 | postMessage のデバウンス | 2週間以内 |
| 🟡 中 | アクセシビリティ改善 | 1ヶ月以内 |

---

## 📝 推奨アクションアイテム

### 即座に対応（今日中）

1. **DOMPurify を実装**
   - [ ] `npm install isomorphic-dompurify @types/dompurify`
   - [ ] `lib/sanitize.ts` を作成
   - [ ] EmailPreviewPane.tsx で適用
   - [ ] SnippetPreviewModal.tsx で適用
   - [ ] テスト: `<script>alert('XSS')</script>` が除去されるか確認

### 1週間以内

2. **エラーハンドリングを追加**
   - [ ] try-catch でエラーキャッチ
   - [ ] iframe読み込みエラー処理
   - [ ] postMessage送信失敗時のフォールバック

### 2週間以内

3. **コード品質向上**
   - [ ] types/email-composer.ts を作成
   - [ ] Snippet型を共通化
   - [ ] postMessage にデバウンス追加

4. **アクセシビリティ改善**
   - [ ] aria-label 追加
   - [ ] role 属性追加
   - [ ] キーボード操作サポート

---

## 🔍 セキュリティチェックリスト

- [ ] ❌ DOMPurify インストール済み
- [ ] ❌ `lib/sanitize.ts` 実装済み
- [ ] ❌ EmailPreviewPane.tsx でサニタイズ適用
- [ ] ❌ SnippetPreviewModal.tsx でサニタイズ適用
- [x] ✅ iframe sandbox="allow-scripts" のみ
- [x] ✅ allow-same-origin なし
- [ ] ❌ XSS攻撃テスト実施済み
- [ ] ❌ セキュリティテスト（`<script>alert('XSS')</script>`）

---

## 結論

**実装品質**: ⭐⭐⭐⭐☆ (4/5)

**主な成果**:
- React Hydration Error を完全に解決
- スクロール位置維持を実現
- ドロップ位置の正確な計算

**重大な問題**:
- 🔴 DOMPurify が未実装（XSSリスク）

**推奨**:
1. DOMPurify を即座に実装
2. エラーハンドリングを追加
3. アクセシビリティを改善
4. その後リリース可能

---

**次回監査予定**: 2025-11-17 (DOMPurify実装後)
