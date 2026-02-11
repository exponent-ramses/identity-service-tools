# Roadmap: ExponentHR Identity Migration

## Overview

This project migrates ExponentHR's proprietary authentication system to Microsoft Entra External ID for 10,000–100,000 users. The roadmap starts by establishing the Entra platform and validating the riskiest technical unknown (can our .NET Framework app talk to Entra?), then develops both migration strategies (Pre-Import and JIT) in parallel so executives can make an informed choice, then builds the authentication integration, MFA, and password recovery capabilities, and finally rolls out company-by-company with monitoring, rollback, and support tooling.

Every phase is structured to deliver something verifiable — a working proof-of-concept, a strategy comparison document, a complete migration pipeline, or a production cutover. Phases are ordered so that each one unblocks the next and no work is thrown away regardless of which migration strategy is chosen.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Platform Foundation** — Stand up the Entra External ID platform, validate the highest-risk technical unknown, and confirm we can proceed
- [ ] **Phase 2: Strategy Comparison** — Research, document, and present both migration strategies so executives can choose the right path
- [ ] **Phase 3: Pre-Import Migration Pipeline** — Build the tooling to batch-create all user accounts in Entra before go-live
- [ ] **Phase 4: JIT Migration Pipeline** — Build the real-time account creation system that silently migrates users during their first login
- [ ] **Phase 5: Authentication Integration** — Connect ExponentHR to Entra so the app understands who logged in and what they can access
- [ ] **Phase 6: MFA & Password Recovery** — Replace the homegrown OTP system with Entra's built-in MFA, and ensure every user can recover a forgotten password
- [ ] **Phase 7: Post-Auth & HRA Experience** — Verify that everything users do after login — company switching, multi-company access — works exactly as it does today
- [ ] **Phase 8: Support & Operations Tooling** — Give the support team the tools they need to help users and the operations team visibility into system health
- [ ] **Phase 9: Staged Rollout** — Migrate companies one at a time, run both auth systems in parallel, and observe before expanding
- [ ] **Phase 10: Legacy Decommission & Hardening** — Shut down the old auth system company-by-company after confirming the new system is stable

## Phase Details

### Phase 1: Platform Foundation
**Goal**: The Entra External ID platform is live, configured, and proven to work with ExponentHR's .NET Framework application — establishing the go/no-go gate for the entire project.
> *Why this phase exists:* Nothing can be built until the identity platform is standing. More importantly, the single highest-risk technical unknown — whether ExponentHR's older .NET Framework can connect to Entra at all — must be answered in week 1 before any other investment is made. If this fails, the entire approach needs rethinking.
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05
**Success Criteria** (what must be TRUE):
  1. A test user can sign in to a proof-of-concept ASP.NET Framework application using Entra External ID, completing the full redirect → authenticate → receive token flow
  2. The shadow email domain (exponenthr-auth.com) resolves correctly in DNS with SPF/DKIM/DMARC records, and a test account using a shadow email exists in Entra without triggering deliverability warnings
  3. A test user can sign in using a username (not email) as their primary identifier on the Entra login page
  4. ExponentHR's .NET Framework version is confirmed as 4.7.2+ (or an upgrade path is documented if not)
  5. The Entra tenant has a registered application, a configured user flow, and domain verification is complete
**Plans**: TBD

Plans:
- [ ] 01-01: Entra tenant setup, app registration, and domain verification
- [ ] 01-02: Shadow email domain registration and DNS configuration
- [ ] 01-03: Username sign-in identifier enablement and validation
- [ ] 01-04: .NET Framework version verification and OWIN OIDC proof-of-concept spike (go/no-go gate)

### Phase 2: Strategy Comparison
**Goal**: Executives have a clear, side-by-side comparison of both migration strategies — with architecture details, risk assessments, timelines, and cost implications — and a decision is captured so the team builds the right thing.
> *Why this phase exists:* Two fundamentally different approaches exist for moving users to Entra (batch-import-ahead-of-time vs. migrate-on-first-login). Each has different risk profiles, costs, and user experience tradeoffs. Leadership needs to choose a path before development begins. This phase produces the decision document, not code.
**Depends on**: Phase 1 (platform must be validated before strategies can be evaluated against real constraints)
**Requirements**: STRAT-01, STRAT-02, STRAT-03, STRAT-04
**Success Criteria** (what must be TRUE):
  1. Both JIT and pre-import strategies are documented with architecture diagrams, data flow descriptions, implementation steps, pros/cons, risk assessments, and estimated timelines
  2. The username collision resolution strategy is defined (how "jsmith" at two companies becomes two unique accounts) with a communication plan for affected users
  3. A comparison presentation has been delivered to executives with clear business-language pros/cons for each approach
  4. The executive decision on migration strategy is documented with rationale, and the team knows which path to build
