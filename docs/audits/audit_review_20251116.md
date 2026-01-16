# コードレビュー監査レポート

**日付**: 2025-11-16
**対象**: `email-composer-spec.md` (HTMLメールコンポーザー機能仕様書)
**レビュアー**: Claude Code
**監査タイプ**: 仕様書レビュー

---

## 📋 監査概要

HTMLメールコンポーザー機能の仕様書を以下の観点でレビューしました：

1. コードの品質と可読性
2. セキュリティの問題
3. パフォーマンスの改善点
4. ベストプラクティスの遵守

---

## 1. 🎯 コードの品質と可読性

### ✅ 良い点

- **明確な構造**: 機能要件、技術仕様、実装TODOが整理されている
- **Mermaidダイアグラム**: 視覚的にフローを理解しやすい
- **段階的実装計画**: フェーズごとに分割され、見積もり時間も記載

### ⚠️ 改善点

#### 1.1 Zustand Store の設計

**問題**: `emailComposerStore.ts` の型定義が不完全

**場所**: `email-composer-spec.md` 234-250行目

```typescript
// 現在の仕様
interface EmailComposerStore {
  templateId: string;
  html: string;
  title: string;
  category: string;
  tags: string[];
  isDirty: boolean;
  // ...
}
```

**改善案**:
```typescript
interface EmailComposerStore {
  // 既存の状態
  templateId: string | null;  // null許容にすべき（初期状態）
  snippetId: string | null;   // 保存後のID管理が必要
  html: string;
  title: string;
  category: string;
  tags: string[];
  isDirty: boolean;
  isLoading: boolean;         // 追加: ローディング状態
  error: string | null;       // 追加: エラー状態

  // アクション
  setHtml: (html: string) => void;
  insertSnippet: (html: string, position: number) => void;
  setTitle: (title: string) => void;
  setCategory: (category: string) => void;
  setTags: (tags: string[]) => void;
  setIsDirty: (isDirty: boolean) => void;
  setLoading: (isLoading: boolean) => void;  // 追加
  setError: (error: string | null) => void;  // 追加
  reset: () => void;

  // 非同期アクション
  saveEmail: () => Promise<void>;  // 追加: 保存処理を Store に集約
}
```

**理由**: ローディング状態とエラー状態の管理が抜けている

**優先度**: 🟡 中

---

#### 1.2 コンポーネントの責務分離

**問題**: `EmailComposerPage` の責務が多すぎる可能性

**場所**: `email-composer-spec.md` 182-188行目

**現在の仕様**:
```
責務:
- ページ全体のレイアウト管理
- テンプレートデータの取得
- スニペット一覧の取得
```

**改善案**:
- データ取得ロジックをカスタムフック化
- `useEmailComposerData(templateId)` フックを作成
- ページコンポーネントはレイアウトのみに集中

```typescript
// hooks/useEmailComposerData.ts を追加
export function useEmailComposerData(templateId: string) {
  const [template, setTemplate] = useState<Snippet | null>(null);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // データ取得ロジック

  return { template, snippets, isLoading, error };
}
```

**優先度**: 🟡 中

---

#### 1.3 ドロップ位置の計算ロジックが曖昧

**問題**: アルゴリズムの詳細が不明確

**場所**: `email-composer-spec.md` 127-129行目

**現在の仕様**:
```
ドロップ位置の計算:
- カーソル位置から最も近いHTML要素を特定
- その要素の前後いずれかに挿入
```

**改善案**: より具体的なアルゴリズムを記載
```typescript
/**
 * ドロップ位置の計算ロジック:
 *
 * 1. イベントからマウス座標を取得 (event.clientY)
 * 2. iframe内の全てのブロックレベル要素を取得
 * 3. 各要素のboundingClientRect().top/bottomを計算
 * 4. カーソルY座標と各要素の中点を比較
 * 5. 最も近い要素を特定し、上半分なら before、下半分なら after
 * 6. HTMLインデックス位置を計算して返す
 */
```

