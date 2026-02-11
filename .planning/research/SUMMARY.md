# Research Summary: ExponentHR Identity Migration

**Domain:** Enterprise identity migration — proprietary auth to Microsoft Entra External ID
**Researched:** 2026-02-11
**Overall confidence:** HIGH (all core findings verified against official Microsoft documentation)

---

## Executive Summary

ExponentHR needs to replace its proprietary authentication system (custom tokens, homegrown OTP-based MFA) with Microsoft Entra External ID for 10,000–100,000 users. The research validates this is technically feasible but reveals several hard platform constraints that dictate the migration architecture.

**The central finding:** Entra External ID requires email for account creation but supports username for sign-in. This asymmetry is the single most important constraint. It means users can keep their existing usernames for day-to-day login, but every account must have an email address (real or synthetic) created during initial provisioning. For the 10–30% of users without deliverable email, "shadow emails" (e.g., `{uniqueId}@exponenthr-auth.com`) are the accepted workaround — these are never shown to users and never used for communication.

**The recommended strategy is Pre-Import via Graph API (Strategy A).** This approach batch-creates all user accounts in Entra before go-live, resolves username collisions upfront, and forces a one-time password reset on first login. It is simpler, more controllable, and better documented than JIT migration. The JIT migration approach (Strategy B) is architecturally viable but adds significant complexity — a bridge UI, custom authentication extensions, and real-time account creation — for marginal user experience benefit. JIT should be deferred to post-MVP for edge cases or new client onboarding.

**The critical go/no-go gate is .NET Framework compatibility.** ExponentHR runs on .NET Framework (ASP.NET). The recommended OIDC integration library (`Microsoft.Identity.Web.OWIN 4.3.0`) requires .NET Framework 4.7.2+. If ExponentHR targets a lower version, a framework upgrade is the mandatory first step. Additionally, the OWIN OIDC middleware's compatibility with Entra External ID's `ciamlogin.com` authority URL has no official Microsoft sample and must be validated via a spike/POC in week 1.

**A notable platform limitation:** SMS-based self-service password reset (SSPR) is not available in Entra External ID external tenants. Users without email cannot reset their own passwords through Entra's built-in flow. This means admin-assisted password reset (via support tooling using Graph API) is required from day one, with a custom SMS-based reset flow as a P2 feature.

---

## Key Findings

**Stack:** .NET Framework 4.7.2+ with Microsoft.Identity.Web.OWIN 4.3.0 (OIDC), Microsoft.Graph 5.102.0 (user management), Azure.Identity 1.17.1 (auth), Azure Functions (custom auth extensions). All packages verified on NuGet with current versions.

**Architecture:** Pre-import via Graph API creates users with dual identities (shadow email + username). OWIN OIDC middleware handles authentication. OnTokenIssuanceStart Azure Function enriches tokens with ExponentHR claims (company IDs, employee records, HRA status). Auth Service Adapter maps Entra claims to existing session format (strangler fig pattern).

**Features:** 13 table-stakes features identified (username sign-in, account creation for no-email users, MFA, branded login, collision resolution, rollback). 7 differentiators (JIT migration, SMS password reset, HRA multi-identity, staged rollout). 8 anti-features to avoid (custom login UI, password hash migration, social login, custom MFA).

**Critical pitfalls:** (1) Shadow email domain must be owned and DNS-configured before any import, (2) custom auth extensions cannot skip email during sign-up — confirms pre-import strategy, (3) Graph API rate limiting during batch import (~20 writes/sec sustained), (4) username collision misrouting risks with HRA multi-company users, (5) OWIN + ciamlogin.com compatibility unvalidated — needs POC spike, (6) custom auth extension 2-second timeout requires Azure Functions Premium plan.

---

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation & Validation (Weeks 1–3)
**Rationale:** Must validate the go/no-go technical risks before investing in migration tooling.

- **Week 1 spike:** OWIN OIDC middleware + Entra External ID `ciamlogin.com` authority. Build a throwaway ASP.NET Framework app, configure OIDC, verify the full redirect → token → claims flow works. If this fails, the entire .NET Framework integration strategy needs rethinking.
- Verify ExponentHR's .NET Framework target version. If < 4.7.2, plan upgrade.
- Create Entra External ID tenant, app registration, user flow, company branding.
- Enable username/alias sign-in identifier (preview feature).
- Configure MFA (SMS + email OTP) via Conditional Access.
- Register and configure shadow email domain (`exponenthr-auth.com` or subdomain).

**Addresses features:** Entra tenant setup, branded login, MFA configuration, username sign-in.
**Avoids pitfalls:** Shadow email domain risks (Pitfall 1), custom auth extension limitations — confirms pre-import strategy (Pitfall 2), .NET Framework OIDC incompatibility (Pitfall 5).

