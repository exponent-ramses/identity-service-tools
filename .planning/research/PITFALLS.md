# Pitfalls Research: ExponentHR Identity Migration to Entra External ID

**Domain:** Enterprise identity migration (proprietary auth to Microsoft Entra External ID)
**Researched:** 2026-02-11
**Confidence:** HIGH (verified against official Microsoft documentation)

## Critical Pitfalls

### Pitfall 1: Shadow Email Domain Without MX Records Causes Silent Account Failures

**What goes wrong:**
Using fabricated emails like `{id}@exponenthr-auth.com` as shadow placeholders in Entra creates accounts that appear functional but break in multiple failure modes:
1. **Entra password reset flows** attempt to send emails to the shadow domain. Without MX records, these silently fail. Users who trigger "Forgot Password" from the Entra login page get no recovery email and are locked out.
2. **Spam filter classification** — if the domain has no SPF/DKIM/DMARC records and no MX record, any outbound email from Entra referencing that domain may be flagged or bounced by intermediate systems. Entra's email OTP for MFA uses the user's registered email; if that's a shadow email, OTP delivery fails silently.
3. **Microsoft notification emails** — Entra sends security alerts, sign-in notifications, and compliance emails to registered addresses. Shadow emails create a black hole for these.
4. **Domain verification** — Entra External ID may require or attempt to verify custom domains. An unregistered domain like `exponenthr-auth.com` could be squatted, purchased by a bad actor, or flagged during Microsoft compliance reviews.

**Why it happens:**
Teams choose shadow emails because Entra External ID **requires email for sign-up** (verified via official docs: user flow creation only offers "Email with password" or "Email one-time passcode" as identity providers). The assumption is "we'll never use these emails" — but Entra's platform features do.

**How to avoid:**
- **Register and own the shadow domain.** Purchase `exponenthr-auth.com` (or use a subdomain of your existing domain like `auth-noreply.exponenthr.com`). Configure MX records pointing to a catch-all mailbox or `/dev/null` equivalent.
- **Set SPF, DKIM, DMARC records** even for the shadow domain — prevents deliverability issues if Entra ever tries to send from it.
- **Configure a redirect receiver** — route all shadow domain email to a monitored support mailbox so password reset requests from confused users are caught.
- **Disable self-service password reset for shadow-email users** using Conditional Access group policies. Force these users through admin-assisted or phone-based reset flows only.
- **Document the shadow email convention** in the migration mapping table so support staff know `12345@exponenthr-auth.com` is synthetic.

**Warning signs:**
- Users report "I never got the reset email"
- Password reset success rate drops below 90% post-migration
- Security audit flags unverifiable email addresses
- The shadow domain appears on email blocklists

**Phase to address:** Phase 1 (Infrastructure Setup) — domain registration and DNS configuration must happen before any user import.

**Confidence:** HIGH — verified against Entra External ID user flow docs (2025-09-16) and service limits doc (2025-12-12). Email is mandatory for sign-up identity providers.

---

### Pitfall 2: Custom Auth Extension Cannot Skip Email Collection During Sign-Up

**What goes wrong:**
Teams assume `OnAttributeCollectionStart` can be used to pre-fill the email field and hide it from users, effectively bypassing Entra's email requirement during JIT migration sign-up. This assumption is **partially correct but fragile**:

1. The `OnAttributeCollectionStart` event fires **after** the initial email/identity submission step, not before it. The user flow begins with identity provider selection (email+password or email+OTP), which collects email as the **identity**, not as an attribute. Custom auth extensions only control the **attribute collection page** that follows.
2. The `setPreFillValues` action on `OnAttributeCollectionStart` can pre-fill custom attributes and built-in attributes like `postalCode`, `city`, etc. But the **email used as the sign-in identity** is collected in a separate, earlier step that custom extensions cannot intercept.
3. The `hidden` and `editable` flags (configurable via Microsoft Graph on `authenticationAttributeCollectionInputConfiguration`) can hide attributes on the attribute collection page — but again, this only applies to the attribute collection page, not the identity collection step.

**Net effect:** You cannot use custom auth extensions to create a JIT sign-up flow where the user provides a username and the system silently assigns a shadow email. The email identity step in the user flow is mandatory and cannot be suppressed.

**Why it happens:**
The Entra External ID documentation is ambiguous about the scope of custom auth extensions. The event names ("attribute collection start/submit") sound comprehensive, but they specifically apply to the optional attribute page, not the identity provider selection.