**Plans**: TBD

Plans:
- [ ] 02-01: Architecture and data flow documentation for both strategies
- [ ] 02-02: Username collision resolution strategy design
- [ ] 02-03: Risk, timeline, and cost comparison document for executive review
- [ ] 02-04: Executive presentation and decision capture

### Phase 3: Pre-Import Migration Pipeline
**Goal**: A complete, tested pipeline exists that can batch-create all 10,000–100,000 user accounts in Entra before go-live — including collision resolution, shadow email generation, and user communication.
> *Why this phase exists:* The pre-import approach creates all accounts in Entra ahead of time using Microsoft's management API. This requires tooling to scan for username conflicts, generate synthetic emails for users without real ones, import users at scale while respecting Microsoft's rate limits, and notify users that their login process is changing. Without this pipeline, there's no way to get users into the new system before flipping the switch.
**Depends on**: Phase 1 (Entra platform), Phase 2 (collision resolution strategy decided)
**Requirements**: IMPT-01, IMPT-02, IMPT-03, IMPT-04, IMPT-05
**Success Criteria** (what must be TRUE):
  1. The collision analysis tool produces a report showing every duplicate username across all companies, with the proposed resolution for each conflict
  2. Shadow emails are generated for all users without deliverable email in the format {uniqueId}@exponenthr-auth.com, and test accounts using these shadow emails are successfully created in Entra
  3. The batch import tool can create 1,000+ user accounts in Entra in a single run, with rate limiting, automatic retry on failure, and safe re-run if interrupted
  4. Imported test accounts are configured to require a new password on first login — and a test user successfully completes the forced password reset flow
  5. Welcome communications (email for email users, in-app notification for no-email users) are drafted and ready to send, explaining the new login process and any username changes
**Plans**: TBD

Plans:
- [ ] 03-01: Username collision analysis tool
- [ ] 03-02: Shadow email generation and user data preparation
- [ ] 03-03: Graph API batch import tool with rate limiting and retry logic
- [ ] 03-04: Forced password reset configuration and welcome communication preparation

### Phase 4: JIT Migration Pipeline
**Goal**: A complete, tested pipeline exists that can silently create a user's Entra account during their first login — verifying their existing credentials, generating a shadow email, and making the transition invisible.
> *Why this phase exists:* The JIT (Just-In-Time) approach migrates users one at a time during their first login attempt. Instead of creating accounts ahead of time, it intercepts the login, verifies the user's existing credentials against the old system, and creates their Entra account behind the scenes. This is more transparent to users (they don't need to set a new password) but technically more complex. Building this pipeline ensures the JIT option is fully evaluated and available.
**Depends on**: Phase 1 (Entra platform), Phase 2 (strategy decision — may be built to less depth if not selected)
**Requirements**: JIT-01, JIT-02, JIT-03, JIT-04, JIT-05
**Success Criteria** (what must be TRUE):
  1. A bridge UI captures the user's existing username and password, validates them against the legacy auth system, and proceeds to Entra account creation without the user seeing a "create account" screen
  2. A shadow email is automatically generated and injected into Entra's sign-up flow via a custom authentication extension — the user never sees an email field
  3. A test user's Entra account is created transparently during their first login — from the user's perspective, they simply logged in
  4. The custom authentication extension (Azure Function) runs on a dedicated hosting plan and responds within Microsoft's 2-second timeout requirement under load
  5. When JIT account creation fails for a specific user, they see a clear fallback message directing them to contact support for admin-assisted account creation
**Plans**: TBD

Plans:
- [ ] 04-01: Bridge UI for legacy credential collection and validation
- [ ] 04-02: Shadow email injection via custom authentication extension
- [ ] 04-03: Transparent account creation flow (end-to-end JIT path)
- [ ] 04-04: Azure Function hosting, performance tuning, and fallback path