### Phase 2: Integration & Migration Tooling (Weeks 3–6)
**Rationale:** Connects Entra to ExponentHR and builds the user import pipeline. These can be partially parallelized.

**Integration track (Weeks 3–5):**
- OWIN OIDC middleware integration in ExponentHR.
- Auth Service Adapter (strangler fig) — maps Entra claims to internal session format.
- OnTokenIssuanceStart Azure Function for custom claims (company IDs, HRA status).
- Company switcher integration — verify HRA users see all companies from Entra token claims.

**Migration tooling track (Weeks 4–6, overlaps):**
- Username collision analysis (SQL query against ExponentHR DB).
- Collision resolution algorithm: `{companyCode}_{username}`.
- Shadow email generation for no-email users.
- Graph API batch import tool with rate limiting, retry logic, idempotent operation.
- Dry-run mode and migration report generator.
- Phone number normalization (E.164 format) for MFA pre-registration.

**Addresses features:** OIDC integration, token claims, HRA mapping, user import, collision resolution.
**Avoids pitfalls:** Token format breaks sessions (Pitfall 7), Graph API rate limiting (Pitfall 3), username collision misrouting (Pitfall 4), MFA enrollment friction (Pitfall 9).

### Phase 3: Testing & Pilot (Weeks 6–8)
**Rationale:** Validate everything with a small cohort before full rollout.

- E2E test suite: login, MFA, password reset, company switch, HRA flow.
- Pilot with 1–2 low-risk client companies.
- Load testing against Entra tenant rate limits (200 req/sec ceiling).
- User communication preparation: welcome emails, MFA enrollment guides, username change notices.
- Rollback plan tested in staging.

**Addresses features:** E2E validation, staged rollout, communication plan.
**Avoids pitfalls:** Tenant rate limits at peak (Pitfall 10), MFA enrollment friction (Pitfall 9), dual-auth security gaps (Pitfall 8).

### Phase 4: Production Rollout (Weeks 8–10)
**Rationale:** Controlled, company-by-company migration with monitoring.

- Batch import execution for all remaining companies.
- Company-by-company cutover (DNS/routing changes).
- Support escalation path active for MFA and login issues.
- Monitor sign-in logs, failure rates, token issuance latency.
- Legacy auth decommission per company (after 7-day observation period).

**Addresses features:** Full migration, rollback, legacy decommission.
**Avoids pitfalls:** Dual-auth security gaps (Pitfall 8), tenant rate limits (Pitfall 10).

### Phase 5: Hardening & Post-MVP (Weeks 10–12+)
**Rationale:** Features that improve the experience but aren't required for migration launch.

- Support admin tooling (user lookup, password reset, MFA reset via Graph API).
- Custom SMS-based password reset flow for no-email users (P2 feature).
- Custom OTP email provider (branded verification emails).
- JIT migration path research/prototype (for future new client onboarding).
- Monitoring and alerting maturation.

**Addresses features:** SMS password reset, admin tooling, custom email branding.

---

### Phase Ordering Rationale

1. **Foundation first** because the OWIN + ciamlogin.com spike is a go/no-go gate. If this fails, everything downstream changes. Also, .NET Framework version verification must happen before any NuGet package installation.

2. **Integration and Migration Tooling overlap** because they are independent work streams. The OIDC integration doesn't depend on the import tooling, and vice versa. Parallelization saves 2–3 weeks.

3. **Pilot before production** because the user base is 10K–100K users. A failed full rollout generates thousands of support tickets. Piloting with 1–2 companies validates the entire pipeline at low risk.

4. **Company-by-company rollout** because it enables incremental validation, limits blast radius, and allows per-company rollback. It also spreads MFA enrollment load to stay under Entra's telephony rate limits.

5. **Hardening after launch** because admin tooling and custom SMS password reset are important but not migration-blocking. No-email users who forget passwords can be handled manually via Graph API in the short term.

---

### Research Flags for Phases