**How to avoid:**
- **Use pre-import via Graph API** (Strategy A) instead of JIT migration for users without email. Pre-imported users already have accounts and skip the sign-up flow entirely — they only encounter the sign-in flow, which supports username.
- **For JIT migration:** Accept that JIT migration through Entra's native sign-up flow requires users to enter an email. For users with real emails, this works. For users without emails, JIT is not viable without a bridge application that pre-creates the account via Graph API before redirecting to Entra sign-in.
- **Hybrid approach:** Build a "bridge page" that intercepts the first login, validates credentials against the legacy system, creates the Entra account via Graph API (with shadow email), and then redirects the user to Entra sign-in (not sign-up).

**Warning signs:**
- POC fails when testing sign-up flow without email
- Auth extension logs show the email collection step happens before the extension fires
- User flow testing reveals email input cannot be hidden or bypassed

**Phase to address:** Phase 1 (Strategy Decision) — this determines the entire migration architecture. Must be validated in POC before committing to JIT.

**Confidence:** HIGH — verified against custom auth extension docs (2025-09-16), custom extension overview (2025-11-25), and user flow creation docs (2025-09-16). The OnAttributeCollectionStart event explicitly occurs "at the beginning of the attribute collection step, before the attribute collection page renders" — confirming it is scoped to the attribute page, not the identity provider step.

---

### Pitfall 3: Graph API User Creation Rate Limits Block Batch Import at Scale

**What goes wrong:**
Teams plan to batch-import 10,000-100,000 users via Microsoft Graph API but hit throttling limits that turn a planned hours-long import into a days-long ordeal or outright failure:

1. **Identity & Access service write quota:** 3,000 requests per 2.5 minutes per app+tenant pair (for tenants >500 users). That's ~20 writes/second sustained.
2. **Tenant-level write quota:** 18,000 requests per 5 minutes across all apps. That's ~60 writes/second max across everything.
3. **User creation in B2C-pattern tenants** has an additional cost multiplier: "Creating a user in a Microsoft Entra ID B2C tenant increases cost by 4" (from the throttling limits doc). External ID tenants may inherit this multiplier — **this needs validation** as the docs specifically mention B2C, and External ID is the successor product.
4. **429 responses** lack `Retry-After` headers for some Identity & Access endpoints, making backoff strategy guesswork.
5. At 20 writes/second, importing 100,000 users takes ~83 minutes under ideal conditions — but any 429 responses, retries, or pre-flight validation calls multiply this significantly.

**Why it happens:**
Graph API rate limits are designed for steady-state operations, not bulk migrations. Microsoft's guidance assumes SCIM-style incremental sync, not one-time mass import.

**How to avoid:**
- **Calculate realistic import time** before committing to a timeline. At 15 effective writes/second (accounting for overhead), 100K users = ~1.8 hours minimum. Plan for 4-6 hours with retries.
- **Implement exponential backoff with jitter** on 429 responses. Start at 1 second, cap at 60 seconds. Use the `x-ms-throttle-limit-percentage` response header (returned when >80% of limit consumed) to proactively slow down.
- **Batch into cohorts** — import by company/tenant, not all at once. This lets you validate each batch before proceeding.
- **Use `$select` on creation responses** to reduce resource unit cost (saves 1 unit per request per the docs).
- **Run imports during off-peak hours** (nights/weekends) to minimize competition with other tenant operations.
- **Request limit increase from Microsoft** via support ticket before starting migration if at the 100K end of the range.
- **Consider parallel app registrations** — multiple app IDs each get their own per-app quota, but they share the tenant-level quota.

**Warning signs:**
- Import script starts returning 429 errors within the first few minutes
- `x-ms-throttle-limit-percentage` header shows >0.8 consistently
- Import estimated at 2 hours takes 8+ hours
- Users report being unable to sign in during import window (competing for tenant resources)

**Phase to address:** Phase 2 (Migration Tooling) — import script must include rate limiting, retry logic, and progress tracking before running against production.

**Confidence:** HIGH — rate limits verified against Microsoft Graph throttling limits doc (2026-02-06). The B2C cost multiplier applicability to External ID tenants is MEDIUM confidence (needs validation).

---

### Pitfall 4: Username Collision Resolution Creates Orphaned or Misrouted Identities

**What goes wrong:**
When resolving non-globally-unique usernames (e.g., companyA/jsmith and companyB/jsmith), the collision resolution strategy can create identity mismatches that route users to the wrong company data:

1. **Suffix-based resolution** (e.g., `jsmith_companyA`) — users must learn their new username, but communications fail to reach all users, leaving some unable to log in.
2. **Mapping table corruption** — a lookup table mapping `{username, company}` to `{entra_id}` gets out of sync during staged migration, causing users to be mapped to wrong employee records.
3. **HRA multi-company users** compound the problem — an HRA admin who has `jsmith` across 3 companies needs ONE Entra identity, not three. If the collision resolution creates three separate accounts, the multi-company access model breaks.
4. **Case sensitivity** — Entra usernames are case-insensitive but the legacy system may treat `JSmith` and `jsmith` as different users within the same company.
5. **Post-migration user creation** — new users created after migration may collide with resolved usernames if the resolution convention isn't enforced in the new user provisioning flow.

