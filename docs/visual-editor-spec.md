# ビジュアルエディター機能 仕様書

**作成日**: 2026-01-17
**ステータス**: 実装完了
**関連**: [email-composer-spec.md](./email-composer-spec.md)

---

## 1. 機能概要

### 1.1 目的

メールプレビュー上でコンポーネントを直感的に操作できるビジュアルエディターを提供する。

### 1.2 主要機能

| 機能 | 説明 | 操作 |
|------|------|------|
| **コンポーネント選択** | コンポーネントを選択状態にする | 1クリック |
| **ドラッグ&ドロップ並び替え** | コンポーネントの順序を変更 | ドラッグハンドルをD&D |
| **インラインテキスト編集** | 編集可能領域のテキストを直接編集 | ダブルクリック |
| **スニペット追加** | サイドバーからスニペットを追加 | D&Dでドロップ |
| **コンポーネント削除** | 不要なコンポーネントを削除 | ゴミ箱アイコン |
| **Undo/Redo** | 操作の取り消し/やり直し | Cmd+Z / Cmd+Shift+Z |

---

## 2. アーキテクチャ

### 2.1 システム構成

```
┌─────────────────────────────────────────────────────────────────┐
│                    EmailComposerClient                          │
├─────────────┬───────────────────────┬───────────────────────────┤
│             │                       │                           │
│  Snippets   │  VisualPreviewEditor  │  EmailCodeEditor          │
│  Sidebar    │  (dnd-kit + TipTap)   │  (Monaco Editor)          │
│             │                       │                           │
│  [D&D元]    │  [D&D先 + 編集]       │  [コード編集]             │
│             │                       │                           │
└─────────────┴───────────┬───────────┴───────────────────────────┘
                          │
              ┌───────────▼───────────┐
              │    Zustand Store      │
              │    (SSOT - AST構造)   │
              │                       │
              │  - components         │
              │  - componentOrder     │
              │  - history            │
              │  - selectedId         │
              │  - editingField       │
              └───────────────────────┘
```

### 2.2 データフロー

```
ユーザー操作
    │
    ├─→ VisualPreviewEditor ─┐
    │                        │
    ├─→ Monaco Editor ───────┼─→ Zustand Store ─→ 全コンポーネント更新
    │                        │
    └─→ Sidebar D&D ─────────┘
```

### 2.3 単一データソース（SSOT）

- **Zustand Store**がすべての状態を管理
- VisualPreviewEditorとMonaco Editorはビューとして機能
- 変更はすべてStore経由で行い、双方向同期を実現

---

## 3. データ構造

### 3.1 コンポーネントノード

```typescript
interface ComponentNode {
  id: string;                              // UUID (crypto.randomUUID())
  type: string;                            // 'section' | 'snippet' | 'template'
  sourceSnippetId?: string;                // 元スニペットのID
  editableFields: Record<string, EditableField>;
  innerHtml: string;                       // 内部HTML
}

interface EditableField {
  name: string;                            // data-editable属性の値
  value: string;                           // 現在のテキスト（改行は\n）
}
```

### 3.2 Store構造

```typescript
interface EmailComposerStore {
  // メタデータ
  templateId: string;
  title: string;
  category: string;
  tags: string[];
  isDirty: boolean;

  // AST構造
  components: Record<string, ComponentNode>;
  componentOrder: string[];                // IDの配列で順序管理

  // Monaco Editor連携
  rawHtml: string | null;                  // Monaco入力を保持（パースせず）
  headerHtml: string;                      // マーカー前の固定HTML
  footerHtml: string;                      // マーカー後の固定HTML

  // ビジュアル編集状態
  selectedComponentId: string | null;
  editingField: { componentId: string; fieldName: string } | null;

  // 履歴
  history: {
    past: HistoryEntry[];
    future: HistoryEntry[];
  };

  // 変更検知
  updateSeq: number;
}
```

### 3.3 履歴エントリ

```typescript
interface HistoryEntry {
  type: 'add' | 'delete' | 'reorder' | 'text_change' | 'html_change';
  timestamp: number;
  snapshot: {
    components: Record<string, ComponentNode>;
    componentOrder: string[];
  };
}
```

