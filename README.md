# CodePen Snippet Manager

CodePen風のHTMLスニペット管理アプリケーション

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (GitHub OAuth)
- **Editor**: Monaco Editor
- **State Management**: Zustand
- **Deployment**: Vercel

## Features

- ✅ GitHub認証ログイン/ログアウト
- ✅ スニペットのCRUD操作
- ✅ Monaco Editorによるコード編集
- ✅ リアルタイムHTMLプレビュー
- ✅ 自動保存機能
- ✅ カテゴリ・タグ管理
- ✅ グリッド/カテゴリ別表示切り替え
- ✅ HTMLメールコンポーザー

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Create `.env.local` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Documentation

- [DEVELOPMENT.md](DEVELOPMENT.md) - Development guide
- [docs/codepen_html.md](docs/codepen_html.md) - Implementation spec (SSOT)
- [docs/email-composer-spec.md](docs/email-composer-spec.md) - Email composer spec
- [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) - Deployment guide

## License

MIT

---

Built with [Claude Code](https://claude.com/claude-code)