**優先度**: 🟡 中

---

## 2. 🔐 セキュリティの問題

### 🔴 重大な問題

#### 2.1 XSS対策が不十分

**問題**: HTMLサニタイゼーションが「必要に応じて」となっている

**場所**: `email-composer-spec.md` 599-606行目

**現在の仕様**:
```
XSS対策:
- プレビューのサンドボックス化: iframeのsandbox属性を使用
- CSP (Content Security Policy): 既存の設定を維持
- HTMLサニタイゼーション: 必要に応じてDOMPurifyを導入
```

**問題点**: ユーザーがHTMLを直接編集できるため、XSSリスクが高い

**改善案**: DOMPurifyを**必須**で導入

**実装方針**:

1. **DOMPurifyを依存関係に追加**
```bash
npm install isomorphic-dompurify
```

2. **サニタイゼーション処理を実装**
```typescript
// lib/sanitize.ts を追加
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'div', 'p', 'span', 'a', 'img', 'table', 'tr', 'td', 'th', 'tbody',
      'thead', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'br', 'hr'
    ],
    ALLOWED_ATTR: ['href', 'src', 'style', 'class', 'id', 'alt', 'title'],
    ALLOW_DATA_ATTR: false,  // data-* 属性を禁止
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  });
}
```

3. **プレビュー表示時に必ずサニタイズ**
```typescript
// EmailPreviewPane.tsx
const sanitizedHtml = sanitizeHTML(html);
iframe.contentWindow.postMessage(
  { type: 'UPDATE_HTML', html: sanitizedHtml },
  window.location.origin
);
```

**優先度**: 🔴 最高（必須）

---

#### 2.2 iframeのsandbox属性が不十分

**問題**: セキュリティ設定が緩い可能性

**場所**: `email-composer-spec.md` 96行目、434行目

**現在の仕様**:
```html
<iframe sandbox="allow-scripts" />
```

**改善案**: より厳格な設定と代替案の検討

```html
<!-- 推奨設定 -->
<iframe
  sandbox="allow-scripts"
  <!-- postMessage は allow-same-origin なしでも動作可能 -->
/>

<!-- allow-same-origin は XSSリスクがあるため避ける -->
```

**セキュリティガイドライン**:
- ✅ `allow-scripts` のみに制限（postMessage用）
- ❌ `allow-same-origin` は避ける（XSSリスク）
- ❌ `allow-forms` は禁止
- ❌ `allow-top-navigation` は禁止

**優先度**: 🟠 高

---

#### 2.3 認証・認可の確認不足

**問題**: テンプレートの所有者確認が明記されていない

**場所**: `email-composer-spec.md` 76-89行目

**現在の仕様**:
```typescript
const { data: snippets } = await supabase
  .from('snippets')
  .select('*')
  .eq('owner_id', user.id)  // ✅ スニペット一覧はOK
  .eq('category', templateCategory)
  .is('deleted_at', null)
```

**問題点**: テンプレート自体の所有者確認が抜けている

**改善案**: テンプレート取得時の認可チェックを追加

```typescript
// EmailComposerPage.tsx - フェーズ1で実装
const { data: template, error } = await supabase
  .from('snippets')
  .select('*')
  .eq('id', templateId)
  .eq('owner_id', user.id)  // 追加: 所有者確認（認可チェック）
  .single();

if (error || !template) {
  // 403 Forbidden or 404 Not Found
  toast.error('テンプレートが見つからないか、アクセス権限がありません');
  redirect('/snippets');
}

// さらに #テンプレート タグの確認
if (!template.tags.includes('#テンプレート') && !template.tags.includes('#template')) {
  toast.error('指定されたスニペットはテンプレートではありません');
  redirect('/snippets');
}
```

**仕様書への追加事項**:
- フェーズ1に「テンプレート所有者確認」タスクを追加
- セキュリティセクションに「認可チェック」項目を追加

