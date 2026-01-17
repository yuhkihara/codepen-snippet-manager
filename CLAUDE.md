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

## File Location Rules (STRICT)

### Root Directory Structure

Root (`/`) contains only essential files required by frameworks/tools:

| File | Required By | Purpose |
|------|-------------|---------|
| `README.md` | - | Project overview (user-facing) |
| `CLAUDE.md` | - | AI assistant instructions |
| `package.json` | npm | Dependencies |
| `package-lock.json` | npm | Lock file |
| `next.config.js` | Next.js | Framework config |
| `tsconfig.json` | TypeScript | TS config |
| `tailwind.config.ts` | Tailwind | Styling config |
| `postcss.config.js` | PostCSS | CSS processing |
| `middleware.ts` | Next.js | Auth middleware |
| `.eslintrc.json` | ESLint | Linting rules |
| `.gitignore` | Git | Ignore patterns |
| `.env.local.example` | - | Env template |

**DO NOT add new files to root.** Place them in appropriate directories.

### Documentation Rules

**All documentation MUST be in `/docs`:**
- Technical specifications
- Implementation guides
- Architecture diagrams
- Troubleshooting guides
- Audit reports (in `/docs/audits/`)

**No exceptions.** New documentation goes in `/docs`.

### Complete Project Structure

```
/
├── README.md                 # Project overview
├── CLAUDE.md                 # AI instructions (this file)
├── package.json              # npm (required at root)
├── package-lock.json         # npm (required at root)
├── next.config.js            # Next.js (required at root)
├── tsconfig.json             # TypeScript (required at root)
├── tailwind.config.ts        # Tailwind (required at root)
├── postcss.config.js         # PostCSS (required at root)
├── middleware.ts             # Next.js auth (required at root)
├── .eslintrc.json            # ESLint (required at root)
├── .gitignore                # Git (required at root)
├── .env.local.example        # Env template
├── app/                      # Next.js App Router pages
├── components/               # React components
├── docs/                     # All documentation
│   ├── DEVELOPMENT.md
│   ├── DEPLOYMENT_GUIDE.md
│   ├── IMPLEMENTATION_STATUS.md
│   ├── TROUBLESHOOTING.md
│   ├── architecture-diagram.md
│   ├── codepen_html.md       # SSOT
│   ├── email-composer-spec.md
│   ├── implementation_plan.md
│   └── audits/               # Audit reports
├── hooks/                    # Custom React hooks
├── lib/                      # Utilities
├── public/                   # Static assets
├── store/                    # Zustand stores
└── types/                    # TypeScript types
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

## Available Skills

Skills are located in `.claude/skills/`:

| Skill | Command | Purpose |
|-------|---------|---------|
| [update-docs](.claude/skills/update-docs.skill.md) | `/update-docs` | Update all documentation after changes |
| [design-review](.claude/skills/design-review.skill.md) | `/design-review` | Review UI for "AI Slop" aesthetics |
| [check-spec](.claude/skills/check-spec.skill.md) | `/check-spec` | Verify implementation against spec |
| [audit](.claude/skills/audit.skill.md) | `/audit` | Comprehensive code audit |
| [test-pages](.claude/skills/test-pages.skill.md) | - | Test pages for local development (e.g., `/test/composer`) |

### Usage

```bash
/update-docs          # Update docs after implementation
/design-review        # Review UI design
/check-spec           # Check against codepen_html.md
/audit                # Run code audit
```

## Related Documentation

- [README.md](README.md) - Project overview
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) - Development guide
- [docs/codepen_html.md](docs/codepen_html.md) - Implementation spec (SSOT)
- [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) - Current status

---

**Last Updated**: 2026-01-17
