# CodePen Snippet Manager

CodePen-style HTML snippet management application with real-time preview and email composer functionality.

**Status**: Production-ready

## Features

- GitHub OAuth authentication
- CRUD operations for HTML snippets
- Monaco Editor with syntax highlighting
- Real-time HTML preview (sandboxed iframe)
- Auto-save with optimistic locking (3-second debounce)
- Category and tag management
- Grid/category view switching
- HTML email composer with drag & drop

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth (GitHub OAuth) |
| Editor | Monaco Editor |
| State | Zustand |
| Validation | Zod |
| Security | DOMPurify |

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

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Documentation

All documentation is organized in the `/docs` directory:

### Core Documentation

| Document | Description |
|----------|-------------|
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Development guide and setup |
| [codepen_html.md](docs/codepen_html.md) | Implementation spec (SSOT) |
| [IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) | Feature checklist and status |
| [architecture-diagram.md](docs/architecture-diagram.md) | System architecture (Mermaid) |

### Feature Documentation

| Document | Description |
|----------|-------------|
| [email-composer-spec.md](docs/email-composer-spec.md) | Email composer feature spec |
| [implementation_plan.md](docs/implementation_plan.md) | Phase-based implementation plan |

### Operations

| Document | Description |
|----------|-------------|
| [DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) | Supabase + Vercel deployment |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common issues and solutions |
| [audits/](docs/audits/) | Code audit reports |

### AI Assistant

| Document | Description |
|----------|-------------|
| [CLAUDE.md](CLAUDE.md) | Instructions for AI assistants |

## Project Structure

```
codepen-snippet-manager/
├── app/                    # Next.js App Router pages
│   ├── (dashboard)/        # Protected routes
│   ├── (public)/           # Public routes
│   └── auth/               # Auth callback
├── components/             # React components
│   ├── editor/             # Monaco editor components
│   ├── email-composer/     # Email composer components
│   └── snippets/           # Snippet management
├── docs/                   # Documentation (all docs here)
│   └── audits/             # Audit reports
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities and Supabase clients
├── store/                  # Zustand stores
├── types/                  # TypeScript types
├── CLAUDE.md               # AI assistant instructions
└── README.md               # This file
```

## Security

- XSS Prevention via DOMPurify (`lib/sanitize.ts`)
- iframe sandbox with `allow-scripts` only
- Content Security Policy (CSP)
- Row Level Security (RLS) at database level
- GitHub OAuth authentication

## License

MIT

---

Built with [Claude Code](https://claude.com/claude-code)