**優先度**: 🔴 最高（必須）

---

## 3. ⚡ パフォーマンスの改善点

### ⚠️ 改善が必要な箇所

#### 3.1 スニペット一覧のフィルタリング効率

**問題**: クライアント側でフィルタリングを行っている

**場所**: `email-composer-spec.md` 85-88行目

**現在の仕様**:
```typescript
// クライアント側でフィルタリング（非効率）
const filteredSnippets = snippets?.filter(
  s => !s.tags.includes('#テンプレート') && !s.tags.includes('#template')
);
```

**改善案**: PostgreSQLクエリレベルでフィルタリング

```typescript
const { data: snippets } = await supabase
  .from('snippets')
  .select('*')
  .eq('owner_id', user.id)
  .eq('category', templateCategory)
  .is('deleted_at', null)
  .not('tags', 'cs', '{#テンプレート,#template}')  // PostgreSQL配列演算子
  .order('updated_at', { ascending: false });
```

**メリット**:
- ✅ ネットワーク転送量削減
- ✅ クライアント側の処理不要
- ✅ スケーラビリティ向上

**優先度**: 🟡 中

---

#### 3.2 デバウンス時間の最適化

**問題**: 定数が散在している

**場所**: `email-composer-spec.md` 110行目、154行目

**現在の仕様**:
- プレビュー更新: 300ms
- 自動保存: 3000ms

**改善案**: 定数を一元管理

```typescript
// lib/constants.ts を追加
export const DEBOUNCE_TIMES = {
  PREVIEW_UPDATE: 300,      // プレビュー更新
  AUTO_SAVE: 3000,          // 自動保存
  SEARCH: 500,              // 将来の検索機能用
} as const;

export const PERFORMANCE_THRESHOLDS = {
  MAX_SNIPPETS_NORMAL: 50,      // 通常レンダリング
  MAX_SNIPPETS_VIRTUAL: 100,    // 仮想スクロール
  DROP_OPERATION_MS: 100,       // ドロップ操作目標時間
  PREVIEW_UPDATE_MS: 500,       // プレビュー更新目標時間
} as const;
```

**優先度**: 🟢 低

---

#### 3.3 仮想スクロールの実装タイミング

**問題**: 閾値が明確でない

**場所**: `email-composer-spec.md` 638行目

**現在の仕様**:
```
対策:
- 仮想スクロール (react-window) の導入
```

**改善案**: 具体的な閾値を設定

```markdown
パフォーマンス閾値:
- スニペット数が50個以下: 通常のレンダリング
- 51-100個: react-windowによる仮想スクロール
- 101個以上: ページネーション + 仮想スクロール
```

**実装方針**:
```typescript
// SnippetsSidebar.tsx
const SNIPPET_THRESHOLD = 50;

{snippets.length > SNIPPET_THRESHOLD ? (
  <VirtualizedSnippetList snippets={snippets} />
) : (
  <RegularSnippetList snippets={snippets} />
)}
```

**優先度**: 🟡 中

---

#### 3.4 不要な再レンダリングの防止

**問題**: Zustand Storeの使い方が最適化されていない可能性

**改善案**: セレクターの活用をベストプラクティスとして明記

```typescript
// ❌ 悪い例（全状態変更で再レンダリング）
const store = useEmailComposerStore();

// ✅ 良い例（必要な状態のみ購読）
const html = useEmailComposerStore(state => state.html);
const title = useEmailComposerStore(state => state.title);
const setHtml = useEmailComposerStore(state => state.setHtml);
```

**仕様書への追加**: ベストプラクティスセクションを新設

**優先度**: 🟡 中

---

## 4. ✅ ベストプラクティスの遵守

### ⚠️ 改善が必要な箇所

#### 4.1 エラーハンドリングの詳細化

**問題**: エラーハンドリングが抽象的

**場所**: `email-composer-spec.md` 514行目

**現在の仕様**:
```
- [ ] エラーハンドリングの追加
```

