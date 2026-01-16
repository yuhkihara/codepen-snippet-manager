# ドキュメント更新スキル

**スキル名**: `update-docs`

## 概要

実装・変更後に関連するすべてのドキュメントを更新し、ドキュメント間の整合性を確保します。

## 使用タイミング

### 必須実施タイミング

- **新機能実装後**: 関連ドキュメントをすべて更新
- **既存機能変更後**: 影響範囲のドキュメントを更新
- **バグ修正後**: 必要に応じてドキュメントを更新
- **コミット前**: ドキュメントが最新であることを確認

## 更新対象ドキュメント

| ドキュメント | 更新タイミング | 説明 |
|------------|--------------|------|
| `docs/codepen_html.md` | 機能追加・変更時 | 実装仕様書（SSOT） |
| `docs/IMPLEMENTATION_STATUS.md` | 各フェーズ完了時 | 実装状況チェックリスト |
| `docs/implementation_plan.md` | 計画変更時 | 実装計画書 |
| `docs/TROUBLESHOOTING.md` | 問題解決時 | トラブルシューティングガイド |
| `README.md` | 重要な変更時 | プロジェクトルート |
| `CLAUDE.md` | ルール変更時 | AI指示 |

## ファイル配置ルール

### ルート直下に配置可能

- `README.md` - プロジェクト概要
- `CLAUDE.md` - AI指示
- フレームワーク必須ファイル（package.json, next.config.js等）

### docs/に配置

- その他すべてのドキュメント
- 監査レポート（`docs/audits/`）

### 禁止事項

- ルート直下にREADME.md・CLAUDE.md以外のmdファイルを作成しない
- 一時的なmdファイルをコミットしない

## ドキュメント更新チェックリスト

- [ ] 関連するすべての`.md`ファイルを最新に更新した
- [ ] ドキュメント間の整合性を確認した
- [ ] `docs/IMPLEMENTATION_STATUS.md`を更新した
- [ ] ルート直下にREADME.md・CLAUDE.md以外のmdファイルがないことを確認した

## 使用例

```bash
/update-docs
/update-docs README.md
/update-docs docs/
```

## 関連ドキュメント

- [CLAUDE.md](../../CLAUDE.md)
- [docs/codepen_html.md](../../docs/codepen_html.md)
- [docs/IMPLEMENTATION_STATUS.md](../../docs/IMPLEMENTATION_STATUS.md)
