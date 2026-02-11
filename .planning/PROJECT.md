# ExponentHR Identity Migration

## What This Is

Migration of ExponentHR's proprietary authentication system to Microsoft Entra External ID. ExponentHR is an HR platform where client companies' employees log in to manage HR functions. The current system uses a custom-built auth service that issues custom tokens with a homegrown OTP-based MFA system. This project replaces that entire auth stack with an industry-standard identity platform, covering research, design, implementation, and deployment.

## Core Value

Users must be able to log in to ExponentHR with minimal disruption — existing username-based login must be preserved, users without email addresses must be fully supported, and the migration must not break access for 10,000-100,000 active users.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Users can log in with their existing username after migration
- [ ] Users without email addresses are fully supported (10-30% of user base)
- [ ] Username collision resolution for non-globally-unique usernames (two companies can have "jsmith")
- [ ] True MFA via SMS or email OTP replaces homegrown OTP system
- [ ] International phone numbers supported for MFA (Mexico/+52 confirmed)
- [ ] Single Entra identity maps to multiple employee records (HRA multi-company access)
- [ ] Post-login company/employee/environment selection (in-app switcher preserved)
- [ ] Password reset flow with SMS fallback for users without deliverable email
- [ ] Support tooling for troubleshooting login issues (scope needs discovery)
- [ ] Migration strategy comparison: JIT migration vs. pre-import via Graph API
- [ ] New user registration flow via Entra External ID
- [ ] Returning user login flow via Entra External ID
- [ ] Entra-themed login pages with ExponentHR branding
- [ ] Training and client communication plan
- [ ] Rollback plan if deployment fails

### Out of Scope

- Fully custom login UI — Entra-themed pages with branding are acceptable
- Mobile app authentication — web-first
- OAuth/social login providers — username + password is the primary path
- Rearchitecting ExponentHR's post-auth session management — in-app switcher stays as-is

## Context

**ExponentHR platform:**
- .NET Framework application (ASP.NET)
- Separate custom auth service that issues custom tokens
- Homegrown OTP-based MFA already in place — users are familiar with MFA flows
- Users identified by freeform text username + password
- Usernames are NOT globally unique — scoped per company (companyA/jsmith and companyB/jsmith can coexist)

**User model:**
- 10,000 - 100,000 user accounts to migrate
- 10-30% of users do not have a deliverable email address
- HRA role: super-admin users who manage HR across multiple subsidiary companies under a parent org
- Regular users belong to one company; HRA users access multiple companies via in-app switcher

**Migration strategy — key open question:**
Two strategies under consideration, both need thorough research:

*Strategy A: Pre-import via Microsoft Graph API*
- Batch import users into Entra before go-live
- Resolve username collisions beforehand (strategy TBD)
- Users do a forced password reset on first login (Entra cannot import custom password hashes)
- No email required during signup — accounts already exist
- Welcome email notifies users of new login process (and new username if changed)
- More controlled; requires upfront data work and collision resolution

*Strategy B: JIT Migration with Shadow Email*
- Bridge UI collects username/password from existing system on first login
- Generates a shadow email (e.g., `{unique_id}@exponenthr-auth.com`) behind the scenes
- Uses Entra custom authentication extensions (pre-attribute collection or post-attribute collection) to pre-populate the required email field so user never sees it
- For no-email users, force phone-only MFA via Conditional Access group policies
- More transparent to users, but works around Entra's email requirement during sign-up
- Key concern: Entra supports username sign-IN but not username sign-UP. Email is required at sign-up and may not be skippable even with custom auth extensions. This needs thorough research.

**Prior work:**
- Project originally started targeting Azure AD B2C, paused before implementation a year ago
- Prior design work exists (Miro user flows, requirements) — needs reassessment for Entra External ID
- Starting from scratch on Entra infrastructure (no B2C carried over)

**Entra External ID constraints (known):**
- Username sign-in supported; username sign-up is NOT — email is required for initial account creation
- Custom authentication extensions trigger at two points: pre-attribute collection and post-attribute collection
- Both extension points occur after the initial email submission — unclear if email can be bypassed
- This is the central technical question that determines migration strategy feasibility

## Constraints

- **Tech stack**: .NET Framework — integration must work with existing ASP.NET infrastructure
- **Timeline**: 90-day execution plan proposed (feasibility to be confirmed against team capacity)
- **Email dependency**: Cannot require users to have or check email for login; non-deliverable email on file for recovery is acceptable
- **Disruption**: Users should not feel like the rug was pulled out — migration must be as transparent as possible
- **Entra platform**: Must work within what Entra External ID supports; no forking or unsupported workarounds

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Entra External ID over Azure AD B2C | B2C is legacy; Entra External ID is the successor platform | -- Pending |
| Username collision resolution strategy | Usernames not globally unique; Entra needs unique identifiers | -- Pending |
| Migration strategy (JIT vs. pre-import) | Both have tradeoffs; research needed to determine feasibility | -- Pending |
| Rollout strategy (big bang vs. staged) | Staged reduces risk but adds complexity of running dual auth | -- Pending |
| Password reset required on first login (pre-import) | Entra cannot import custom password hashes | -- Pending |
| Entra-themed pages (not fully custom UI) | Acceptable tradeoff; reduces build effort | -- Pending |

---
*Last updated: 2026-02-11 after initialization*