### Phase 5: Authentication Integration
**Goal**: ExponentHR connects to Entra External ID for login, understands who the user is, and translates Entra's identity tokens into ExponentHR's existing internal format — so the rest of the application works without changes.
> *Why this phase exists:* Entra handles the login, but ExponentHR still needs to understand who logged in. This phase builds the bridge: ExponentHR redirects users to Entra for authentication, receives a secure token back, and translates that token into the format ExponentHR's internal systems already expect. Without this, Entra could authenticate users perfectly but ExponentHR wouldn't know what to do with the result. The login pages also need to look like ExponentHR, not a generic Microsoft page.
**Depends on**: Phase 1 (OIDC spike validates approach), Phase 2 (strategy decision informs token enrichment needs)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. ExponentHR redirects users to Entra for login and correctly receives identity tokens back via OIDC — the full login redirect flow works end-to-end
  2. The adapter layer translates Entra tokens into ExponentHR's existing internal session format — downstream systems (permissions, menus, data access) work without modification
  3. The Entra login page displays ExponentHR branding (logo, colors, background) — users recognize it as ExponentHR, not a generic Microsoft page
  4. Login tokens include ExponentHR-specific data (company IDs, employee record mappings, HRA status) added by a custom server-side function — ExponentHR knows what the user can access immediately after login
**Plans**: TBD

Plans:
- [ ] 05-01: OWIN OIDC middleware integration in ExponentHR
- [ ] 05-02: Auth Service Adapter (strangler fig) — Entra tokens to internal session format
- [ ] 05-03: Entra login page branding and customization
- [ ] 05-04: Token enrichment Azure Function (OnTokenIssuanceStart) with ExponentHR claims

### Phase 6: MFA & Password Recovery
**Goal**: Every user has a second layer of login security (text message or email code) and every user — including the 10–30% without email — has a way to recover a forgotten password.
> *Why this phase exists:* MFA (multi-factor authentication) is a security requirement — users must verify their identity with their phone or email in addition to their password. This replaces ExponentHR's homegrown OTP system with Microsoft's built-in MFA. Separately, users need a way to reset forgotten passwords. Users with email get Entra's built-in "forgot password" flow. Users without email need alternative paths — admin-assisted reset immediately, with a self-service SMS reset as a custom-built solution for long-term scalability.
**Depends on**: Phase 1 (Entra tenant configured), Phase 5 (authentication integration working)
**Requirements**: MFA-01, MFA-02, MFA-03, MFA-04, PWRC-01, PWRC-02, PWRC-03
**Success Criteria** (what must be TRUE):
  1. A user logging in is prompted for a one-time code via SMS text message as a second factor, enforced by Conditional Access policy
  2. A user with an email address can choose email-based one-time code as their second factor
  3. A user in Mexico (+52 country code) successfully receives an SMS MFA code and completes login
  4. A user without email is assigned to a security group that only offers phone-based MFA — they are never prompted for email-based MFA
  5. A user with email can reset their own forgotten password through Entra's built-in self-service flow, and a support agent can reset any user's password through Microsoft's management API. A no-email user can reset their own password by verifying their identity via SMS.
**Plans**: TBD

Plans:
- [ ] 06-01: SMS and email MFA configuration via Conditional Access
- [ ] 06-02: International phone number support and no-email user MFA group policies
- [ ] 06-03: Self-service password reset (email) and admin-assisted password reset (Graph API)
- [ ] 06-04: Custom SMS-based password reset flow for no-email users

### Phase 7: Post-Auth & HRA Experience
**Goal**: After login, the user experience is identical to today — company switching works, HRA users can access all their subsidiary companies, and no post-login workflows are disrupted.
> *Why this phase exists:* Authentication is only half the problem. After users log in, they interact with ExponentHR's company/employee/environment switcher and HRA multi-company access. These features must work exactly as they do today. If the migration breaks the ability for an HR administrator to switch between subsidiary companies, it's a critical workflow failure regardless of how well the login page works.
**Depends on**: Phase 5 (auth integration delivers tokens with company/HRA data)
**Requirements**: POST-01, POST-02
**Success Criteria** (what must be TRUE):
  1. After logging in through Entra, a regular user sees and uses the existing company/employee/environment switcher identically to how it works today — no visible changes to post-login UX
  2. An HRA user logs in once with a single Entra identity and can switch between all subsidiary companies they manage — the mapping between one Entra identity and multiple employee records works correctly
**Plans**: TBD

Plans:
- [ ] 07-01: In-app switcher validation with Entra-authenticated sessions
- [ ] 07-02: HRA multi-company identity mapping and end-to-end testing

### Phase 8: Support & Operations Tooling
**Goal**: The support team can troubleshoot and resolve login issues without accessing Microsoft's admin portal, and the operations team has automated monitoring that catches problems before users report them.
> *Why this phase exists:* After migration, user accounts live in Entra instead of ExponentHR's internal system. The support team needs new tools to search for users, reset passwords, clear MFA enrollments (when someone gets a new phone), and disable compromised accounts. Without these tools, support would need direct access to the Microsoft admin portal — a security risk and training burden. Separately, operations needs monitoring to detect login failures, system slowdowns, and low MFA enrollment rates before they become support ticket floods.
**Depends on**: Phase 5 (auth integration), Phase 6 (MFA/password features to manage)
**Requirements**: SUPP-02, SUPP-03
**Success Criteria** (what must be TRUE):
  1. A support agent can look up a user by username, reset their password, clear their MFA enrollment, and enable/disable their account — all through an internal admin tool without touching the Microsoft portal
  2. A dashboard or alert system tracks sign-in success/failure rates, token issuance latency, and MFA enrollment rates, with automated alerts when metrics exceed thresholds