**改善案**: 具体的なエラーケースを列挙

```markdown
エラーハンドリング仕様:

1. **テンプレート読み込みエラー**
   - 404: テンプレートが見つからない → `/snippets` にリダイレクト + toast
   - 403: 権限なし → `/snippets` にリダイレクト + toast
   - ネットワークエラー → リトライ（最大3回、exponential backoff）

2. **スニペット一覧取得エラー**
   - ネットワークエラー → リトライ機能 (最大3回)
   - タイムアウト → エラーバナー表示 + 手動リトライボタン

3. **保存エラー**
   - 楽観的ロック競合 → 競合ダイアログ表示 + リロード促進
   - ネットワークエラー → オフラインバナー + ローカルストレージに一時保存
   - バリデーションエラー → エラーメッセージ表示

4. **ドラッグ&ドロップエラー**
   - スニペット取得失敗 → toast エラー
   - 挿入位置計算失敗 → デフォルト位置（末尾）に挿入 + 警告表示
```

**優先度**: 🟠 高

---

#### 4.2 アクセシビリティの具体化

**問題**: アクセシビリティ要件が抽象的

**場所**: `email-composer-spec.md` 577行目

**現在の仕様**:
```
- [ ] アクセシビリティ: キーボード操作対応
```

**改善案**: WCAG 2.1 AA準拠を明記

```markdown
アクセシビリティ要件 (WCAG 2.1 AA準拠):

1. **キーボード操作**
   - Tab: フォーカス移動
   - Shift+Tab: 逆方向フォーカス移動
   - Ctrl+S (Cmd+S): 手動保存
   - Esc: モーダル/ダイアログを閉じる
   - Space/Enter: ボタンアクティベート

2. **スクリーンリーダー対応**
   - aria-label を全インタラクティブ要素に追加
   - role="region" でセクション定義
   - aria-live でドラッグ中の状態通知
   - alt属性を画像に必須

3. **代替操作**
   - ドラッグ&ドロップができない場合、コンテキストメニューで挿入
   - キーボードショートカット一覧ページ提供

4. **視覚的フィードバック**
   - フォーカスインジケーター（outline）を明確に
   - カラーコントラスト比 4.5:1 以上（テキスト）
```

**優先度**: 🟡 中

---

#### 4.3 TypeScript型安全性の強化

**問題**: サンプルコードに型定義が不完全

**改善案**: 厳格な型定義を追加

```typescript
// types/email-composer.ts を新規追加
export interface SnippetInsertPosition {
  type: 'before' | 'after' | 'inside';
  elementIndex: number;
  cursorY: number;
}

export interface DragData {
  snippetId: string;
  html: string;
  type: 'snippet-card';
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface EmailComposerState {
  templateId: string | null;
  snippetId: string | null;
  html: string;
  title: string;
  category: string;
  tags: string[];
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;
  saveStatus: SaveStatus;
}

export interface EmailComposerActions {
  setHtml: (html: string) => void;
  insertSnippet: (html: string, position: SnippetInsertPosition) => void;
  setTitle: (title: string) => void;
  setCategory: (category: string) => void;
  setTags: (tags: string[]) => void;
  setIsDirty: (isDirty: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  saveEmail: () => Promise<void>;
}

export type EmailComposerStore = EmailComposerState & EmailComposerActions;
```

**優先度**: 🟡 中

---

#### 4.4 テストの具体化

**問題**: テストケースが抽象的

**場所**: `email-composer-spec.md` 516-523行目

**改善案**: 具体的なテストケースを追加