- **Phase 1:** Likely needs a **dedicated spike/POC** (1 week) to validate OWIN + Entra External ID `ciamlogin.com` compatibility. This is the highest-risk unknown — no official Microsoft sample exists for this combination.
- **Phase 1:** May need **deeper research** on .NET Framework upgrade implications if ExponentHR targets < 4.7.2. Framework upgrades can surface subtle breaking changes.
- **Phase 2:** Username collision resolution strategy needs **product owner sign-off** — this is a UX decision (how do users learn their new username?) as much as a technical one.
- **Phase 2:** Graph API batch import rate limiting needs **empirical testing**. The documented limits are per-tenant and per-app, but the actual throttling behavior under sustained load should be validated.
- **Phase 3:** Standard patterns — load testing and pilot rollout are well-understood. Unlikely to need additional research.
- **Phase 4:** Standard patterns — production rollout is operational, not research-dependent.
- **Phase 5:** Custom SMS password reset flow may need **feasibility research** — building SMS verification outside of Entra's native flows means selecting an SMS provider (Twilio, Azure Communication Services) and building a custom web flow.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All 6 core packages verified on NuGet with exact versions, compatibility matrices, and dependency chains. |
| Features | HIGH | Feature landscape derived from official Entra External ID capabilities docs and PROJECT.md requirements. Platform capabilities table has 14 entries, all verified. |
| Architecture | MEDIUM-HIGH | System structure and data flow patterns are sound. OWIN OIDC + `ciamlogin.com` integration is MEDIUM confidence — needs POC validation. All other patterns verified against official docs. |
| Pitfalls | HIGH | 10 critical/moderate pitfalls identified with prevention strategies. Rate limits, timeouts, and telephony limits verified against the Entra External ID service limits document (dated 2025-12-12). |
| Migration strategy recommendation | HIGH | Pre-import via Graph API is clearly lower risk and better documented than JIT migration. The email sign-up constraint makes JIT more complex than initially expected. |
| Timeline (90-day plan) | MEDIUM | Technically feasible but tight. The .NET Framework upgrade (if needed) and OWIN+ciamlogin.com spike could add 1–3 weeks. Buffer recommended. |

---

## Gaps to Address

Areas where research was inconclusive or needs phase-specific investigation:

1. **ExponentHR's exact .NET Framework version** — Not verified. This is the single most important unknown. If < 4.7.2, adds a Phase 0 upgrade step.

2. **OWIN OIDC middleware + `ciamlogin.com` authority** — No official Microsoft sample exists for this combination. Functionally it should work (OIDC is a standard protocol, metadata endpoint exists), but edge cases around issuer validation, PKCE support, and nonce handling need POC validation.

3. **Graph API rate limiting behavior for External ID tenants** — The B2C "4x cost multiplier" for user creation is documented for B2C tenants. Whether External ID tenants inherit this multiplier is unclear. Needs empirical testing or Microsoft support confirmation.

4. **Username/alias sign-in (preview) stability** — This feature is in preview. Production readiness and GA timeline are unknown. Fallback if it changes: users sign in with their shadow email (less ideal UX).

5. **Custom SMS password reset flow architecture** — Deferred to Phase 5. Needs research on SMS provider selection (Twilio vs. Azure Communication Services), verification flow design, and Graph API password reset integration.

6. **ExponentHR's current session management internals** — The Auth Service Adapter pattern assumes we can modify the auth layer without rearchitecting session management. The actual implementation may be more tightly coupled than expected.

7. **HRA multi-company token size** — If an HRA user manages 20+ companies, the custom claims in the Entra token could exceed practical size limits. Needs testing with realistic data volumes.

8. **Entra External ID licensing costs** — Monthly Active User (MAU) pricing tiers not researched. SMS MFA is an add-on with per-message, per-country pricing. Budget impact at 100K users needs calculation.

---

## Sources Summary

All research files cite official Microsoft documentation with publication dates:

- **23 official Microsoft Learn URLs** cited across all research files
- **5 NuGet package pages** verified for version numbers and compatibility
- **1 Entra External ID service limits document** (2025-12-12) — critical for rate limits, timeouts, and configuration limits
- **0 unverified WebSearch-only findings** — all claims trace to official documentation

Publication dates range from 2025-01-07 to 2026-02-06, all within the last 13 months. Research is current.

---

## Research Files Index

| File | Lines | Purpose | Key Takeaway |
|------|-------|---------|--------------|
| [STACK.md](STACK.md) | 174 | Technology recommendations with versions | Microsoft.Identity.Web.OWIN 4.3.0 is the critical library; requires .NET Framework 4.7.2+ |
| [FEATURES.md](FEATURES.md) | 374 | Feature landscape (table stakes, differentiators, anti-features) | Email can be hidden on sign-up page (`hidden: true`), but email identity step cannot be bypassed |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 619 | System structure, component boundaries, data flow | Pre-import via Graph API → OWIN OIDC → Auth Service Adapter → existing session management |
| [PITFALLS.md](PITFALLS.md) | 450 | Domain pitfalls with prevention strategies | 10 critical/moderate pitfalls; top risk is OWIN+ciamlogin.com compatibility (needs spike) |

---
*Research summary for: ExponentHR Identity Migration to Entra External ID*
*Researched: 2026-02-11*