**Why it happens:**
Username collision is an inherent problem when migrating from company-scoped identifiers to a globally-scoped directory. The complexity is underestimated because the collision rate seems low — but even 1% collisions in 100K users = 1,000 users who need manual attention.

**How to avoid:**
- **Pre-analyze collision data exhaustively.** Run a query against the production database to find exact collision counts, grouped by company pairs. Know the number before designing the resolution strategy.
- **Prefer opaque identifiers for Entra accounts** — use employee ID or GUID as the Entra username/UPN, and store the human-readable username as a custom attribute used only for the login bridge. This eliminates collisions entirely.
- **If preserving human-readable usernames:** Use `{username}_{companycode}` and communicate the change to affected users via their company's HR department (not via email they may not have).
- **Build the HRA identity mapping first** — identify all HRA multi-company users and create single Entra accounts with all employee records mapped, before batch import.
- **Enforce case normalization** — lowercase all usernames during migration, document this, and validate against the legacy system's case handling.
- **Include collision resolution in the new user provisioning API** so post-migration user creation follows the same rules.

**Warning signs:**
- Migration test reveals >0 users mapped to wrong company data
- HRA users cannot see all their subsidiary companies after migration
- Support tickets about "wrong account" or "missing company" spike post-migration
- Duplicate Entra accounts discovered for the same physical user

**Phase to address:** Phase 1 (Data Analysis & Strategy) — collision analysis must complete before any user import. HRA identity mapping is a prerequisite for the import script.

**Confidence:** HIGH — this is a domain-specific pitfall derived from the project requirements (company-scoped non-unique usernames confirmed in PROJECT.md).

---

### Pitfall 5: .NET Framework OIDC Middleware Incompatibility with Entra External ID Endpoints

**What goes wrong:**
ExponentHR runs on .NET Framework (ASP.NET, not ASP.NET Core). The OIDC integration path differs significantly:

1. **Microsoft.Owin.Security.OpenIdConnect** (OWIN middleware) is the standard OIDC library for .NET Framework. It uses the older `login.microsoftonline.com` authority endpoints. Entra External ID uses `{tenant}.ciamlogin.com` as the authority (confirmed in official docs). The OWIN middleware may not handle this non-standard authority URL correctly — it expects Microsoft-specific metadata endpoints at known paths.
2. **MSAL.NET vs ADAL** — .NET Framework apps historically used ADAL (now deprecated). MSAL.NET supports .NET Framework 4.6.2+ but the integration pattern is very different from MSAL in .NET Core. The `Microsoft.Identity.Web` library (preferred for new apps) **does not support .NET Framework** — it's .NET Core/.NET 5+ only.
3. **Token validation** — `System.IdentityModel.Tokens.Jwt` works on .NET Framework, but the automatic metadata refresh from `{tenant}.ciamlogin.com/.well-known/openid-configuration` needs to be validated. If the OWIN middleware caches the wrong metadata URL, token validation fails intermittently.
4. **Custom token claims** — Entra External ID tokens may include different claim names than the legacy custom tokens. The existing session management code likely parses specific claims. Mapping mismatches cause session issues (see Pitfall 7).

**Why it happens:**
Microsoft's Entra External ID documentation and samples are overwhelmingly focused on .NET Core, React, Angular, and other modern stacks. .NET Framework is a second-class citizen with no official External ID samples or guides.

**How to avoid:**
- **Build a minimal POC first** — create a throwaway ASP.NET Framework 4.8 app with OWIN OIDC middleware pointing at `{tenant}.ciamlogin.com`. Verify the full flow: metadata discovery, login redirect, token validation, and claim extraction. Do this before any other development.
- **Use MSAL.NET directly** (not OWIN middleware) for token acquisition. MSAL.NET 4.x supports .NET Framework 4.6.2+. Configure it with the `ciamlogin.com` authority.
- **Set the `MetadataAddress` explicitly** in OWIN OIDC configuration rather than relying on authority URL auto-discovery:
  ```csharp
  MetadataAddress = "https://{tenant}.ciamlogin.com/{tenantId}/v2.0/.well-known/openid-configuration"
  ```
- **Test token validation separately** — extract a token from a browser session and validate it programmatically in a test harness before integrating with the application.
- **Plan for the OWIN pipeline limitations** — OWIN middleware on .NET Framework may not support PKCE (Proof Key for Code Exchange) natively. If Entra External ID requires PKCE, you may need a custom `OpenIdConnectAuthenticationHandler` or switch to using MSAL directly with the authorization code flow.

