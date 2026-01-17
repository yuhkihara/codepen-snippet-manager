# Test Pages Skill

## Overview

This skill provides information about test pages available in the project for development and testing purposes.

## Available Test Pages

### Email Composer Test Page

**URL**: `http://localhost:3000/test/composer` (or port 3001 if 3000 is in use)

**File**: `app/test/composer/page.tsx`

**Purpose**: Integration test page for the Email Composer feature. This page does NOT require Supabase authentication, making it ideal for local development and testing.

**Features**:
- Visual Editor + Monaco Editor with real-time sync
- Mock snippets for drag & drop testing
- No database connection required

### Other Test Pages

| Path | File | Description |
|------|------|-------------|
| `/test` | `app/test/page.tsx` | Main test index page |
| `/test/poc` | `app/test/poc/page.tsx` | Proof of concept page |
| `/test/poc/v2` | `app/test/poc/v2/page.tsx` | POC version 2 |

## Usage

When developing features that would normally require Supabase authentication, use the test pages instead:

```bash
# Start dev server
npm run dev

# Access test page (no auth required)
open http://localhost:3000/test/composer
```

## When to Use

- Testing Email Composer functionality without Supabase setup
- Quick iteration on UI changes
- Debugging visual editor or code editor issues
- Testing drag & drop functionality with mock data

## Notes

- Test pages use mock data, not real database records
- Changes made in test pages are not persisted
- Port may be 3001 if 3000 is already in use
