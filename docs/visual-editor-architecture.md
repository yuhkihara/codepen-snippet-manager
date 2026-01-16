# メールプレビュー ビジュアルエディター アーキテクチャ

**作成日**: 2026-01-17
**ステータス**: 設計フェーズ

---

## 1. 機能概要

### 1.1 目標

メールプレビュー上で直感的にコンポーネントを操作できるビジュアルエディターを実装する。

### 1.2 主要機能

| 機能 | 説明 |
|------|------|
| **コンポーネント選択** | 1クリックでコンポーネントを選択状態にする |
| **ドラッグ&ドロップ並び替え** | プレビュー上でコンポーネントをドラッグして順序変更 |
| **インライン編集** | ダブルクリックで編集可能領域のテキストを直接編集 |
| **双方向同期** | プレビューの変更がMonaco Editorにリアルタイム反映 |

---

## 2. コンポーネント識別システム

### 2.1 データ属性規約

```html
<!-- コンポーネントのルート要素 -->
<div data-component-id="unique-id-123" data-component-type="header">

  <!-- 編集可能なテキスト領域 -->
  <h1 data-editable="title">ここを編集できます</h1>
  <p data-editable="subtitle">サブタイトル</p>

  <!-- 編集不可の要素 -->
  <img src="logo.png" alt="Logo" />
</div>
```

### 2.2 属性定義

| 属性 | 用途 | 値 |
|------|------|-----|
| `data-component-id` | コンポーネントの一意識別子 | UUID or スニペットID |
| `data-component-type` | コンポーネントの種類 | `header`, `content`, `footer`, `cta`, etc. |
| `data-editable` | 編集可能領域の識別子 | 任意の文字列（同一コンポーネント内で一意） |
| `data-sortable` | ドラッグ可能フラグ（オプション） | `true` / `false` |

### 2.3 スニペット挿入時のID付与

```typescript
// スニペットドロップ時にIDを自動付与
function wrapWithComponentId(html: string, snippetId: string): string {
  const uniqueId = `${snippetId}-${Date.now()}`;
  return `<!-- component:${uniqueId} -->\n<div data-component-id="${uniqueId}">\n${html}\n</div>\n<!-- /component:${uniqueId} -->`;
}
```

---

## 3. システムアーキテクチャ

### 3.1 コンポーネント構成

```
┌─────────────────────────────────────────────────────────────────┐
│                    EmailComposerClient                          │
│  ┌──────────────┬─────────────────┬─────────────────────────┐  │
│  │              │                 │                         │  │
│  │  Snippets    │  Monaco Editor  │  Visual Preview Editor  │  │
│  │  Sidebar     │                 │  (iframe)               │  │
│  │              │                 │                         │  │
│  └──────────────┴─────────────────┴─────────────────────────┘  │
│         │                │                    │                 │
│         │                │                    │                 │
│         └────────────────┴────────────────────┘                 │
│                          │                                      │
│                 ┌────────▼────────┐                             │
│                 │  Zustand Store  │                             │
│                 │  (SSOT)         │                             │
│                 └─────────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 新規コンポーネント

| コンポーネント | 責務 |
|---------------|------|
| `VisualPreviewEditor.tsx` | iframe内のビジュアル編集全体を管理 |
| `PreviewBridge.ts` | 親ウィンドウ ↔ iframe間のメッセージング |
| `ComponentOverlay.tsx` | 選択状態・ドラッグハンドルのオーバーレイ表示 |
| `InlineTextEditor.tsx` | インラインテキスト編集のUI |

### 3.3 Zustand Store拡張

```typescript
interface EmailComposerState {
  // 既存
  html: string;
  setHtml: (html: string) => void;

  // 新規追加
  selectedComponentId: string | null;
  setSelectedComponentId: (id: string | null) => void;

  editingField: { componentId: string; fieldName: string } | null;
  setEditingField: (field: { componentId: string; fieldName: string } | null) => void;

  componentOrder: string[];  // コンポーネントIDの配列（順序管理）
  reorderComponents: (fromIndex: number, toIndex: number) => void;