---

## 4. コンポーネント識別システム

### 4.1 HTML属性規約

```html
<!-- 編集可能なテキスト領域 -->
<h1 data-editable="title">編集可能テキスト</h1>
<p data-editable="subtitle">サブタイトル</p>
```

### 4.2 コンポーネントマーカー（シリアライズ時）

```html
<!-- component:uuid-here -->
<div data-component-id="uuid-here" data-component-type="section">
  <!-- 内部HTML -->
</div>
<!-- /component:uuid-here -->
```

### 4.3 HTMLパース処理

1. **マーカーあり**: コメントマーカーでコンポーネントを検出
2. **マーカーなし**: トップレベル要素ごとに自動分割

```typescript
// トップレベル要素ごとに分割
const topLevelElements = doc.body.children;
Array.from(topLevelElements).forEach((element) => {
  const component = parseComponentFromHtml(element.outerHTML, id);
  // ...
});
```

---

## 5. 機能詳細

### 5.1 コンポーネント選択

**操作**: コンポーネントをクリック

**表示**:
- 選択中: 青色リング (`ring-2 ring-blue-500`)
- ホバー: グレーリング (`ring-1 ring-gray-300`)

**実装**:
```tsx
<div
  onClick={() => setSelectedComponentId(componentId)}
  className={isSelected ? 'ring-2 ring-blue-500' : 'hover:ring-1'}
/>
```

### 5.2 ドラッグ&ドロップ並び替え

**ライブラリ**: @dnd-kit/core, @dnd-kit/sortable

**操作**: ドラッグハンドル（6点アイコン）をドラッグ

**実装**:
```tsx
<DndContext onDragEnd={handleDragEnd}>
  <SortableContext items={componentOrder} strategy={verticalListSortingStrategy}>
    {componentOrder.map((id) => (
      <SortableComponent key={id} componentId={id} />
    ))}
  </SortableContext>
</DndContext>
```

### 5.3 インラインテキスト編集

**ライブラリ**: @tiptap/react

**操作**:
1. `data-editable`属性を持つ要素をダブルクリック
2. モーダルでTipTapエディターが開く
3. 編集 → 保存/Escapeで閉じる

**改行処理**:
- 入力時: 改行は`\n`として保持
- 表示時: `\n` → `<br>`に変換

**SSR対応**:
```typescript
const editor = useEditor({
  // ...
  immediatelyRender: false,  // Next.js SSR対応
});
```

### 5.4 スニペット追加（外部D&D）

**操作**: サイドバーからスニペットをビジュアルエディターにドラッグ&ドロップ

**挿入位置**:
- コンポーネントが選択されている場合: 選択中のコンポーネントの**上（前）**に挿入
- 選択がない場合: 末尾に追加

**実装**:
```tsx
// ドロップハンドラ
const handleExternalDrop = (e: React.DragEvent) => {
  const snippetHtml = e.dataTransfer.getData('text/plain');
  const jsonData = e.dataTransfer.getData('application/json');

  // 選択中のコンポーネントの上に挿入
  let insertIndex: number | undefined;
  if (selectedComponentId) {
    const selectedIndex = componentOrder.indexOf(selectedComponentId);
    if (selectedIndex !== -1) {
      insertIndex = selectedIndex;
    }
  }

  addComponent(snippetHtml, snippetId, insertIndex);
};
```

**オーバーレイ表示**: ドラッグ中は緑色のドロップゾーンを表示（挿入位置も表示）

### 5.5 コンポーネント削除

**操作**: 選択中のコンポーネントのゴミ箱アイコンをクリック

**確認**: `confirm()`ダイアログで確認

### 5.6 Undo/Redo

**操作**:
- Undo: `Cmd+Z` (Mac) / `Ctrl+Z` (Win)
- Redo: `Cmd+Shift+Z` / `Ctrl+Shift+Z`

**履歴管理**:
- 最大50エントリ
- テキスト変更は500ms以内の連続入力を1エントリに統合

---

## 6. Monaco Editor連携

### 6.1 双方向同期

```
VisualPreviewEditor → Store → Monaco Editor
Monaco Editor → Store → VisualPreviewEditor
```