```markdown
### フェーズ8: テスト & デバッグ (拡張版)

#### 単体テスト (Vitest推奨)
- [ ] `emailComposerStore.ts` の全アクションテスト
  - [ ] setHtml/setTitle/setCategory/setTags
  - [ ] insertSnippet（位置計算）
  - [ ] reset（初期化）
- [ ] `drag-drop-utils.ts` の位置計算ロジックテスト
  - [ ] 正常ケース（上半分、下半分）
  - [ ] エッジケース（最初、最後の要素）
- [ ] `useEmailAutosave.ts` のデバウンス動作テスト
  - [ ] 3秒以内の連続変更
  - [ ] 楽観的ロックエラー処理
- [ ] `sanitize.ts` のサニタイゼーションテスト
  - [ ] <script>タグの除去
  - [ ] イベントハンドラ属性の除去

#### 統合テスト (React Testing Library)
- [ ] テンプレート読み込み → スニペット一覧表示
- [ ] ドラッグ&ドロップ → プレビュー更新 → 自動保存
- [ ] コード編集 → プレビュー更新 → 自動保存
- [ ] エラー発生時のUI表示

#### E2Eテスト (Playwright推奨)
- [ ] ログイン → テンプレート選択 → メール作成 → 保存
- [ ] 複数スニペットの挿入 → 順序確認
- [ ] 競合テスト (2タブで同時編集)
- [ ] レスポンシブ表示確認（モバイル、タブレット）

#### エッジケーステスト
- [ ] 空テンプレート (html="")
- [ ] 巨大HTML (100KB以上)
- [ ] 特殊文字を含むHTML (<script>, <iframe>, XSS攻撃コード)
- [ ] 同一スニペットの複数回挿入
- [ ] ネットワーク切断時の動作
- [ ] 非常に遅いネットワーク環境

#### パフォーマンステスト
- [ ] 100個のスニペット読み込み時間 (目標: < 1秒)
- [ ] ドロップ操作の応答時間 (目標: < 100ms)
- [ ] プレビュー更新の遅延 (目標: < 500ms)
- [ ] メモリリーク確認（長時間使用）
```

**優先度**: 🟠 高

---

#### 4.5 ログとモニタリング

**問題**: ログ戦略が記載されていない

**改善案**: 仕様書に新規セクションを追加

```markdown
## 🔍 ログとモニタリング

### ログレベル

1. **INFO**: 正常な操作
   - テンプレート読み込み成功
   - スニペット挿入成功
   - 保存成功

2. **WARN**: 警告
   - 自動保存リトライ
   - パフォーマンス閾値超過（操作時間）
   - 大きなHTML（サイズ警告）

3. **ERROR**: エラー
   - API呼び出し失敗
   - ドロップ位置計算エラー
   - サニタイゼーション失敗
   - 楽観的ロック競合

### メトリクス収集

- ドラッグ&ドロップ成功率
- 平均メール作成時間
- 自動保存の頻度
- エラー発生率
- パフォーマンス指標（Core Web Vitals）

### ツール候補
- **Sentry**: エラー追跡とパフォーマンス監視
- **Vercel Analytics**: ページパフォーマンス
- **PostHog**: ユーザー行動分析
- **Console Logs**: 開発環境でのデバッグ

### 実装例
```typescript
// lib/logger.ts
export const logger = {
  info: (message: string, data?: Record<string, unknown>) => {
    console.log(`[INFO] ${message}`, data);
    // 本番環境では Analytics に送信
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    console.warn(`[WARN] ${message}`, data);
    // 本番環境では Sentry に送信
  },
  error: (message: string, error?: Error, data?: Record<string, unknown>) => {
    console.error(`[ERROR] ${message}`, error, data);
    // 本番環境では Sentry に送信
  },
};
```
```

**優先度**: 🟢 低

---

## 📊 総合評価

### 🟢 優れている点

1. ✅ **明確な構造**: 9フェーズに分割され、実装しやすい
2. ✅ **視覚的な設計**: Mermaidダイアグラムで理解しやすい
3. ✅ **段階的アプローチ**: MVP → 拡張機能の優先順位が明確
4. ✅ **ドキュメント重視**: 実装後の更新まで考慮

### 🟡 改善が必要な点

