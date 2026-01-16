# Hydration Mismatch リスク監査レポート

**日付**: 2025-11-17
**対象**: ブランチ `claude/fix-react-error-418-015QkocdaNLrTBKBFaJjTZnJ`
**レビュアー**: Codex
**監査タイプ**: Hydration mismatch クリティカルレビュー

---

## 1. 残存リスクの概要

### 🔴 1.1 `suppressHydrationWarning` で症状だけ隠している日付フォーマット
- **該当ファイル**: `snippet-manager/components/snippets/SnippetsList.tsx:103-137`, `snippet-manager/components/snippets/SnippetDetail.tsx:124-155`
- **問題**: どちらも `new Date(...).toLocaleDateString('ja-JP')` をクライアントコンポーネントのレンダー内で呼び出しており、タイムゾーンがサーバー(UTC)とクライアント(ユーザー環境)で異なる場合に文字列が変化する。今回の修正では親要素に `suppressHydrationWarning` を付けただけで、実際の DOM の差異やユーザーに見える日付のズレ（±1日の変動）は依然として発生する。
- **影響**: Hydration 直後に全カード/詳細ページの「作成日」「更新日」が書き換わり、React は警告を出さないため発見が困難。タイムゾーンの異なる環境にデプロイすると実際と異なる日付が表示され続ける。
- **推奨対応**:
  1. サーバーコンポーネント(`app/(dashboard)/snippets/page.tsx` など)で `Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo' }).format(new Date(...))` した結果文字列を props として渡し、クライアント側ではプレーンな文字列を描画するだけにする。
  2. もしくは共通ユーティリティで日付を UTC 固定でフォーマットし、クライアント・サーバー双方で同じ結果を保証する。`suppressHydrationWarning` は削除し、根本的に差分が出ない実装に切り替える。

### 🔴 1.2 `<html>` / `<body>` 全体を `suppressHydrationWarning` するのは危険
- **該当ファイル**: `snippet-manager/app/layout.tsx:24-34`
- **問題**: Hydration エラー #418 を抑制する目的で `<html>` と `<body>` に `suppressHydrationWarning` を付与しているが、React 公式ガイドラインではアプリ全体(巨大なサブツリー)に対してこの属性を使うことを推奨していない。これにより今後どんな Hydration mismatch が発生しても React が警告を出さず、根本原因を追跡できなくなる。
- **影響**: 実際の不整合（たとえば CSS クラスの違い、`next/font` の読み込み順、将来のステート初期化バグなど）がノイズごと無視され、本番で DOM が置き換わる挙動をユーザーが目撃しても監視やログには現れない。
- **推奨対応**:
  1. `<body>` / `<html>` ではなく問題の起きているごく限定的な要素に `suppressHydrationWarning` を付与する。
  2. ルートで warning を抑制しなくても一致するよう、`next/font` のクラスを SSR/CSR で揃える（最新の Next では追加設定不要なはずなので、むしろ suppress を外して実際に mismatch が解消されているか再確認すべき）。

### 🟠 1.3 `app/(public)/p/[id]/page.tsx` の日付も実際の日付差異は解消されない
- **該当ファイル**: `snippet-manager/app/(public)/p/[id]/page.tsx:20-38`
- **問題**: Server Component だが同様に `toLocaleDateString('ja-JP')` をその場で実行し、`suppressHydrationWarning` を後付けしただけ。Vercel Edge（UTC）でレンダリングすると JST から見て ±1日のズレが常態化し、Hydration は発生しない代わりに利用者へ誤情報を表示する。
- **推奨対応**: 上記 1.1 と同じく、固定タイムゾーンでフォーマットした文字列を生成し、そのまま描画する。Server Component なので `suppressHydrationWarning` 自体も不要になる。

---

## 2. 結論

- 現ブランチは React Error #418 の警告を「非表示」にしているだけで、サーバーとクライアントの結果が食い違う根本原因（タイムゾーン非固定の `toLocaleDateString`) を解決できていない。
- さらに `<html>` / `<body>` 全体を suppress したことで、今後別の Hydration mismatch が紛れ込んでも検知できない状態になっている。
- 本番投入前に上記3点を修正し、`suppressHydrationWarning` はホットフィックスではなく最小限の箇所でのみ使用する運用に戻すことを推奨する。
