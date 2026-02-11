# Requirements: ExponentHR Identity Migration

**Defined:** 2026-02-11
**Core Value:** Users must be able to log in to ExponentHR with minimal disruption — existing username-based login preserved, no-email users fully supported, and migration must not break access for 10,000-100,000 active users.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases. Every requirement includes context on *why* it's necessary and *what problem it solves*.

### Foundation

These are the infrastructure prerequisites. Nothing else can be built until these are in place — they establish the new identity platform and validate that it works with our existing technology.

- [ ] **FOUND-01**: Entra External ID tenant is created with app registration and domain verification
  > *Why:* The tenant is Microsoft's identity platform — it's where all user accounts will live after migration. The app registration tells Entra that ExponentHR is authorized to use it for login. Domain verification proves we own our domain. Without this, there's no platform to migrate to.

- [ ] **FOUND-02**: Shadow email domain is registered and DNS-configured (SPF/DKIM/DMARC) so shadow emails don't cause deliverability or security issues
  > *Why:* Microsoft Entra requires every user account to have an email address — this is a platform limitation we cannot change. For the 10-30% of our users who don't have email addresses, we create "shadow emails" — synthetic addresses like `user123@exponenthr-auth.com` that are never shown to the user and never used to send mail. We must own this domain and configure its DNS records properly so that (a) no one else can register it and intercept password resets, and (b) the email addresses don't get flagged as spam by Microsoft's internal systems.

- [ ] **FOUND-03**: Username sign-in identifier (preview) is enabled so users can sign in with usernames instead of email
  > *Why:* Our users log in with usernames today (e.g., "jsmith"), not email addresses. Microsoft Entra recently added a preview feature that lets users sign in with a username. Without this, users would be forced to remember and type an email address instead of their familiar username — a significant disruption to their daily workflow.

- [ ] **FOUND-04**: ExponentHR's login integration with Entra External ID is validated via a proof-of-concept spike (go/no-go gate)
  > *Why:* ExponentHR runs on .NET Framework, an older Microsoft web platform. The way ExponentHR connects to Entra is through a standard login protocol called OIDC (OpenID Connect) — essentially, ExponentHR says "go log in over there" and Entra sends back proof of who the user is. The specific software that handles this handshake is called OWIN middleware — it's the bridge between ExponentHR and Entra. **No official Microsoft example exists for this exact combination.** We need to build a small proof-of-concept in week 1 to confirm it works before investing in the rest of the project. If this fails, the entire integration approach needs to be rethought. This is the single highest-risk technical unknown.

- [ ] **FOUND-05**: ExponentHR .NET Framework version is verified as 4.7.2+ (required for Entra integration libraries)
  > *Why:* The Microsoft libraries that connect ExponentHR to Entra require .NET Framework version 4.7.2 or higher. If ExponentHR runs on an older version, a framework upgrade must happen first — adding time and risk to the project. This must be confirmed on day one.

### Migration Strategy Comparison

The core deliverable for executive decision-making. Two fundamentally different approaches exist for moving users from our current system to Entra, and leadership needs to choose which path to take.

- [ ] **STRAT-01**: Both JIT migration and pre-import via Graph API strategies are documented with architecture, data flows, and implementation details
  > *Why:* **Pre-import** means we create all user accounts in Entra ahead of time using Microsoft's management API (Graph API), then flip the switch. Users arrive at a new login page, enter their username, and set a new password. **JIT (Just-In-Time) migration** means we intercept users' first login attempt, verify their existing credentials, and silently create their Entra account behind the scenes — the user barely notices anything changed. Each approach has fundamentally different risk profiles, timelines, and costs. Both need to be fully documented so leadership can make an informed decision.

- [ ] **STRAT-02**: Username collision resolution strategy is defined and documented
  > *Why:* Today, usernames are unique only within each company. CompanyA can have "jsmith" and CompanyB can also have "jsmith" — they're different people. In Entra, every username must be globally unique across all companies. We need a strategy for resolving these conflicts (e.g., appending a company code: "acme_jsmith") and a plan for communicating any username changes to affected users. This decision affects the user experience and must be made before any migration work begins.

