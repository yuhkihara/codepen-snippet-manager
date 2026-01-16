# ビジュアルエディター ルール・規約

**作成日**: 2026-01-17
**関連**: [visual-editor-spec.md](./visual-editor-spec.md)

---

## 1. コンポーネント挿入マーカー

### 1.1 概要

テンプレートHTML内で、コンポーネントを挿入できる領域を明示的に指定するためのマーカー。

### 1.2 マーカー形式

```html
<!--ここにコンポーネントを入れる-->
<!-- この範囲内にコンポーネントが挿入される -->
<!--/ここにコンポーネントを入れる-->
```

### 1.3 テンプレート構造

```html
<!-- ===== ヘッダー部分（固定・編集不可） ===== -->
<div class="header">
  <h1>Newsletter Title</h1>
</div>

<!--ここにコンポーネントを入れる-->

<!-- ===== コンポーネント領域（編集可能） ===== -->
<div class="content">
  <p data-editable="intro">ここにテキスト</p>
</div>

<!--/ここにコンポーネントを入れる-->

<!-- ===== フッター部分（固定・編集不可） ===== -->
<div class="footer">
  <p>Copyright 2026</p>
</div>
```

### 1.4 動作仕様

| 領域 | 操作 | ビジュアル表示 |
|------|------|----------------|
| ヘッダー | 表示のみ | 半透明(opacity-80)、編集不可 |
| コンポーネント領域 | D&D並替、追加、削除、テキスト編集 | 薄い青背景、点線境界 |
| フッター | 表示のみ | 半透明(opacity-80)、編集不可 |

### 1.5 マーカーがない場合

マーカーがない場合、HTML全体がコンポーネント領域として扱われる。

---

## 2. 編集可能テキスト属性

### 2.1 `data-editable` 属性

テキスト要素をダブルクリックで編集可能にするための属性。

```html
<h1 data-editable="title">編集可能なタイトル</h1>
<p data-editable="body">編集可能な本文</p>
```

### 2.2 対象タグ

以下のタグに`data-editable`属性を付与可能:

| カテゴリ | タグ |
|----------|------|
| 見出し | `h1`, `h2`, `h3`, `h4`, `h5`, `h6` |
| 段落 | `p` |
| インライン | `span`, `label` |
| テーブル | `td`, `th` |
| リスト | `li` |

### 2.3 自動付与機能

サイドバーからスニペットを追加する際、上記タグに自動で`data-editable`属性が付与される。

**自動付与の条件**:
- 対象タグである
- 既に`data-editable`属性がない
- テキストコンテンツがある

**自動生成される属性名**: `field-{componentId(8文字)}-{index}`

```html
<!-- 追加前 -->
<h1>タイトル</h1>
<p>本文</p>

<!-- 追加後（自動付与） -->
<h1 data-editable="field-a1b2c3d4-0">タイトル</h1>
<p data-editable="field-a1b2c3d4-1">本文</p>
```

### 2.4 編集操作

| 操作 | 方法 |
|------|------|
| 編集開始 | `data-editable`要素をダブルクリック |
| 編集終了 | `Escape`キー または 「閉じる」ボタン |
| 保存 | 「保存して閉じる」ボタン |
| 改行 | `Enter`キー（`<br>`に変換される） |

---

## 3. コンポーネントマーカー

### 3.1 概要

各コンポーネントを識別するためのHTMLコメントマーカー。シリアライズ時に自動生成される。

### 3.2 形式

```html
<!-- component:uuid-here -->
<div data-component-id="uuid-here" data-component-type="snippet">
  <!-- コンポーネント内容 -->
</div>
<!-- /component:uuid-here -->
```

### 3.3 属性

| 属性 | 説明 |
|------|------|
| `data-component-id` | コンポーネントの一意識別子(UUID) |
| `data-component-type` | コンポーネントタイプ: `snippet`, `section`, `template` |

---

## 4. スニペット作成ガイドライン

### 4.1 推奨構造

```html
<div style="padding: 24px;">
  <h2 data-editable="heading">見出し</h2>
  <p data-editable="description">説明文をここに入力</p>
</div>
```

### 4.2 ベストプラクティス

1. **ルート要素は1つ**: 複数のルート要素は個別コンポーネントとして分割される
2. **インラインスタイル推奨**: メール互換性のためCSSクラスよりインラインスタイルを使用
3. **意味のある属性名**: `data-editable="title"`のように、内容を表す名前を付ける
4. **テーブルレイアウト**: 複雑なレイアウトはテーブルを使用（メール互換性）

### 4.3 テンプレート作成時の注意

- ヘッダー/フッターを固定したい場合は必ずマーカーを使用
- マーカー内には少なくとも1つのコンポーネント要素を配置
- 空のマーカー領域も許可（スニペット追加用）

---

## 5. 関連ファイル

| ファイル | 役割 |
|----------|------|
| `store/emailComposerStore.ts` | 状態管理、パース、シリアライズ |
| `components/email-composer/VisualPreviewEditor.tsx` | ビジュアル編集UI |
| `components/email-composer/EmailCodeEditor.tsx` | Monaco Editor連携 |

---

## 6. 定数・設定

```typescript
// コンポーネント挿入マーカー
const COMPONENT_MARKER = '<!--ここにコンポーネントを入れる-->';
const COMPONENT_MARKER_END = '<!--/ここにコンポーネントを入れる-->';

// 自動editable対象タグ
const AUTO_EDITABLE_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'td', 'th', 'li', 'label'];

// 履歴
const MAX_HISTORY_SIZE = 50;
const HISTORY_DEBOUNCE_MS = 500;
```

---

**Last Updated**: 2026-01-17