### 6.2 変更検知

- `updateSeq`（シーケンス番号）で変更を検知
- 自身が発生させた変更は無視（無限ループ防止）
- `rawHtml`パターンでMonaco入力を保持

```typescript
const isMonacoOriginRef = useRef(false);

// Store変更時
useEffect(() => {
  if (isMonacoOriginRef.current) {
    isMonacoOriginRef.current = false;
    return;  // 自身の変更は無視
  }
  // rawHtmlがある場合（Monaco編集中）はStore→Monaco更新をスキップ
  if (rawHtml !== null) return;
  // 外部変更を反映
}, [updateSeq, rawHtml]);

// Monaco編集時
debounceTimerRef.current = setTimeout(() => {
  isMonacoOriginRef.current = true;
  setRawHtml(value);  // パースしつつrawHtmlも保存
}, 100);
```

### 6.3 rawHtmlパターン（2026-01-17追加）

| 関数 | 用途 | rawHtml |
|------|------|---------|
| `setRawHtml` | Monaco編集時 | 保存（入力をそのまま維持） |
| `setHtml` | Visual Editor編集時 | クリア |
| `getHtml` | HTML取得 | あればそのまま返す |

**目的**: Monacoで入力したHTMLをパース→再シリアライズで変形させない

### 6.4 Visual Editor入力時の同期タイミング（2026-01-17追加）

Visual Editorでのインライン編集中は、入力のたびにMonacoに同期すると干渉が発生するため、**編集完了時のみ**同期する。

| タイミング | 同期 | 説明 |
|-----------|------|------|
| 文字入力中 | しない | ストレスなく編集可能 |
| blur（フォーカスアウト） | する | 他の場所をクリック時 |
| Escapeキー | する | 編集キャンセル時 |
| 選択解除 | する | 別コンポーネント選択時 |

```typescript
// 入力イベントでは同期しない
// blur/Escape/選択解除時のみsyncToStore()を呼び出す
const handleFocusOut = () => {
  syncToStore();  // 編集完了時にStoreに同期
};
```

---

## 7. ファイル構成

```
components/email-composer/
├── EmailComposerClient.tsx      # メインクライアント
├── EmailComposerHeader.tsx      # ヘッダー
├── SnippetsSidebar.tsx          # スニペット一覧
├── DraggableSnippetCard.tsx     # ドラッグ可能カード
├── VisualPreviewEditor.tsx      # ビジュアルエディター（新規）
├── EmailCodeEditor.tsx          # Monaco Editor（更新）
├── SaveEmailDialog.tsx          # 保存ダイアログ
└── SnippetPreviewModal.tsx      # プレビューモーダル

store/
└── emailComposerStore.ts        # Zustand Store（更新）
```

---

## 8. 依存ライブラリ

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| @dnd-kit/core | ^6.1.0 | D&Dコア機能 |
| @dnd-kit/sortable | ^8.0.0 | ソート機能 |
| @dnd-kit/utilities | ^3.2.2 | CSSユーティリティ |
| @tiptap/react | ^2.4.0 | リッチテキスト編集 |
| @tiptap/extension-* | ^2.4.0 | TipTap拡張 |
| immer | ^10.0.0 | イミュータブル更新 |
| lodash-es | ^4.17.21 | デバウンス等 |
| lucide-react | latest | アイコン |

---

## 9. UI/UX仕様

### 9.1 レイアウト

```
┌─────────────────────────────────────────────────────────┐
│ Header                                                  │
├──────────┬─────────────────────┬────────────────────────┤
│          │                     │                        │
│ Snippets │ Visual Editor       │ Code Editor            │
│ Sidebar  │ (ドラッグ&編集)     │ (Monaco)               │
│          │                     │                        │
│ w-72     │ flex-1              │ flex-1                 │
│          │                     │                        │
└──────────┴─────────────────────┴────────────────────────┘
```

### 9.2 ビジュアルフィードバック

| 状態 | 表示 |
|------|------|
| ホバー | グレー枠線 |
| 選択中 | 青色リング + ツールバー表示 |
| ドラッグ中 | 半透明 + ドラッグオーバーレイ |
| 編集中 | TipTapモーダル（緑色枠） |
| 外部D&D | 緑色ドロップゾーン |

