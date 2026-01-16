# トラブルシューティングガイド

## React Hydration Error #418 （✅ 完全解決済み）

### 症状
- `Uncaught Error: Minified React error #418` が発生する

### ✅ 解決済み（2025-11-17）
この問題は**完全に解決済み**です。最新のコードでは以下の修正により、Hydration Errorは発生しません：

1. **タイムゾーン固定の日付フォーマット** (`lib/formatDate.ts`)
   - サーバー(UTC)とクライアント(JST)で同じ結果を保証
   - `Asia/Tokyo`固定で±1日のズレを防止

2. **suppressHydrationWarningの適切な削除**
   - `<html>`と`<body>`から削除（将来の問題を検知可能に）
   - 根本的に差分が発生しない実装に変更

3. **監査レポート**
   - `snippet-manager/docs/audits/hydration_audit_20251117.md`
   - `snippet-manager/docs/audits/codex-hydration-audit-20251117.md`

### キャッシュが原因の場合
古いビルドがキャッシュされている可能性があります。

### 解決手順

#### 1. 開発サーバーの完全再起動

```bash
# 開発サーバーを停止（Ctrl+C）

# .nextフォルダを削除（ビルドキャッシュのクリア）
cd snippet-manager
rm -rf .next

# node_modulesも削除（念のため）
rm -rf node_modules
npm install

# 開発サーバーを再起動
npm run dev
```

#### 2. ブラウザのハードリロード

開発サーバー再起動後、ブラウザで以下を実行:

- **Windows/Linux**: `Ctrl + Shift + R`
- **Mac**: `Cmd + Shift + R`

または:
- DevTools（F12）を開く
- Networkタブを開く
- 「Disable cache」にチェックを入れる
- ページをリロード

#### 3. それでも解決しない場合

```bash
# ブランチが最新か確認
git status
git log --oneline -5

# 最新のコミットをプル
git pull origin claude/fix-react-error-418-015QkocdaNLrTBKBFaJjTZnJ

# 再度ビルドキャッシュをクリア
cd snippet-manager
rm -rf .next node_modules package-lock.json
npm install
npm run dev
```

#### 4. Vercelデプロイの場合

Vercelにデプロイしている場合:
1. Vercelダッシュボードで最新のデプロイを確認
2. 必要に応じて再デプロイ
3. `Redeploy` ボタンをクリック

### 確認事項

以下のファイルが最新のコードになっているか確認:

```bash
# EmailPreviewPane.tsxのisMounted確認
grep -A5 "isMounted" snippet-manager/components/email-composer/EmailPreviewPane.tsx

# EmailCodeEditor.tsxのpushEditOperations確認
grep -A10 "pushEditOperations" snippet-manager/components/email-composer/EmailCodeEditor.tsx

# DOMPurifyのインストール確認
grep "isomorphic-dompurify" snippet-manager/package.json
```

期待される出力:
- EmailPreviewPane.tsx: `const [isMounted, setIsMounted] = useState(false);` が存在
- EmailCodeEditor.tsx: `model.pushEditOperations` が存在
- package.json: `"isomorphic-dompurify": "^2.32.0"` が存在

### デバッグ方法

1. **コンソールエラーの確認**
   ```
   F12 → Console
   エラーメッセージ全体をコピー
   ```

2. **Reactコンポーネントツリーの確認**
   ```
   F12 → React DevTools
   EmailPreviewPane → Props → isMounted をチェック
   ```

3. **ネットワークタブの確認**
   ```
   F12 → Network
   _next/static/chunks/ のファイルが200 (from disk cache) でないことを確認
   ```

### 最終手段: クリーンビルド

```bash
# すべてをクリーンに
cd snippet-manager
rm -rf .next node_modules package-lock.json
git clean -fdx
npm install
npm run dev
```

---

## ドロップ機能の問題 （✅ 完全解決済み）

### 症状
- ドロップしてもコードに反映されない
- 意図しない位置に挿入される
- ドロップ後にスクロールして挿入位置が見えない
- 「行を指定してください」という警告が表示される

### ✅ 解決済み（2025-11-17）
これらの問題は**完全に解決済み**です。最新のコードでは以下の修正により、正確な位置にドロップできます：

1. **ドラッグカウンター方式** (`components/email-composer/EmailCodeEditor.tsx`)
   - オーバーレイの無限ループを防止
   - `pointer-events: none`でイベント干渉を防止

2. **ドラッグ中のカーソル位置保護**
   - ドラッグ中は`onDidChangeCursorPosition`を無視
   - 元のカーソル位置を確実に保持

3. **挿入位置の自動表示**
   - `editor.revealPositionInCenter()`で挿入位置を画面中央に表示
   - ドラッグ中にスクロールしても、挿入位置が見える

4. **カーソル位置バリデーション**
   - カーソル位置未指定時は警告を表示してドロップを拒否
   - ユーザーに適切なフィードバックを提供

### 使い方
1. エディタ内でクリックしてカーソル位置を指定
2. スニペットをドラッグ
3. エディタ上にドロップ
4. → カーソル位置に正確に挿入され、自動的に挿入位置が表示される

### キャッシュが原因の場合
古いビルドがキャッシュされている可能性があります（下記の手順を参照）。

---

## その他の一般的な問題

### Monaco Editorが表示されない

**解決**: `@monaco-editor/react` が正しくインストールされているか確認
```bash
npm list @monaco-editor/react
```

### DOMPurifyエラー

**解決**: isomorphic-dompurifyを再インストール
```bash
npm uninstall isomorphic-dompurify
npm install isomorphic-dompurify@^2.32.0
```

### TypeScriptエラー

**解決**: 型定義を再生成
```bash
npx tsc --noEmit
```

---

最終更新: 2025-11-17
