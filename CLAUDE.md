# CLAUDE.md - CodePen Snippet Manager

This file provides AI assistants with project context and rules.

## Project Overview

CodePen-style HTML snippet management application built with Next.js 15, Supabase, and Monaco Editor.

**Current Status**: Production-ready (all core features implemented)

## Tech Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL + RLS)
- **Authentication**: Supabase Auth (GitHub OAuth)
- **Editor**: Monaco Editor
- **State Management**: Zustand
- **Validation**: Zod
- **Security**: DOMPurify (isomorphic-dompurify)

## Documentation Rules

### File Location Rules (STRICT)

**Root directory (`/`) may only contain:**
- `README.md` - Project overview and quick start
- `CLAUDE.md` - This file (AI assistant instructions)

**All other documentation MUST be in `/docs`:**
- Technical specifications
- Implementation guides
- Architecture diagrams
- Troubleshooting guides
- Audit reports (in `/docs/audits/`)

**No exceptions allowed.** If you create new documentation, place it in `/docs`.

### Documentation Structure

```
/
├── README.md              # Entry point, links to /docs
├── CLAUDE.md              # AI assistant instructions (this file)
└── docs/
    ├── DEVELOPMENT.md     # Development guide
    ├── DEPLOYMENT_GUIDE.md # Deployment instructions
    ├── IMPLEMENTATION_STATUS.md # Implementation checklist
    ├── TROUBLESHOOTING.md # Problem resolution
    ├── architecture-diagram.md # System architecture (Mermaid)
    ├── codepen_html.md    # Main spec (SSOT)
    ├── email-composer-spec.md # Email composer feature
    ├── implementation_plan.md # Phase-based plan
    └── audits/            # Code audit reports
```

### Single Source of Truth (SSOT)

- `docs/codepen_html.md` is the SSOT for implementation specifications
- Other docs should reference it, not duplicate information
- When updating specs, update `codepen_html.md` first

## Key Implementation Details

### Security

1. **XSS Prevention**: All HTML rendering uses `sanitizeHTML()` from `lib/sanitize.ts`
2. **iframe Sandbox**: Preview uses `sandbox="allow-scripts"` only
3. **CSP**: Content Security Policy configured in `next.config.js`
4. **RLS**: Row Level Security enforced at database level

### Hydration Error Prevention

- Date formatting uses `lib/formatDate.ts` with fixed timezone (`Asia/Tokyo`)
- Never use `toLocaleDateString()` directly in render
- Use `formatDate()`, `formatDateLong()`, or `formatDateTime()` utilities

### Monaco Editor Drag & Drop

- Drag counter method prevents infinite loops
- `pointer-events: none` on overlays
- Cursor position protection during drag
- Auto-scroll to insertion point after drop

## Commands

```bash
# Development
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run lint         # Run ESLint

# Deployment
vercel login         # Login to Vercel CLI
vercel link          # Link project to Vercel
vercel --prod        # Deploy to production
```

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Code Style

- TypeScript strict mode
- Documentation/JSDoc in English
- Code comments explaining reasoning in Japanese
- No emojis in code or documentation (unless explicitly requested)

## Key Files

| File | Purpose |
|------|---------|
| `lib/sanitize.ts` | HTML sanitization (DOMPurify) |
| `lib/formatDate.ts` | Timezone-fixed date formatting |
| `lib/optimistic-lock.ts` | Conflict detection for auto-save |
| `store/editorStore.ts` | Editor state (Zustand) |
| `store/emailComposerStore.ts` | Email composer state |
| `middleware.ts` | Auth protection |

## Related Documentation

- [README.md](README.md) - Project overview
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) - Development guide
- [docs/codepen_html.md](docs/codepen_html.md) - Implementation spec (SSOT)
- [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) - Current status

---

**Last Updated**: 2026-01-17