1. ⚠️ **セキュリティ**: XSS対策が「必要に応じて」ではなく必須にすべき
2. ⚠️ **エラーハンドリング**: 具体的なケースを列挙する必要あり
3. ⚠️ **パフォーマンス**: 閾値と最適化戦略を明確化
4. ⚠️ **型安全性**: TypeScript型定義をより厳格に
5. ⚠️ **テスト**: 単体/統合/E2Eの具体的なケースを追加

### 🔴 重大な問題

1. 🔴 **DOMPurifyの導入が「必要に応じて」となっている** → XSSリスク高
2. 🔴 **テンプレート所有者確認が明記されていない** → 認可の脆弱性

---

## 🎯 必須修正項目（実装前に対応必須）

### 優先度: 🔴 最高

1. **DOMPurifyを必須依存関係に追加**
   - `lib/sanitize.ts` を実装
   - プレビュー表示時に必ずサニタイズ
   - フェーズ1に追加

2. **テンプレート所有者確認を実装**
   - `EmailComposerPage.tsx` でテンプレート取得時に認可チェック
   - フェーズ1に追加

3. **iframeのsandbox属性を厳格化**
   - `allow-scripts` のみに制限
   - セキュリティガイドラインを仕様書に追加

### 優先度: 🟠 高

4. **エラーハンドリング仕様を詳細化**
   - 4種類のエラーケースを定義
   - フェーズ5に詳細追加

5. **具体的なテストケースを追加**
   - 単体/統合/E2E/エッジケース/パフォーマンス
   - フェーズ8を拡張

### 優先度: 🟡 中

6. **Zustand Storeの型定義を完全化**
   - `isLoading`, `error`, `saveStatus` を追加

7. **TypeScript型定義ファイルを新規作成**
   - `types/email-composer.ts`

8. **パフォーマンス閾値を明確化**
   - 定数ファイル `lib/constants.ts` を追加

---

## 🎯 推奨される追加ドキュメント

仕様書に以下のセクションを追加することを推奨します：

1. ✅ **セキュリティチェックリスト** (必須項目として)
2. ✅ **パフォーマンス閾値定義**
3. ✅ **エラーハンドリング仕様**
4. ✅ **アクセシビリティ要件 (WCAG 2.1 AA準拠)**
5. ✅ **TypeScript型定義の完全版**
6. ✅ **テストケース一覧**
7. ✅ **ログとモニタリング戦略**

---

## ✅ 次のステップ

### ステップ1: 仕様書の修正（即座に実施）

- [ ] セキュリティセクションを修正（DOMPurify必須化）
- [ ] フェーズ1にセキュリティタスクを追加
- [ ] Zustand Store型定義を更新
- [ ] エラーハンドリング仕様を詳細化
- [ ] テストケースを拡張
- [ ] 新規セクション追加（ログ、型定義、パフォーマンス）

### ステップ2: 実装前の確認

- [ ] セキュリティチェックリスト作成
- [ ] パフォーマンス目標値の設定
- [ ] 型定義ファイルの作成

### ステップ3: 実装開始

- [ ] フェーズ1から順次実装
- [ ] 各フェーズ完了後、この監査レポートとの整合性確認

---

## 📝 監査結果サマリー

| カテゴリ | 問題数 | 🔴 最高 | 🟠 高 | 🟡 中 | 🟢 低 |
|---------|--------|---------|-------|-------|-------|
| セキュリティ | 3 | 2 | 1 | 0 | 0 |
| パフォーマンス | 4 | 0 | 0 | 3 | 1 |
| ベストプラクティス | 5 | 0 | 2 | 3 | 0 |
| コード品質 | 3 | 0 | 0 | 3 | 0 |
| **合計** | **15** | **2** | **3** | **9** | **1** |

---

## 🔖 タグ

`#security` `#xss-prevention` `#performance` `#accessibility` `#typescript` `#testing` `#error-handling`

---

**監査完了日**: 2025-11-16
**ステータス**: ✅ 完了
**次回監査**: 仕様書修正後に再レビュー実施