**Warning signs:**
- OWIN middleware throws `IDX20803: Unable to obtain configuration from` with the ciamlogin.com URL
- Token validation fails with `IDX10205: Issuer validation failed`
- Login redirects work but the callback fails silently
- Claims expected by the application (e.g., `company`, `employeeId`) are missing from the token

**Phase to address:** Phase 1 (POC/Spike) — .NET Framework compatibility must be validated before any architecture decisions are finalized. This is a go/no-go gate.

**Confidence:** MEDIUM — the `ciamlogin.com` authority URL is verified in official docs. The OWIN middleware behavior with this URL is based on architectural knowledge of the middleware, not tested. The explicit `MetadataAddress` workaround is a well-known pattern but needs POC validation for External ID specifically.

---

### Pitfall 6: Custom Auth Extension Timeout and Retry Behavior Causes Login Failures

**What goes wrong:**
Custom authentication extensions (Azure Functions calling your REST API) have strict timing and reliability constraints that can cause cascading login failures:

1. **2,000ms timeout** — the custom auth extension REST API must respond within 2 seconds (verified: service limits doc). If your API calls the legacy auth system to validate credentials (JIT migration), and the legacy system is slow, the extension times out. Entra returns a generic error to the user.
2. **Maximum 1 retry** — if the first call fails, Entra retries exactly once (verified: service limits doc). Two failures = user sees an error. There is no configurable retry count.
3. **Cold start latency** — Azure Functions on the Consumption plan can take 5-15 seconds to cold start. A cold start on the first login attempt after idle time will exceed the 2-second timeout.
4. **No circuit breaker** — if your REST API is down, every single login attempt fails. There's no fallback or degraded mode built into Entra.
5. **Extension quota** — maximum 100 custom authentication extensions per tenant (verified: service limits doc). Not an immediate concern but limits future extensibility.

**Why it happens:**
Custom auth extensions are designed for lightweight logic (claim enrichment, attribute validation) — not for heavyweight operations like validating credentials against a legacy system over a network hop.

**How to avoid:**
- **Use Azure Functions Premium or App Service plan** — eliminates cold starts. The cost increase is justified for a critical auth path.
- **Keep extension logic under 500ms** — pre-warm connections, use connection pooling to legacy systems, cache where possible.
- **Do NOT validate legacy credentials in the extension** — validate them in a bridge UI before redirecting to Entra. The extension should only augment data, not make auth decisions.
- **Implement health monitoring** — Azure Application Insights on the Function App, with alerts on response times >1000ms and error rates >1%.
- **Design for extension failure** — if using extensions for claim enrichment (e.g., adding employee records to the token), ensure the application can gracefully handle missing claims and fetch them on-demand.
- **Load test the extension** under realistic concurrency before go-live. Simulate 50+ concurrent logins to verify performance.

**Warning signs:**
- Login failures spike during low-traffic periods (cold start indicator)
- Extension logs show response times >1500ms
- Users report intermittent "something went wrong" errors during login
- Monitoring shows the extension returning HTTP 500 to Entra

**Phase to address:** Phase 2 (Extension Development) — hosting plan and performance testing must be part of the extension build phase.

**Confidence:** HIGH — timeout (2,000ms), retry count (1), and extension quota (100) verified in Entra External ID service limits doc (2025-12-12).

---

### Pitfall 7: Token Format Migration Breaks Existing Session Management

**What goes wrong:**
The existing ExponentHR app uses custom tokens issued by a proprietary auth service. Migrating to Entra External ID tokens (standard JWTs) breaks session management in multiple ways:

1. **Claim name mismatches** — the legacy token likely uses custom claim names (`CompanyId`, `EmployeeId`, `AccessLevel`). Entra tokens use standard OIDC claims (`sub`, `oid`, `email`) plus custom claims configured via the token issuance extension. Every place the application reads a claim needs updating.
2. **Token structure differences** — custom tokens may be in a non-JWT format (XML, encrypted blob, proprietary). Code that parses the token breaks immediately.
3. **Session cookie format** — if the app stores the raw token in a session cookie, the cookie size changes (Entra JWTs are typically larger). Cookies over 4KB are silently truncated by browsers, causing random session corruption.
4. **Token lifetime differences** — the legacy system may issue tokens valid for 8 hours. Entra tokens have configurable lifetimes but default to 1 hour for access tokens. If the app doesn't implement token refresh, users get logged out unexpectedly.
5. **In-app company/employee switcher** — the current switcher likely modifies the session claims when switching companies. With Entra tokens, the `sub`/`oid` claim is immutable. The switcher must work at the application session layer, not the token layer.

**Why it happens:**
Token migration is treated as a "swap one token for another" task, but in reality it's a "rewrite every claim consumer in the application" task. The blast radius is underestimated.