  updateComponentText: (componentId: string, fieldName: string, text: string) => void;
}
```

---

## 4. メッセージングプロトコル

### 4.1 親 → iframe

```typescript
type ParentToIframeMessage =
  | { type: 'UPDATE_HTML'; html: string }
  | { type: 'SELECT_COMPONENT'; componentId: string }
  | { type: 'DESELECT_ALL' }
  | { type: 'ENABLE_EDIT_MODE' }
  | { type: 'DISABLE_EDIT_MODE' };
```

### 4.2 iframe → 親

```typescript
type IframeToParentMessage =
  | { type: 'COMPONENT_CLICKED'; componentId: string }
  | { type: 'COMPONENT_DOUBLE_CLICKED'; componentId: string; fieldName: string }
  | { type: 'COMPONENT_REORDERED'; fromIndex: number; toIndex: number }
  | { type: 'TEXT_CHANGED'; componentId: string; fieldName: string; newText: string }
  | { type: 'EDIT_COMPLETED'; componentId: string; fieldName: string }
  | { type: 'IFRAME_READY' };
```

---

## 5. フローチャート

### 5.1 コンポーネント選択フロー

```
┌─────────────────┐
│  ユーザーが      │
│  コンポーネント  │
│  をクリック      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  iframe内で      │
│  click検知       │
│  closest([data-  │
│  component-id])  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  postMessage    │
│  COMPONENT_     │
│  CLICKED        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  親が受信       │
│  setSelected    │
│  ComponentId()  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Store更新      │
│  → UI再描画     │
│  → 選択枠表示   │
└─────────────────┘
```

### 5.2 ドラッグ&ドロップ並び替えフロー

```
┌─────────────────┐
│  ユーザーが      │
│  コンポーネント  │
│  をドラッグ開始  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  dragstart      │
│  ドラッグ中の    │
│  視覚効果適用    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  dragover       │
│  ドロップ位置    │
│  インジケータ    │
│  表示           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  drop           │
│  新しい順序を    │
│  計算           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  postMessage    │
│  COMPONENT_     │
│  REORDERED      │
│  {from, to}     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  親が受信       │
│  reorder        │
│  Components()   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  HTML再構築     │
│  コンポーネント  │
│  順序を反映     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Monaco Editor  │
│  更新           │
└─────────────────┘
```

### 5.3 インラインテキスト編集フロー

```
┌─────────────────┐
│  ユーザーが      │
│  編集可能領域    │
│  をダブルクリック │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  [data-editable]│
│  要素を検出     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  postMessage    │
│  COMPONENT_     │
│  DOUBLE_CLICKED │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  親が受信       │
│  setEditingField│
│  ({id, field})  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  contenteditable│
│  = "true"       │
│  フォーカス設定  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│              編集中                   │
│  ┌─────────────────────────────┐    │
│  │  input/keyup イベント        │    │
│  │         │                   │    │
│  │         ▼                   │    │
│  │  改行を<br>に変換            │    │
│  │         │                   │    │
│  │         ▼                   │    │
│  │  postMessage TEXT_CHANGED   │    │
│  │         │                   │    │
│  │         ▼                   │    │
│  │  Store更新 → Monaco更新     │    │
│  └─────────────────────────────┘    │
└────────────────┬────────────────────┘
                 │
                 ▼ (blur または Escape)
┌─────────────────┐
│  postMessage    │
│  EDIT_COMPLETED │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  contenteditable│
│  = "false"      │
│  編集モード終了  │
└─────────────────┘
```

---

## 6. HTML解析・再構築アルゴリズム

### 6.1 コンポーネント抽出

```typescript
interface ParsedComponent {
  id: string;
  type: string;
  html: string;
  editableFields: Map<string, string>;  // fieldName → currentText
  startIndex: number;  // 元HTMLでの開始位置
  endIndex: number;    // 元HTMLでの終了位置
}

