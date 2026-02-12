# ExponentHR Identity Admin

Internal support tooling for managing Entra External ID (Azure AD B2B) users. Part of the ExponentHR Identity Migration initiative — Phase 8 (Internal Tooling).

## Overview

This monorepo provides a complete solution for support agents to manage external partner users in Microsoft Entra ID:

- **SDK Package** (`packages/entra-sdk`) — TypeScript client for Microsoft Graph API covering users, MFA methods, groups, and sign-in logs
- **Admin UI** (`apps/admin-ui`) — Next.js 16 application with dark/light theme support, featuring user search, detail views, MFA management, and user lifecycle actions

## Architecture

```
├── packages/
│   └── entra-sdk/          # Graph API SDK (users, MFA, groups, sign-in logs)
├── apps/
│   └── admin-ui/           # Next.js 16 admin interface
│       ├── src/
│       │   ├── app/        # App router (pages, API routes, middleware)
│       │   ├── components/ # React components (ui/, app-header.tsx, etc.)
│       │   ├── lib/        # Auth, Entra client, utilities
│       │   └── actions/    # Server actions (users, mfa, sign-in-logs)
│       └── .env.example    # Environment template
```

## Tech Stack

- **Runtime**: Bun 1.0+
- **Framework**: Next.js 16 (Turbopack)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4, shadcn/ui
- **Authentication**: Better Auth with Microsoft OAuth
- **Database**: PostgreSQL (Better Auth sessions)
- **Fonts**: DM Sans, JetBrains Mono

## Brand Identity

- **Primary**: `#006480` (deep teal) — trust, precision, identity
- **Accent**: `#f8a603` (amber/gold) — ExponentHR brand mark
- **Aesthetic**: "Industrial Precision" — dark command center feel with complementary light mode

## Quick Start

### Prerequisites

- Bun 1.0 or later
- PostgreSQL database
- Microsoft Entra ID app registration (Web platform)

### Installation

```bash
# Install dependencies
bun install

# Configure environment
cp apps/admin-ui/.env.example apps/admin-ui/.env
# Edit .env with your credentials
```

### Environment Variables

```bash
# Database (PostgreSQL)
DATABASE_URL=postgresql://user:pass@localhost:5432/identity_admin

# Better Auth
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3000

# Microsoft OAuth
MICROSOFT_CLIENT_ID=your-app-id
MICROSOFT_CLIENT_SECRET=your-secret
MICROSOFT_TENANT_ID=your-tenant-id

# Entra SDK (Graph API)
ENTRA_CLIENT_ID=your-app-id
ENTRA_CLIENT_SECRET=your-secret
ENTRA_TENANT_ID=your-tenant-id
ENTRA_ISSUER_DOMAIN=yourtenant.onmicrosoft.com

# Optional: Deactivated users group
ENTRA_DEACTIVATED_GROUP_ID=uuid-for-deactivated-users
```

### Development

```bash
# Start dev server (Turbopack)
bun run dev

# Run checks
bun run lint
bun run typecheck

# Production build
bun run build
```

## Features

### User Management
- **Search**: Real-time search across display name, email, and department
- **Create User**: Form with generated passwords, group assignment, MFA requirements
- **User Detail**: Profile view with structured data grid
- **Lifecycle Actions**: Enable/disable, formal deactivation (group-based)
- **Password Reset**: Generate secure passwords with one-click copy

### MFA & Security
- View registered authentication methods (Microsoft Authenticator, FIDO2, Phone, etc.)
- Color-coded method cards with type-specific icons
- Sign-in activity logs with status indicators and error details

### UI/UX
- **Themes**: Dark (default) and light modes with next-themes
- **Design**: ExponentHR branded with industrial precision aesthetic
- **Accessibility**: Keyboard navigation, screen reader support, focus management
- **Responsive**: Works on desktop and tablet viewports

## API & SDK

The `entra-sdk` package exports:

```typescript
import { EntraSDK } from '@identity-migration/entra-sdk';

const entra = new EntraSDK({
  tenantId: process.env.ENTRA_TENANT_ID,
  clientId: process.env.ENTRA_CLIENT_ID,
  clientSecret: process.env.ENTRA_CLIENT_SECRET,
});

// Users
await entra.users.list({ $search: "john", $top: 20 });
await entra.users.create({ displayName: "...", userPrincipalName: "..." });
await entra.users.get(userId);
await entra.users.update(userId, { accountEnabled: false });

// MFA
await entra.mfa.listMethods(userId);
await entra.mfa.deleteMethod(userId, methodId);

// Groups
await entra.groups.list();
await entra.groups.addMember(groupId, userId);

// Sign-in logs
await entra.signInLogs.list({ $filter: "userId eq '...'", $top: 50 });
```

See `packages/entra-sdk/src/types/index.ts` for full type definitions.

## Authentication Flow

1. User clicks "Sign in with Microsoft" on `/login`
2. Better Auth initiates OAuth with Microsoft Identity Platform
3. Callback handled at `/api/auth/callback/microsoft`
4. Session cookie created (Better Auth + PostgreSQL)
5. Middleware protects dashboard routes (`/users/*`)

**Required Azure AD App Registration Settings:**
- Platform: **Web** (not SPA)
- Redirect URI: `http://localhost:3000/api/auth/callback/microsoft`
- "Allow public client flows": **No**
- Required permissions: `User.Read.All`, `Directory.Read.All`, `AuditLog.Read.All`

## Deployment

### Build

```bash
bun run build
```

Output is in `apps/admin-ui/.next/`. Configure your hosting platform (Vercel, Docker, etc.) to:
1. Run `bun install`
2. Run `bun run build`
3. Start with `bun run start` (or configure `next start`)

### Environment Notes

- Production requires HTTPS for OAuth callbacks
- Set `BETTER_AUTH_URL` to your production domain
- Ensure PostgreSQL is accessible from the deployment environment

## Roadmap Context

This is **Phase 8** of the ExponentHR Identity Migration:

| Phase | Description | Status |
|-------|-------------|--------|
| 1-7 | Identity strategy, migration planning, infrastructure | Complete |
| **8** | **Internal Tooling** (this repo) | **In Progress** |
| 9 | Partner onboarding automation | Planned |
| 10 | Security audit & hardening | Planned |

## License

Internal use only — ExponentHR proprietary software.

## Support

For issues or questions, contact the Identity Migration team or file an issue in the project tracker.