**How to avoid:**
- **Create a claim mapping layer** — abstract all token claim reading behind a service that maps Entra claims to the application's expected claim names. During dual-auth, this service handles both token formats.
- **Audit every claim consumer** — search the codebase for all places that read from the token/session. Document which claims are used and where. This is prerequisite work before any integration.
- **Use the OnTokenIssuanceStart extension** to include custom claims (`companyIds`, `employeeIds`, `accessLevel`) in the Entra token so the application receives familiar data.
- **Separate identity token from application session** — the Entra token authenticates the user; the application session (stored server-side) holds the mutable state (current company, current employee record). Don't conflate these.
- **Test cookie size** — measure the Entra JWT size with custom claims and verify it stays under 4KB. If not, store the token server-side and use an opaque session ID in the cookie.
- **Configure token lifetimes** to match or exceed the legacy system's session duration to avoid UX regression.

**Warning signs:**
- Application throws `NullReferenceException` or `KeyNotFoundException` when reading claims
- Users get logged out after ~1 hour (token lifetime mismatch)
- Session corruption manifests as "seeing wrong company data"
- Cookie-related errors in browser developer console

**Phase to address:** Phase 2 (Application Integration) — claim mapping audit and abstraction layer must be built before switching any users to Entra auth.

**Confidence:** HIGH — token format differences are inherent to any custom-to-standard auth migration. The OnTokenIssuanceStart extension for custom claims is verified in official docs (2025-11-25).

---

### Pitfall 8: Dual-Auth Period Creates Security Gaps and Session Confusion

**What goes wrong:**
Running the legacy auth system alongside Entra during staged migration creates security vulnerabilities:

1. **Token replay across systems** — if a user has valid sessions in both systems, a stolen legacy token cannot be invalidated by Entra and vice versa. Revoking access requires coordinating across both systems.
2. **Password drift** — if a user changes their password in Entra, the legacy system still has the old password hash. Users can log in with either password until the legacy system is decommissioned. Conversely, if they reset in the legacy system, their Entra password remains unchanged.
3. **MFA inconsistency** — users migrated to Entra have Entra MFA; users still on legacy have homegrown OTP. If a user is partially migrated (account exists in both), which MFA applies? Support staff face confusion.
4. **Session invalidation gap** — "Lock this user out NOW" (e.g., terminated employee) must work across both systems simultaneously. If the admin only disables the Entra account, the legacy session may remain active.
5. **Audit trail fragmentation** — login events split across two systems make forensic analysis difficult. Correlating a user's activity across both auth systems requires a unified logging layer.

**Why it happens:**
Staged migration is chosen to reduce risk (correct instinct), but the security implications of running dual auth are not fully analyzed. The focus is on user experience, not security posture during transition.

**How to avoid:**
- **Implement a unified session invalidation API** — a single endpoint that disables a user in both systems. Wire this into the HR termination workflow.
- **One-way password sync** — when a user changes password in Entra, propagate the hash (or trigger a reset) in the legacy system. Do NOT sync in the reverse direction.
- **Migrate by company, not by user** — minimize the dual-auth window by migrating entire companies at once. This avoids the "some users in company X are on Entra, some are on legacy" confusion.
- **Decommission legacy auth per company** — after all users in a company are migrated and validated, disable legacy auth for that company immediately.
- **Unified audit log** — stream both legacy auth events and Entra sign-in logs to a single SIEM or log store (Entra supports Azure Monitor integration, verified in docs).
- **Set a hard deadline** for dual-auth — maximum 30 days per company. After that, force-migrate remaining stragglers.

**Warning signs:**
- Terminated employee successfully logs in via the system that wasn't updated
- Support tickets about "my password changed but the old one still works"
- Security audit finds login events not correlated across systems
- Users report being asked for MFA on one login but not another

**Phase to address:** Phase 3 (Staged Rollout) — dual-auth security controls must be designed before the first company is migrated.

**Confidence:** HIGH — dual-auth security risks are inherent to any staged migration. Unified logging via Azure Monitor verified in Entra docs.

---

### Pitfall 9: MFA Enrollment Friction Causes Mass Support Ticket Spike

**What goes wrong:**
Migrating from homegrown OTP to Entra MFA forces all users to re-enroll their MFA method, even though they already use MFA:

1. **No MFA state migration** — you cannot import the legacy OTP enrollment (shared secrets, registered phone numbers) into Entra MFA. Every user must re-register.
2. **First-login wall** — if MFA is enforced from day one, every user's first login post-migration requires MFA setup. For users who struggle with technology (common in HR platforms used by warehouse, factory, and field workers), this creates a support flood.
3. **Phone number format issues** — international users (Mexico/+52 confirmed in requirements) may have phone numbers stored in non-E.164 format in the legacy system. Entra SMS MFA requires E.164 format. A number stored as `555-1234` fails; it must be `+525551234`.
4. **SMS throttling** — Entra enforces telephony limits: 15 texts per phone number per 15 minutes, 20 per hour, 30 per 24 hours (verified: service limits doc). During a mass migration where many users set up MFA simultaneously, these limits can be hit if users retry or make errors.
5. **Email OTP for MFA** — available in Entra, but for users without email, this isn't an option. They must use SMS, which means a valid phone number is required.