function parseComponents(html: string): ParsedComponent[] {
  // コメントマーカーまたはdata-component-id属性でコンポーネントを検出
  // 正規表現 + DOMParser併用
}
```

### 6.2 テキスト更新

```typescript
function updateEditableText(
  html: string,
  componentId: string,
  fieldName: string,
  newText: string
): string {
  // 1. 改行を<br>に変換
  const htmlText = newText.replace(/\n/g, '<br>');

  // 2. DOMParserでHTML解析
  // 3. 対象要素を特定して更新
  // 4. シリアライズして返却
}
```

### 6.3 順序変更

```typescript
function reorderComponentsInHtml(
  html: string,
  fromIndex: number,
  toIndex: number
): string {
  // 1. コンポーネントを抽出
  // 2. 配列内で順序変更
  // 3. 再構築して返却
}
```

---

## 7. iframe内スクリプト

### 7.1 注入するJavaScript

```javascript
// preview-editor.js - iframe内で実行
(function() {
  let selectedComponent = null;
  let editingElement = null;

  // 選択スタイル
  const selectionStyle = document.createElement('style');
  selectionStyle.textContent = `
    [data-component-id].selected {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
    }
    [data-component-id]:hover:not(.selected) {
      outline: 1px dashed #94a3b8;
      outline-offset: 2px;
    }
    [data-component-id].dragging {
      opacity: 0.5;
    }
    .drop-indicator {
      height: 4px;
      background: #3b82f6;
      margin: 4px 0;
    }
    [data-editable].editing {
      outline: 2px solid #10b981;
      min-height: 1em;
    }
  `;
  document.head.appendChild(selectionStyle);

  // イベントリスナー設定
  document.body.addEventListener('click', handleClick);
  document.body.addEventListener('dblclick', handleDoubleClick);
  // ... ドラッグイベント

  // 親との通信
  window.addEventListener('message', handleParentMessage);
  window.parent.postMessage({ type: 'IFRAME_READY' }, '*');
})();
```

---

## 8. セキュリティ考慮事項

### 8.1 iframe sandbox

```html
<iframe
  sandbox="allow-scripts"
  <!-- allow-same-originは使用しない（XSS防止） -->
/>
```

### 8.2 postMessage検証

```typescript
// 親側
window.addEventListener('message', (e) => {
  // originは検証しない（sandbox iframe はnull origin）
  // 代わりにメッセージ構造を厳密に検証
  if (!isValidIframeMessage(e.data)) return;
});

function isValidIframeMessage(data: unknown): data is IframeToParentMessage {
  // Zodでスキーマ検証
}
```

### 8.3 HTMLサニタイゼーション

- プレビュー表示時: 既存の`sanitizeHTML()`を継続使用
- Monaco更新時: ユーザー入力テキストのみエスケープ、構造は保持

---

## 9. 実装フェーズ

### Phase 1: コンポーネント選択（1クリック）
- [ ] data属性規約の実装
- [ ] iframe内クリックハンドラー
- [ ] 選択状態のビジュアル表示
- [ ] Store拡張

### Phase 2: ドラッグ&ドロップ並び替え
- [ ] ドラッグハンドルUI
- [ ] ドロップインジケータ
- [ ] HTML再構築ロジック
- [ ] Monaco同期

### Phase 3: インラインテキスト編集
- [ ] ダブルクリック検出
- [ ] contenteditable制御
- [ ] 改行→`<br>`変換
- [ ] リアルタイム同期

### Phase 4: 統合・最適化
- [ ] パフォーマンスチューニング
- [ ] アンドゥ/リドゥ対応
- [ ] キーボードショートカット
- [ ] E2Eテスト

---

## 10. 技術的リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| sandboxed iframe制約 | ドラッグ操作の制限 | postMessageで座標情報を送信し親側で処理 |
| HTML構造の複雑さ | 解析・再構築の難しさ | コメントマーカーで明確な境界を設定 |
| パフォーマンス | 大きなHTMLで遅延 | デバウンス、差分更新、仮想化検討 |
| カーソル位置消失 | Monaco編集中断 | 変更箇所のみ差分更新、カーソル位置保存 |

---

## 関連ドキュメント

- [email-composer-spec.md](./email-composer-spec.md) - 既存仕様
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - トラブルシューティング
- [architecture-diagram.md](./architecture-diagram.md) - システム全体図