### 9.3 アイコン

- **ドラッグハンドル**: 6点グリッド（GripVertical）
- **削除**: ゴミ箱（Trash2）
- **Undo**: 左矢印（Undo）
- **Redo**: 右矢印（Redo）

---

## 10. エラーハンドリング

| シナリオ | 対応 |
|---------|------|
| HTMLパースエラー | console.error + トースト通知 |
| D&Dキャンセル | 状態をリセット |
| 削除確認キャンセル | 何もしない |
| TipTap SSRエラー | `immediatelyRender: false`で防止 |

---

## 11. パフォーマンス最適化

### 11.1 メモ化

```typescript
// コンポーネント単位でメモ化
const SortableComponent = memo(function SortableComponent({ componentId }) {
  const component = useEmailComposerStore((state) => state.components[componentId]);
  // ...
});
```

### 11.2 セレクタ最適化

```typescript
// 必要な状態のみサブスクライブ
const component = useEmailComposerStore((state) => state.components[componentId]);
const isSelected = useEmailComposerStore((state) => state.selectedComponentId === componentId);
```

### 11.3 履歴サイズ制限

```typescript
const MAX_HISTORY_SIZE = 50;
if (state.history.past.length > MAX_HISTORY_SIZE) {
  state.history.past.shift();
}
```

### 11.4 テキスト変更デバウンス

- TipTap → Store: 150ms
- Monaco → Store: 300ms
- 履歴統合: 500ms以内の連続変更

---

## 12. デモ / テスト

### 12.1 デモページ（認証不要）

```
http://localhost:3000/test/composer
```

**用途**: ビジュアルエディター機能のデモ・動作確認用

| 項目 | 内容 |
|------|------|
| **認証** | 不要（いつでもアクセス可能） |
| **データ** | ハードコードされたサンプルテンプレート + 3つのスニペット |
| **保存** | 不可（メモリ上のみ） |
| **ファイル** | `app/test/composer/page.tsx` |

> **Note**: 本番環境（`/email-composer/[templateId]`）と同じコンポーネントを使用しているため、デモで確認した動作はそのまま本番でも再現される。

### 12.2 本番ページ（認証必要）

```
http://localhost:3000/email-composer/[templateId]
```

| 項目 | 内容 |
|------|------|
| **認証** | Supabase認証必須 |
| **データ** | Supabaseから取得した実データ |
| **保存** | Supabaseに保存可能 |

### 12.3 テストシナリオ

1. **コンポーネント分離**: 3つのセクションが個別に表示される
2. **選択**: クリックで青枠表示
3. **並び替え**: ドラッグハンドルでD&D
4. **テキスト編集**: ダブルクリック → モーダル → 編集 → 保存
5. **スニペット追加**: サイドバーからD&D（選択中のコンポーネントの上に挿入）
6. **削除**: ゴミ箱アイコン → 確認 → 削除
7. **Undo/Redo**: Cmd+Z / Cmd+Shift+Z
8. **Monaco同期**: ビジュアル編集がコードに反映

---

## 13. 今後の拡張案

| 機能 | 説明 | 優先度 |
|------|------|--------|
| 複数選択 | Shift/Cmd+クリックで複数選択 | 中 |
| コピー&ペースト | コンポーネントの複製 | 中 |
| キーボードナビゲーション | 矢印キーで選択移動 | 低 |
| ドラッグプレビュー | ドラッグ中に挿入位置をプレビュー | 低 |
| コンポーネントテンプレート | よく使う構造をテンプレート化 | 低 |

---

## 関連ドキュメント

- [visual-editor-rules.md](./visual-editor-rules.md) - **ルール・規約（必読）**
- [email-composer-spec.md](./email-composer-spec.md) - メールコンポーザー全体仕様
- [visual-editor-architecture-v2.md](./visual-editor-architecture-v2.md) - アーキテクチャ設計
- [library-evaluation.md](./library-evaluation.md) - ライブラリ選定
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - トラブルシューティング

---

**Last Updated**: 2026-01-17