**Plans**: TBD

Plans:
- [ ] 08-01: Support admin tooling (user lookup, password reset, MFA reset, account management via Graph API)
- [ ] 08-02: Monitoring, sign-in log analysis, and alerting configuration

### Phase 9: Staged Rollout
**Goal**: Companies are migrated one at a time with both auth systems running in parallel, a repeatable cutover process, and a tested rollback plan — so any issues affect only a small number of users.
> *Why this phase exists:* Migrating all 10,000–100,000 users at once means if anything goes wrong, everyone is affected. A staged rollout — starting with 1–2 low-risk companies, then expanding — limits the blast radius. Both auth systems (old and new) must run simultaneously during the transition. The cutover process (switch this company from old auth to new auth) must be documented, repeatable, and reversible within minutes.
**Depends on**: Phase 3 or Phase 4 (migration pipeline for chosen strategy), Phase 5 (auth integration), Phase 6 (MFA), Phase 7 (post-auth), Phase 8 (monitoring)
**Requirements**: SUPP-01, ROLL-01, ROLL-02, ROLL-03
**Success Criteria** (what must be TRUE):
  1. A pilot company is migrated to Entra auth and their users can log in, complete MFA, switch companies, and perform all normal workflows through the new system
  2. Both legacy auth and Entra auth run simultaneously — users at migrated companies use Entra while users at non-migrated companies continue using legacy auth without disruption
  3. The per-company cutover process is documented step-by-step and has been executed at least twice (pilot + one additional company) with consistent results
  4. If a critical issue arises after cutover, the rollback plan reverts a company to legacy auth within minutes — and this has been tested in a staging environment
**Plans**: TBD

Plans:
- [ ] 09-01: Dual-auth routing infrastructure (legacy + Entra side-by-side)
- [ ] 09-02: Per-company cutover process documentation and pilot execution
- [ ] 09-03: Rollback plan development and staging validation
- [ ] 09-04: Pilot expansion — second and third company cutovers with observation

### Phase 10: Legacy Decommission & Hardening
**Goal**: The old authentication system is shut down company-by-company after a 7+ day observation period confirms the new system is stable — completing the migration.
> *Why this phase exists:* The migration isn't truly complete until the old auth system is turned off. But turning it off prematurely risks locking users out if undiscovered issues exist. Each company gets at least 7 days on the new system before their legacy auth is decommissioned. This phase also covers expanding the rollout to all remaining companies using the proven cutover process.
**Depends on**: Phase 9 (staged rollout proven successful)
**Requirements**: ROLL-04
**Success Criteria** (what must be TRUE):
  1. Legacy auth for each migrated company is decommissioned only after a 7+ day observation period with no critical issues — and decommission has been executed for at least the pilot companies
  2. All companies are migrated to Entra auth and the legacy auth system is fully offline
**Plans**: TBD

Plans:
- [ ] 10-01: Observation period criteria and legacy auth decommission process
- [ ] 10-02: Full rollout — remaining company cutovers and legacy decommission

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

**Parallelization Notes:**
- Phases 3 and 4 can be developed in parallel after Phase 2 (both migration strategies)
- Phase 5 can begin in parallel with Phases 3/4 (auth integration is strategy-independent)
- Phases 6 and 7 can overlap once Phase 5 is underway
- Phase 8 can begin once Phase 5 delivers basic auth flow

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Platform Foundation | 0/4 | Not started | - |
| 2. Strategy Comparison | 0/4 | Not started | - |
| 3. Pre-Import Migration Pipeline | 0/4 | Not started | - |
| 4. JIT Migration Pipeline | 0/4 | Not started | - |
| 5. Authentication Integration | 0/4 | Not started | - |
| 6. MFA & Password Recovery | 0/4 | Not started | - |
| 7. Post-Auth & HRA Experience | 0/2 | Not started | - |
| 8. Support & Operations Tooling | 0/2 | Not started | - |
| 9. Staged Rollout | 0/4 | Not started | - |
| 10. Legacy Decommission & Hardening | 0/2 | Not started | - |