**Why it happens:**
Teams assume "users already do MFA, so switching MFA providers is low friction." In reality, the enrollment ceremony is new, the prompts are different, and the user base includes non-technical workers.

**How to avoid:**
- **Pre-register phone numbers** via Graph API during user import. Set the user's `authenticationPhoneMethods` before they first log in. This skips the "enter your phone number" step and goes straight to "enter the code."
- **Normalize all phone numbers to E.164 format** during data preparation. Validate against a phone number library (e.g., libphonenumber).
- **Stagger MFA enrollment** — don't force all 100K users to enroll on the same day. Migrate by company over weeks.
- **Create an MFA enrollment guide** with screenshots, in English and Spanish (for Mexico users). Distribute via company HR departments before migration day.
- **Set up a temporary support escalation path** — dedicated support team for MFA issues during the first 2 weeks of each company's migration.
- **Consider a grace period** — allow users to defer MFA setup for 7 days using Conditional Access policies. This spreads the enrollment load.
- **Monitor SMS throttle headers** — track whether users are hitting the 15-texts-per-15-minutes limit and pre-emptively slow down if needed.

**Warning signs:**
- >5% of users fail MFA enrollment on first attempt
- Support ticket volume exceeds 3x normal within 48 hours of migration
- SMS delivery logs show failures for international numbers
- Users locked out because they exhausted SMS retry limits

**Phase to address:** Phase 2 (Data Preparation) for phone number normalization, Phase 3 (Rollout) for enrollment strategy and support readiness.

**Confidence:** HIGH — SMS throttling limits verified in Entra External ID service limits doc (2025-12-12). MFA re-enrollment requirement is inherent (no migration path for proprietary OTP secrets).

---

### Pitfall 10: Entra External ID Tenant-Level Rate Limits Cause Login Failures During Peak Hours

**What goes wrong:**
Entra External ID has hard tenant-level authentication rate limits that can cause login failures during peak usage:

1. **200 requests per second per tenant** (verified: service limits doc). This is the authentication throughput ceiling for the entire tenant.
2. **20 requests per second per IP** — if ExponentHR users are behind a corporate proxy or NAT, all requests appear from one IP. A company with 500+ users starting work at 8am could exhaust this limit.
3. **Trial tenant limit: 20 requests per second** (same as per-IP limit) — if development/testing is done on a trial tenant, performance testing will be severely throttled.
4. **Sign-up consumes 6 requests** vs sign-in at 4 requests (verified: service limits doc). During JIT migration, users signing up consume 50% more capacity than regular sign-ins.
5. **MFA adds 2 additional requests** per authentication. With MFA enabled, each login consumes 6 requests (sign-in) or 8 requests (sign-up), reducing effective throughput to 25-33 logins/second.

**Why it happens:**
These limits are reasonable for steady-state consumer applications but problematic for enterprise migrations where login patterns are concentrated (morning login rush, post-maintenance restart, etc.).

**How to avoid:**
- **Calculate peak capacity:** At 200 req/sec with 6 req/login (MFA), max throughput is ~33 concurrent logins/second. For 10K users starting within a 30-minute window, you need 10,000 / 1,800 seconds = ~5.5 logins/second sustained, which is comfortable. For 100K users in 30 minutes = 55 logins/second, which exceeds the limit.
- **Stagger migration go-live by company** — don't migrate all companies on the same day.
- **Pre-warm with pre-import** — pre-imported users sign IN (4 requests) vs sign UP (6 requests). Pre-import saves 33% of the per-login request budget.
- **Use a non-trial tenant for load testing** — trial tenants have 10x lower limits.
- **Contact Microsoft support** to understand if limit increases are available for migration periods.
- **Implement login queuing** in the bridge application if needed — display a "please wait" message rather than returning errors during peak.

**Warning signs:**
- Users see Entra error pages during 8-9am login window
- Monitoring shows tenant hitting 200 req/sec
- Per-IP throttling affects offices with NAT/proxy

**Phase to address:** Phase 2 (Capacity Planning) and Phase 3 (Rollout Planning) — load testing must validate peak capacity before production go-live.