- [ ] **STRAT-03**: Migration strategy comparison is presented to executives with pros/cons, risk assessment, timeline, and cost implications for both approaches
  > *Why:* The choice between pre-import and JIT affects project timeline, cost, risk, and user experience. Executives need a clear comparison — not just technical details, but business implications — to make the right call.

- [ ] **STRAT-04**: Executive decision on migration strategy is captured and documented
  > *Why:* Once leadership chooses a strategy, the decision must be recorded to prevent scope churn and ensure the team builds the right thing. This also provides a reference point if the approach needs to be revisited.

### User Migration (Pre-Import Strategy)

This path creates all user accounts in Entra before go-live. It's more controlled and predictable, but users must set a new password on their first login.

- [ ] **IMPT-01**: Username collision analysis tool identifies all duplicate usernames across companies
  > *Why:* Before we can import users, we need to know exactly which usernames conflict. This tool scans the ExponentHR database, finds every case where the same username exists at multiple companies, and produces a report. Without this, the import will fail when it tries to create duplicate accounts.

- [ ] **IMPT-02**: Shadow emails are generated for all users (especially the 10-30% without deliverable email) in format {uniqueId}@exponenthr-auth.com
  > *Why:* Every Entra account must have an email address (Microsoft's requirement). For users who have real email addresses, we use those. For users without email, we generate a synthetic email that Entra requires internally but the user never sees or interacts with.

- [ ] **IMPT-03**: Batch import tool creates users in Entra via Microsoft's management API with rate limiting, retry logic, and idempotent operations
  > *Why:* We're importing 10,000-100,000 users into Entra. Microsoft limits how fast you can create accounts (~20 per second). The import tool must respect these limits, automatically retry failures, and be safe to re-run if interrupted (idempotent). Without these safeguards, the import could fail partway through, leaving some users migrated and others not.

- [ ] **IMPT-04**: User accounts are configured to require a new password on first login
  > *Why:* Our current system stores passwords in a custom format that Entra cannot read. There is no way to transfer existing passwords — this is a hard platform limitation. Every user must set a new password the first time they log in to the new system.

- [ ] **IMPT-05**: Welcome communication is sent to users (email for email users, in-app notification for no-email users) explaining new login process and any username changes
  > *Why:* Users will encounter a different login page and need to set a new password. Without advance notice, this will generate a flood of support tickets. Users whose usernames changed due to collision resolution need to be told their new username. Users without email need an in-app notification since we can't email them.

### User Migration (JIT Strategy)

This path creates user accounts in Entra on-the-fly during each user's first login. It's more transparent to users but technically more complex.

- [ ] **JIT-01**: Bridge UI collects existing username/password from legacy auth system on first login attempt
  > *Why:* In the JIT approach, we need to verify the user's identity using their existing credentials before creating their Entra account. A "bridge" login page captures their current username and password, validates them against the existing auth system, and then creates their Entra account behind the scenes.

- [ ] **JIT-02**: Shadow email is generated and injected automatically during account creation, hidden from the user
  > *Why:* Even in the JIT approach, Entra requires an email address at account creation. A custom server-side function generates a shadow email and injects it into Entra's sign-up process using Microsoft's "custom authentication extensions" — hooks that let us modify the sign-up flow. The email field is marked as hidden so the user never sees it.

- [ ] **JIT-03**: User account is created in Entra transparently during first login — user never sees Entra sign-up flow
  > *Why:* The entire point of JIT is zero disruption. The user types their existing credentials, and behind the scenes their Entra account is created. They should never see a "create account" screen or be asked for information they didn't expect.

- [ ] **JIT-04**: Custom server-side function runs on a dedicated hosting plan to meet Microsoft's 2-second response time requirement
  > *Why:* Microsoft gives custom authentication extensions only 2 seconds to respond. If the function is hosted on a basic plan, it may "cold start" (take several seconds to wake up) and miss the deadline, causing the login to fail. A dedicated hosting plan keeps the function always-ready.

- [ ] **JIT-05**: Fallback path exists for JIT failures (user directed to admin-assisted account creation)
  > *Why:* No system is 100% reliable. If the JIT process fails for a specific user (network timeout, data issue, edge case), they need a way to still get access. A fallback directs them to contact support, where an admin can manually create their account.

### Authentication Integration

These requirements connect ExponentHR to Entra so the two systems can work together. After a user logs in through Entra, ExponentHR needs to receive and understand the proof of their identity.

- [ ] **AUTH-01**: ExponentHR connects to Entra External ID using the standard OIDC login protocol via OWIN middleware
  > *Why:* OIDC (OpenID Connect) is the industry-standard way for applications to delegate login to an identity provider. Instead of ExponentHR checking usernames and passwords itself, it redirects users to Entra, which handles authentication and sends back a secure "token" proving who the user is. OWIN middleware is the software component in .NET Framework that manages this redirect-and-receive flow. This replaces our custom-built auth service with an industry standard.

- [ ] **AUTH-02**: An adapter translates Entra's identity tokens into ExponentHR's existing internal session format
  > *Why:* ExponentHR's internal systems expect identity information in a specific custom format (the format our current auth service uses). Entra sends identity information in a different, standard format. Rather than rewriting every part of ExponentHR that checks "who is this user?", we build an adapter layer that translates Entra's format into the format ExponentHR already understands. This is called a "strangler fig" pattern — we wrap the old system with a new one, allowing a gradual transition without breaking existing functionality.

- [ ] **AUTH-03**: Login pages use Entra-hosted pages with ExponentHR company branding (logo, colors, background)
  > *Why:* Users need to recognize the login page as ExponentHR, not be confused by a generic Microsoft page. Entra supports company branding customization — logo, colors, background image, and hint text — so the login page looks familiar even though it's hosted by Microsoft. This avoids building and maintaining a fully custom login UI.

- [ ] **AUTH-04**: A custom server-side function enriches login tokens with ExponentHR-specific data (company IDs, employee record mappings, HRA status)
  > *Why:* Entra knows who the user is, but it doesn't know which companies they work for in ExponentHR or whether they're an HRA with multi-company access. A custom function (hosted in Azure) runs each time a token is issued, looks up the user's ExponentHR data, and adds it to the token. This way, ExponentHR immediately knows what the user has access to without making extra database calls after login.

### MFA (Multi-Factor Authentication)

MFA adds a second layer of security beyond passwords — users must prove their identity with something they have (phone) in addition to something they know (password). This replaces our homegrown OTP system with Microsoft's built-in MFA.

- [ ] **MFA-01**: SMS text message MFA is configured as a second factor, enforced through security policies
  > *Why:* After entering their password, users receive a one-time code via text message that they must enter to complete login. This is the most accessible MFA method — nearly every user has a phone that receives texts. Enforced through Entra's "Conditional Access" policies, which are rules that determine when and how MFA is required.

- [ ] **MFA-02**: Email one-time-password MFA is configured as a second factor
  > *Why:* Users with email addresses can receive a one-time code via email as an alternative to SMS. This provides a backup MFA method and is built into Entra at no additional cost.

- [ ] **MFA-03**: International phone numbers are supported for SMS MFA (Mexico/+52 confirmed)
  > *Why:* ExponentHR has users in Mexico who need SMS MFA. Microsoft Entra supports international SMS to Mexico (+52 country code), though it's a paid add-on with per-message pricing. This ensures all users, regardless of location, can complete MFA.

- [ ] **MFA-04**: No-email users are assigned to a security group that enforces phone-only MFA
  > *Why:* Users without email can't receive email-based one-time codes. They need to be grouped separately so Conditional Access policies only offer them SMS as an MFA option, avoiding confusion or failed MFA prompts.

### Password Recovery

When users forget their password, they need a way to regain access. Different recovery paths are needed depending on whether the user has an email address.

- [ ] **PWRC-01**: Users with email addresses can reset their own password through Entra's built-in self-service password reset
  > *Why:* Entra provides a built-in "forgot password" flow that sends a verification code to the user's email. This is zero-effort for us to maintain and is the standard experience for users with email.

- [ ] **PWRC-02**: Support team can reset passwords for any user through Microsoft's management API
  > *Why:* For users who can't reset their own password (no email, locked out of MFA, etc.), the support team needs a way to manually reset it. Microsoft's Graph API allows admins to programmatically reset passwords. This is the immediate solution for no-email users from day one.

- [ ] **PWRC-03**: Custom SMS-based password reset flow allows no-email users to reset their own password (verify identity via text message, then reset password)
  > *Why:* **Microsoft Entra does NOT support SMS-based self-service password reset in external tenants.** This is a significant platform gap. 10-30% of our users have no email and cannot use the built-in "forgot password" flow. Without a custom SMS reset, these users must call support every time they forget their password — an unacceptable burden at scale. This requires building a separate verification flow: user enters phone number, receives SMS code, verifies identity, then we reset their password through Microsoft's API.

### Support & Operations

The support team needs tools to troubleshoot login issues, and the operations team needs visibility into how the system is performing.

- [ ] **SUPP-01**: Rollback plan enables reverting to legacy auth per-company if critical issues arise
  > *Why:* If the new login system fails for a specific company after cutover, we need the ability to switch them back to the old system within minutes, not hours. A rollback plan ensures we can reverse the change without data loss or extended downtime. This is standard practice for high-risk migrations.

- [ ] **SUPP-02**: Support admin tooling provides user lookup, password reset, MFA reset, and account enable/disable through Microsoft's management API
  > *Why:* Today, support uses internal tools to manage user accounts. After migration, user accounts live in Entra. Support needs a way to search for users, reset passwords, clear MFA enrollments (e.g., when someone gets a new phone), and disable compromised accounts — all without needing direct access to the Microsoft admin portal.

- [ ] **SUPP-03**: Monitoring tracks sign-in logs, failure rates, token issuance latency, and MFA enrollment rates with alerting on anomalies
  > *Why:* After migration, we need to know if logins are failing, if the system is slow, or if MFA enrollment rates are lower than expected. Automated alerts catch problems before they become support ticket floods. Sign-in logs also provide audit trails for security compliance.

### Post-Auth Experience

What happens after the user successfully logs in. The goal is zero disruption to the experience users know today.

- [ ] **POST-01**: Existing in-app company/employee/environment switcher continues to work after migration — no changes to post-auth UX
  > *Why:* After users log in, they select which company, employee record, and environment to work in. This switcher is built into ExponentHR and works today. The migration must not break it. The identity token from Entra provides "who the user is"; the in-app switcher handles "where they want to work."

- [ ] **POST-02**: Single Entra identity correctly maps to multiple employee records for HRA users across subsidiary companies
  > *Why:* HRA (Human Resources Administrator) users are super-admins who manage HR across multiple subsidiary companies under a parent organization. One person, one login, access to many companies. Entra needs to store one identity that ExponentHR can map to all of that user's employee records. If this mapping breaks, HRA users lose access to subsidiaries — a critical workflow failure.

### Rollout

How the migration is deployed to production. A staged approach limits risk; a rollback plan provides a safety net.

- [ ] **ROLL-01**: Staged rollout migrates companies one at a time (not all-at-once) to limit blast radius
  > *Why:* Migrating all 10,000-100,000 users at once means if anything goes wrong, *everyone* is affected. A staged rollout — starting with 1-2 low-risk companies, then expanding — limits the impact of any issue to a small number of users while we learn and adjust.

- [ ] **ROLL-02**: Dual-auth period supports both legacy and Entra auth simultaneously during transition
  > *Why:* During the rollout, some companies will be on the new system while others are still on the old one. Both systems must run in parallel. This adds complexity but is necessary for a staged approach.

- [ ] **ROLL-03**: Per-company cutover process is documented and repeatable
  > *Why:* If we're migrating companies one at a time, the cutover process (switch this company from old auth to new auth) must be consistent, documented, and executable by the team without heroics. A repeatable process reduces errors and makes the rollout predictable.

- [ ] **ROLL-04**: Legacy auth is decommissioned per company after observation period (7+ days post-cutover)
  > *Why:* After a company is migrated, we keep the old auth system running for that company for at least 7 days as a safety net. If no issues surface, we decommission their legacy auth. This ensures we can always roll back during the observation window.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Experience

- **EXP-01**: Custom OTP email provider sends branded verification emails (ExponentHR-branded instead of generic Microsoft emails)
- **EXP-02**: Username format modernization allows users to change usernames post-migration
- **EXP-03**: Passkey/FIDO2 passwordless authentication support (login with fingerprint or security key instead of password)

### Future Onboarding

- **ONB-01**: Self-service account linking allows users to link additional identities to their account

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Fully custom login UI | Entra-themed pages with branding are acceptable; building a custom login UI from scratch adds months of development and ongoing security maintenance |
| Password hash migration | Microsoft Entra cannot import existing password hashes from our custom system — this is a hard platform limitation, not a choice. Users must set new passwords. |
| Social login (Google/Facebook/Apple) | ExponentHR is enterprise HR software — employees don't want to link personal social accounts to their employer's HR system |
| Custom MFA system | Our homegrown OTP system is one of the reasons we're migrating. Rebuilding custom MFA defeats the purpose of moving to an industry-standard platform. |
| Real-time sync of legacy credentials | Running two auth systems with live synchronization creates data consistency problems (which password is the real one?). Clean per-company cutover is safer. |
| Mobile app authentication | Web-first approach; mobile app auth can be added later using the same Entra platform |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1: Platform Foundation | Pending |
| FOUND-02 | Phase 1: Platform Foundation | Pending |
| FOUND-03 | Phase 1: Platform Foundation | Pending |
| FOUND-04 | Phase 1: Platform Foundation | Pending |
| FOUND-05 | Phase 1: Platform Foundation | Pending |
| STRAT-01 | Phase 2: Strategy Comparison | Pending |
| STRAT-02 | Phase 2: Strategy Comparison | Pending |
| STRAT-03 | Phase 2: Strategy Comparison | Pending |
| STRAT-04 | Phase 2: Strategy Comparison | Pending |
| IMPT-01 | Phase 3: Pre-Import Migration Pipeline | Pending |
| IMPT-02 | Phase 3: Pre-Import Migration Pipeline | Pending |
| IMPT-03 | Phase 3: Pre-Import Migration Pipeline | Pending |
| IMPT-04 | Phase 3: Pre-Import Migration Pipeline | Pending |
| IMPT-05 | Phase 3: Pre-Import Migration Pipeline | Pending |
| JIT-01 | Phase 4: JIT Migration Pipeline | Pending |
| JIT-02 | Phase 4: JIT Migration Pipeline | Pending |
| JIT-03 | Phase 4: JIT Migration Pipeline | Pending |
| JIT-04 | Phase 4: JIT Migration Pipeline | Pending |
| JIT-05 | Phase 4: JIT Migration Pipeline | Pending |
| AUTH-01 | Phase 5: Authentication Integration | Pending |
| AUTH-02 | Phase 5: Authentication Integration | Pending |
| AUTH-03 | Phase 5: Authentication Integration | Pending |
| AUTH-04 | Phase 5: Authentication Integration | Pending |
| MFA-01 | Phase 6: MFA & Password Recovery | Pending |
| MFA-02 | Phase 6: MFA & Password Recovery | Pending |
| MFA-03 | Phase 6: MFA & Password Recovery | Pending |
| MFA-04 | Phase 6: MFA & Password Recovery | Pending |
| PWRC-01 | Phase 6: MFA & Password Recovery | Pending |
| PWRC-02 | Phase 6: MFA & Password Recovery | Pending |
| PWRC-03 | Phase 6: MFA & Password Recovery | Pending |
| POST-01 | Phase 7: Post-Auth & HRA Experience | Pending |
| POST-02 | Phase 7: Post-Auth & HRA Experience | Pending |
| SUPP-01 | Phase 9: Staged Rollout | Pending |
| SUPP-02 | Phase 8: Support & Operations Tooling | Pending |
| SUPP-03 | Phase 8: Support & Operations Tooling | Pending |
| ROLL-01 | Phase 9: Staged Rollout | Pending |
| ROLL-02 | Phase 9: Staged Rollout | Pending |
| ROLL-03 | Phase 9: Staged Rollout | Pending |
| ROLL-04 | Phase 10: Legacy Decommission & Hardening | Pending |

**Coverage:**
- v1 requirements: 39 total
- Mapped to phases: 39
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-11*
*Last updated: 2026-02-11 after roadmap phase mapping*
