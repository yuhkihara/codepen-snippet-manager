# ライブラリ選定評価レポート

**作成日**: 2026-01-17
**目的**: ビジュアルエディター実装に必要なライブラリの比較評価

---

## 1. ドラッグ&ドロップライブラリ

### 1.1 候補一覧

| ライブラリ | 最終更新 | 週間DL | サイズ | React 19対応 |
|-----------|---------|--------|--------|--------------|
| @dnd-kit/core | 2024-02 | 1.5M | 45KB | Yes |
| react-beautiful-dnd | 2022-08 | 2.8M | 140KB | No (deprecated) |
| react-dnd | 2023-10 | 1.8M | 80KB | Partial |
| @hello-pangea/dnd | 2024-10 | 400K | 140KB | Yes |
| pragmatic-drag-and-drop | 2024-11 | 100K | 30KB | Yes |

### 1.2 詳細評価

#### @dnd-kit/core (推奨)

**メリット**:
- React 18/19完全対応
- アクセシビリティ（WAI-ARIA）組み込み
- タッチデバイス対応
- 軽量（45KB gzipped）
- モジュラー設計（必要な機能のみインポート可能）
- 活発なメンテナンス

**デメリット**:
- 学習曲線がやや高い
- カスタムセンサー実装が必要な場合あり

**インストール**:
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**サンプルコード**:
```tsx
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableItem({ id }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {/* コンテンツ */}
    </div>
  );
}
```

#### @hello-pangea/dnd (代替案)

react-beautiful-dndのフォーク版。React 19対応。

**メリット**:
- react-beautiful-dndからの移行が容易
- 豊富なドキュメント
- 美しいアニメーション

**デメリット**:
- サイズが大きい（140KB）
- カスタマイズ性がdnd-kitより低い

#### pragmatic-drag-and-drop (Atlassian)

**メリット**:
- Atlassian製の新しいライブラリ
- 非常に軽量（30KB）
- フレームワーク非依存

**デメリット**:
- 比較的新しい（採用事例が少ない）
- React統合が手動

### 1.3 決定

**採用: @dnd-kit/core**

理由:
1. React 19完全対応
2. アクセシビリティ標準装備
3. 軽量かつモジュラー
4. 活発なコミュニティ
5. 本プロジェクトの要件（縦方向ソート）に最適

---

## 2. リッチテキスト編集ライブラリ

### 2.1 候補一覧

| ライブラリ | ベース | 週間DL | サイズ | 日本語IME |
|-----------|--------|--------|--------|-----------|
| @tiptap/react | ProseMirror | 500K | 200KB | Excellent |
| slate | 独自 | 400K | 150KB | Good |
| lexical | Meta独自 | 300K | 100KB | Good |
| draft-js | 独自 | 600K | 180KB | Partial |
| quill | 独自 | 700K | 120KB | Good |

### 2.2 詳細評価

#### @tiptap/react (推奨)

**メリット**:
- ProseMirrorベースで堅牢
- 日本語IME完全対応
- 拡張性が高い（Extension API）
- TypeScript完全対応
- React 19対応
- 豊富な公式拡張機能

**デメリット**:
- 学習曲線がやや高い
- フルバンドルは大きい（必要なものだけインポート推奨）

**インストール**:
```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder
```

**サンプルコード**:
```tsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

function Editor() {
  const editor = useEditor({
    extensions: [StarterKit],
    content: '<p>Hello World!</p>',
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      // 同期処理
    },
  });

  return <EditorContent editor={editor} />;
}
```

#### Lexical (代替案)

Meta（Facebook）製の新しいエディタフレームワーク。

**メリット**:
- 軽量（100KB）
- パフォーマンス重視設計
- アクセシビリティ対応

**デメリット**:
- APIがまだ安定していない部分あり
- 日本語IMEで稀に問題報告あり

#### Slate (代替案)

**メリット**:
- 完全にカスタマイズ可能
- データモデルが柔軟

**デメリット**:
- 低レベルすぎて実装コストが高い
- プラグインエコシステムが分散

### 2.3 インライン編集用の最小構成

本プロジェクトではフルエディタは不要。シンプルなテキスト編集のみ:

```tsx
// TipTapの最小構成
import { useEditor, EditorContent } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import HardBreak from '@tiptap/extension-hard-break';

const MinimalEditor = () => {
  const editor = useEditor({
    extensions: [Document, Paragraph, Text, HardBreak],
    content: '',
  });

  return <EditorContent editor={editor} />;
};
```

### 2.4 決定

**採用: @tiptap/react（最小構成）**

理由:
1. 日本語IME完全対応（最重要）
2. React 19対応
3. contenteditable の問題を抽象化
4. 改行処理が統一的
5. 必要な機能のみインポート可能

---

## 3. 追加検討ライブラリ

### 3.1 状態管理（既存: Zustand）

現在のZustand継続使用で問題なし。immerミドルウェアを追加推奨:

```bash
npm install immer
```

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

const useStore = create(immer((set) => ({
  // イミュータブル更新が簡潔に書ける
})));
```

### 3.2 ユーティリティ

| 用途 | ライブラリ | 理由 |
|------|-----------|------|
| デバウンス | lodash-es/debounce | 軽量、tree-shakable |
| UUID | crypto.randomUUID() | ブラウザ標準API（追加不要） |
| HTMLパース | 標準DOMParser | ブラウザ標準API（追加不要） |

---

## 4. 最終パッケージリスト

### 4.1 新規インストール

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @tiptap/react @tiptap/extension-document @tiptap/extension-paragraph @tiptap/extension-text @tiptap/extension-hard-break @tiptap/extension-placeholder immer lodash-es
```

### 4.2 開発依存

```bash
npm install -D @types/lodash-es
```

### 4.3 package.json追加分

```json
{
  "dependencies": {
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@tiptap/react": "^2.4.0",
    "@tiptap/extension-document": "^2.4.0",
    "@tiptap/extension-paragraph": "^2.4.0",
    "@tiptap/extension-text": "^2.4.0",
    "@tiptap/extension-hard-break": "^2.4.0",
    "@tiptap/extension-placeholder": "^2.4.0",
    "immer": "^10.0.0",
    "lodash-es": "^4.17.21"
  },
  "devDependencies": {
    "@types/lodash-es": "^4.17.12"
  }
}
```

### 4.4 バンドルサイズ見積もり

| パッケージ | gzipped |
|-----------|---------|
| @dnd-kit/* | ~50KB |
| @tiptap/* (minimal) | ~80KB |
| immer | ~5KB |
| lodash-es/debounce | ~1KB |
| **合計** | **~136KB** |

既存の依存関係と合わせても許容範囲。

---

## 5. リスク評価

| リスク | 影響 | 対策 |
|--------|------|------|
| TipTapの破壊的変更 | 中 | バージョン固定、定期的更新チェック |
| dnd-kitのメンテナンス停滞 | 低 | コミュニティ活発、代替案あり |
| バンドルサイズ増加 | 低 | dynamic importで遅延読み込み可能 |

---

## 6. 結論

| カテゴリ | 選定ライブラリ | 理由 |
|---------|---------------|------|
| D&D | @dnd-kit/core | React 19対応、軽量、アクセシビリティ |
| リッチテキスト | @tiptap/react | 日本語IME対応、ProseMirrorベース |
| 状態管理 | Zustand + immer | 既存継続、イミュータブル更新強化 |

**次のステップ**: ライブラリのインストールと、PoC拡張（dnd-kit/TipTap統合）