**Confidence:** HIGH — all rate limits verified in Entra External ID service limits doc (2025-12-12).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Shadow emails without owning domain | Quick unblock for no-email users | Password reset failures, compliance issues, potential domain squatting | Never — spend the 30 minutes to register the domain |
| Hardcoding claim names instead of mapping layer | Faster initial integration | Every token format change requires code changes across the app | Never — the mapping layer is a 1-day investment |
| Skip phone number normalization | Saves a day of data prep | MFA enrollment failures for international users, ongoing support cost | Never for any deployment with international users |
| Single massive batch import | Simpler script | Rate limit failures, no rollback granularity, long failure recovery | Only if <5,000 users and you can afford to restart |
| No dual-auth session invalidation | Saves integration effort | Security gap during migration window | Only if migration window is <24 hours (big bang) |
| Consumer plan Azure Functions for auth extension | Lower cost (~$0/month) | Cold start failures on every idle period, user-facing errors | Never for production auth paths |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Microsoft Graph API user creation | Using `POST /users` without setting `identities` array correctly | Must include `identities` with `signInType: "userName"` and `issuer: "{tenantId}"` plus a shadow email identity for the email requirement |
| OWIN OIDC Middleware | Using `Authority = "https://{tenant}.ciamlogin.com/"` without explicit MetadataAddress | Set `MetadataAddress` explicitly AND `Authority` to handle the non-standard endpoint |
| Custom Auth Extension registration | Registering the extension but forgetting to grant admin consent to the app registration | Must explicitly grant consent via "Grant permission" button after creating the extension |
| Entra token claims | Expecting legacy claim names in the Entra token | Use OnTokenIssuanceStart extension to add custom claims matching legacy format |
| Conditional Access MFA policies | Applying MFA policy to all users before phone numbers are pre-registered | Apply MFA to groups, add users to the MFA group AFTER pre-registering their phone |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| All users sign up simultaneously on migration day | Entra returns 429/503 errors, users see "service unavailable" | Stagger by company, use pre-import to reduce sign-up load | >33 concurrent logins/second (with MFA) |
| Custom auth extension cold starts | First logins after idle period fail with timeout | Use Premium/App Service plan, implement keep-alive pings | After ~20 minutes of no traffic to the Function App |
| Bridge UI calls legacy auth in the extension path | Extension timeout at 2 seconds, legacy auth takes 3+ seconds | Move legacy validation to bridge UI, before Entra redirect | When legacy system is under any load or has network latency |
| Token cookie exceeds 4KB | Session randomly fails, users cannot stay logged in | Store tokens server-side, use opaque session cookies | When custom claims push JWT beyond 4KB |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Shadow email domain not owned | Attacker registers `exponenthr-auth.com`, receives all password reset emails | Register and lock the domain immediately, even before building anything |
| Legacy auth remains active after user is migrated | Terminated employees can log in via legacy system | Implement unified account disablement across both systems |
| No audit correlation between legacy and Entra auth | Cannot investigate security incidents that span the migration period | Stream both auth logs to a single SIEM |
| MFA bypass during grace period | Users without MFA are vulnerable to credential stuffing | Limit grace period to 7 days max, monitor for suspicious logins during this window |
| Password not reset after pre-import | Imported users retain legacy password forever in Entra (impossible — Entra can't import hashes) | This is actually handled by design: pre-import forces password reset on first login |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Forcing password reset without explanation | Users think they've been hacked, call support | Send pre-migration email explaining the new login process, including the password reset step |
| Username change without notice (collision resolution) | Users can't log in, don't know their new username | Communicate new usernames via company HR, in advance, with lookup tool |
| MFA enrollment without training | Non-technical users abandon login flow | Create step-by-step guide with screenshots, offer phone support during rollout |
| Entra default login page without branding | Users don't trust the new login page, think it's phishing | Configure Entra branding (logo, colors, background) before any user sees it |
| Different login URL without redirect | Bookmarked URLs break | Implement redirect from old login URL to new Entra login |

## "Looks Done But Isn't" Checklist

- [ ] **Shadow email domain:** Registered, DNS configured (MX, SPF, DKIM, DMARC) — verify via `dig MX exponenthr-auth.com`
- [ ] **Password reset flow:** Tested for shadow-email users AND real-email users AND phone-only users — all three paths work
- [ ] **HRA multi-company access:** User with 3 companies can see all 3 in the switcher after Entra login — verify token contains all company mappings
- [ ] **International phone numbers:** +52 (Mexico) numbers receive SMS OTP successfully — test from actual Mexican carrier, not just emulator
- [ ] **Username collision:** All collisions resolved AND post-migration user creation enforces same rules — test creating new user with colliding username
- [ ] **Login page branding:** Logo, colors, company name visible on Entra login page — test on mobile and desktop
- [ ] **Token refresh:** Users stay logged in for the expected session duration (not just 1 hour) — monitor token refresh success rate
- [ ] **Dual-auth shutdown:** After migrating a company, legacy auth is actually disabled for that company — test legacy login attempt returns error
- [ ] **Rate limit headroom:** Peak login scenario tested and stays below 200 req/sec — run load test during realistic time window
- [ ] **Custom auth extension monitoring:** Alerts configured for timeout (>1500ms) and error rate (>1%) — trigger test alert

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Shadow domain squatted by third party | HIGH | Legal action to reclaim domain, or switch to new shadow domain and re-map all user emails via Graph API bulk update |
| Username collisions cause wrong company mapping | HIGH | Emergency hotfix to mapping table, audit all logins since migration, notify affected users |
| Graph API import halted by rate limits | MEDIUM | Resume from checkpoint (implement idempotent import), request Microsoft support intervention |
| Custom auth extension down | MEDIUM | If extension is for claim enrichment: deploy fallback that returns empty claims, app fetches on-demand. If for auth validation: rollback to legacy auth |
| MFA enrollment failure spike | LOW | Extend MFA grace period via Conditional Access policy change, spin up additional support staff |
| Token format breaks sessions | HIGH | Emergency deployment of claim mapping layer, or rollback to legacy auth for affected users |
| Login page not trusted by users | LOW | Emergency branding update, send company-wide communication confirming legitimacy |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Shadow email domain risks | Phase 1 (Infrastructure) | DNS records verified, domain ownership confirmed |
| Custom auth extension can't skip email | Phase 1 (POC/Strategy Decision) | POC demonstrates working sign-up flow with shadow email |
| Graph API rate limits | Phase 2 (Migration Tooling) | Import script completes 1,000-user test batch without 429 errors |
| Username collision misrouting | Phase 1 (Data Analysis) | Collision report reviewed, resolution strategy approved by product owner |
| .NET Framework OIDC incompatibility | Phase 1 (POC/Spike) | Minimal POC app authenticates via ciamlogin.com endpoint |
| Custom auth extension timeout | Phase 2 (Extension Development) | Load test shows p95 response time <1000ms |
| Token format breaks sessions | Phase 2 (Application Integration) | Claim mapping layer tested with both legacy and Entra tokens |
| Dual-auth security gaps | Phase 3 (Rollout Planning) | Unified session invalidation API tested, termination workflow verified |
| MFA enrollment friction | Phase 3 (Rollout) | Phone numbers pre-registered, enrollment guide distributed |
| Tenant rate limits at peak | Phase 3 (Load Testing) | Peak scenario stays under 200 req/sec |

## Sources

- Microsoft Learn: [Entra External ID Service Limits](https://learn.microsoft.com/en-us/entra/external-id/customers/reference-service-limits) (2025-12-12) — **HIGH confidence**: rate limits, telephony limits, timeout/retry limits, configuration limits
- Microsoft Learn: [Custom Authentication Extensions Concept](https://learn.microsoft.com/en-us/entra/external-id/customers/concept-custom-extensions) (2025-04-10) — **HIGH confidence**: OnAttributeCollectionStart/Submit event behavior, what actions are available
- Microsoft Learn: [Custom Extension Attribute Collection Implementation](https://learn.microsoft.com/en-us/entra/identity-platform/custom-extension-attribute-collection) (2025-09-16) — **HIGH confidence**: REST API patterns, Azure Function implementation, setPrefillValues/modifyAttributeValues actions
- Microsoft Learn: [Custom Authentication Extensions Overview](https://learn.microsoft.com/en-us/entra/identity-platform/custom-extension-overview) (2025-11-25) — **HIGH confidence**: event types, REST API requirements, token validation
- Microsoft Learn: [Create User Flow](https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-user-flow-sign-up-sign-in-customers) (2025-09-16) — **HIGH confidence**: sign-up requires email identity provider
- Microsoft Learn: [Define Custom Attributes](https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-define-custom-attributes) (2025-09-16) — **HIGH confidence**: hidden/editable flags, b2c-extensions-app, Graph API configuration
- Microsoft Learn: [Manage Customer Accounts](https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-manage-customer-accounts) (2025-04-25) — **HIGH confidence**: admin-created accounts, password reset
- Microsoft Learn: [Microsoft Graph Throttling Limits](https://learn.microsoft.com/en-us/graph/throttling-limits) (2026-02-06) — **HIGH confidence**: Identity & Access write quotas, resource unit costs, B2C cost multiplier
- Microsoft Learn: [Supported Features in External Tenants](https://learn.microsoft.com/en-us/entra/external-id/customers/concept-supported-features-customers) (2025-11-17) — **HIGH confidence**: feature comparison, authentication methods, OIDC support
- Microsoft Learn: [OpenID Connect on Microsoft Identity Platform](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc) (2026-01-09) — **HIGH confidence**: OIDC protocol, authority URL, token validation

---
*Pitfalls research for: ExponentHR Identity Migration to Entra External ID*
*Researched: 2026-02-11*
