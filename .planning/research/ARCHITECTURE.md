# Architecture Research: ExponentHR Identity Migration

**Domain:** Enterprise identity migration — proprietary auth to Microsoft Entra External ID
**Researched:** 2026-02-11
**Confidence:** MEDIUM-HIGH (official Microsoft docs verified; .NET Framework OWIN integration details are MEDIUM due to age of pattern)

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                                    │
│   ExponentHR Login Page → Entra-Themed Sign-In → ExponentHR App         │
└───────────────┬───────────────────┬────────────────────┬────────────────┘
                │                   │                    │
                ▼                   ▼                    ▼
┌───────────────────┐  ┌───────────────────────┐  ┌──────────────────────┐
│  ENTRA EXTERNAL   │  │   CUSTOM AUTH         │  │   EXPONENTHR APP     │
│  ID TENANT        │  │   EXTENSIONS          │  │   (.NET Framework)   │
│                   │  │   (Azure Functions)   │  │                      │
│  ┌─────────────┐  │  │                       │  │  ┌────────────────┐  │
│  │ User Flow   │──┼──┤  OnAttributeCollStart │  │  │ OWIN OIDC      │  │
│  │ (Sign-up/   │  │  │  OnAttributeCollSubmit│  │  │ Middleware     │  │
│  │  Sign-in)   │  │  │  OnTokenIssuanceStart │  │  │                │  │
│  └──────┬──────┘  │  └───────────┬───────────┘  │  └───────┬────────┘  │
│         │         │              │               │          │           │
│  ┌──────┴──────┐  │              │               │  ┌───────┴────────┐  │
│  │ Branding &  │  │              │               │  │ Auth Service   │  │
│  │ Language    │  │              │               │  │ (Adapter Layer)│  │
│  └─────────────┘  │              │               │  └───────┬────────┘  │
│                   │              │               │          │           │
│  ┌─────────────┐  │  ┌───────────┴───────────┐  │  ┌───────┴────────┐  │
│  │ Conditional │  │  │  ExponentHR Legacy     │  │  │ Company        │  │
│  │ Access /MFA │  │  │  Auth DB (read-only    │  │  │ Switcher       │  │
│  └─────────────┘  │  │  during migration)     │  │  │ (Unchanged)    │  │
│                   │  └───────────────────────────┘  └────────────────┘  │
│  ┌─────────────┐  │                               │                    │
│  │ Username/   │  │                               │                    │
│  │ Alias Sign- │  │                               │                    │
│  │ In (Preview)│  │                               │                    │
│  └─────────────┘  │                               │                    │
└───────────────────┘                               └────────────────────┘
        │                                                     │
        ▼                                                     │
┌───────────────────┐                                         │
│  MIGRATION        │                                         │
│  TOOLING          │                                         │
│                   │                                         │
│  ┌─────────────┐  │                                         │
│  │ Graph API   │  │  (Pre-import: batch user creation)      │
│  │ Client      │──┼─────────────────────────────────────────┘
│  └─────────────┘  │
│  ┌─────────────┐  │
│  │ Collision   │  │
│  │ Resolver    │  │
│  └─────────────┘  │
│  ┌─────────────┐  │
│  │ Validation/ │  │
│  │ Reporting   │  │
│  └─────────────┘  │
└───────────────────┘
```

## Component Responsibilities

| Component | Responsibility | Communicates With | Implementation |
|-----------|----------------|-------------------|----------------|
| **Entra External ID Tenant** | Central identity store; user authentication; token issuance; MFA enforcement | User browser, Custom Auth Extensions, Graph API Client | Azure portal configuration |
| **User Flow** | Defines sign-up/sign-in experience; attribute collection; identity provider selection | Entra tenant, Custom Auth Extensions, Application | Entra admin center config (max 10 per tenant) |
| **Username/Alias Sign-In** | Allows users to sign in with non-email identifier (preview feature) | User Flow, Entra user store | Entra sign-in identifier policy + Graph API identity setup |
| **Custom Auth Extensions** | Business logic at sign-up/sign-in extensibility points; legacy credential validation; claim enrichment | Entra User Flow (caller), Legacy Auth DB (data), Azure Function host | Azure Functions (.NET) — REST API endpoints |
| **OnAttributeCollectionStart** | Pre-fill attribute values; block sign-up based on conditions | Called by User Flow before attribute page renders | Azure Function returning prefill/block/continue actions |
| **OnAttributeCollectionSubmit** | Validate submitted attributes; modify values; block based on validation | Called by User Flow after user submits attributes | Azure Function returning continue/block/modify/error actions |
| **OnTokenIssuanceStart** | Enrich tokens with claims from external systems (ExponentHR roles, company access, HRA status) | Called by Entra just before token issuance; reads ExponentHR DB | Azure Function returning custom claims |
| **OWIN OIDC Middleware** | Receives Entra OIDC tokens; validates signatures; extracts claims; creates .NET ClaimsPrincipal | ExponentHR app ↔ Entra External ID tenant | Microsoft.Owin.Security.OpenIdConnect NuGet package |
| **Auth Service (Adapter)** | Translates Entra claims into ExponentHR internal session; maps Entra user to employee record(s) | OIDC Middleware → ExponentHR session/context | Modified existing auth service in ExponentHR |
| **Company Switcher** | Post-auth selection of company/employee/environment for HRA users | Auth Service (reads mapped companies from Entra claims or DB) | Existing ExponentHR code — unchanged |
| **Migration Tooling** | Pre-import users via Graph API; resolve username collisions; validate data; generate reports | Graph API → Entra tenant; ExponentHR user DB | Standalone .NET console app or script |
| **Graph API Client** | Creates/updates user accounts in Entra with email + username identities | Entra tenant (writes), ExponentHR DB (reads) | Microsoft.Graph SDK |
| **Conditional Access** | Enforces MFA policy; groups-based policy for phone-only MFA users | Entra tenant | Entra admin center policy config |
| **Branding** | ExponentHR-themed login pages; custom CSS, logos, colors | Entra tenant sign-in pages | Entra admin center Company Branding |
| **Legacy Auth DB** | Source of truth for existing user credentials during migration; read-only reference | Custom Auth Extensions (seamless migration reads), Migration Tooling | Existing SQL database |

## Data Flow: Strategy A — Pre-Import via Graph API

**Recommended strategy.** Higher upfront effort but more controlled migration with fewer runtime risks.

### Phase 1: Pre-Import (Before Go-Live)

```
ExponentHR User DB
    │
    ▼
┌──────────────────────┐
│ Migration Tooling    │
│                      │
│ 1. Read all users    │
│ 2. Resolve username  │
│    collisions        │
│    (companyPrefix_   │
│     username)        │
│ 3. Generate shadow   │
│    emails for users  │
│    without email     │
│ 4. Create via Graph  │──────────► Entra External ID
│    API with:         │           ┌─────────────────────┐
│    - emailAddress    │           │ identities: [       │
│      identity        │           │   {signInType:      │
│    - userName         │           │    "emailAddress",  │
│      identity        │           │    issuerAssignedId: │
│    - forceChange     │           │    "user@domain"},   │
│      PasswordNext    │           │   {signInType:      │
│      SignIn: true    │           │    "userName",       │
│ 5. Set extension     │           │    issuerAssignedId: │
│    attributes        │           │    "jsmith_acme"}    │
│    (companyId,       │           │ ]                    │
│     employeeIds,     │           │ mail: "..."          │
│     HRA flag)        │           │ passwordProfile:     │
│ 6. Generate report   │           │   {forceChange...}   │
└──────────────────────┘           └─────────────────────┘
```

**Key decisions in this flow:**
- **Username collision resolution**: Prefix with company identifier: `acme_jsmith` instead of `jsmith`. Both email and username identities are set via Graph API.
- **No-email users**: Generate shadow email like `{userId}@exponenthr-auth.com`. This email is the `emailAddress` identity in Entra. The user never sees or uses this email — they sign in with username.
- **Password**: Set `forceChangePasswordNextSignIn: true`. User must reset password on first login. Entra CANNOT import password hashes from custom auth systems.
- **Extension attributes**: Store ExponentHR-specific data (companyId, employeeId mappings, HRA flag) as custom extension attributes via Graph API. These are read by OnTokenIssuanceStart to enrich tokens.

### Phase 2: Go-Live Sign-In Flow (Post-Migration)

```
User enters username + password
         │
         ▼
┌─────────────────────┐
│ ExponentHR App      │
│ (OWIN OIDC)         │
│                     │
│ Redirect to Entra   │──────► Entra External ID
│ /authorize endpoint │       ┌──────────────────────┐
│                     │       │ User Flow executes:  │
│                     │       │                      │
│                     │       │ 1. Username/alias    │
│                     │       │    lookup             │
│                     │       │ 2. Password verify    │
│                     │       │    (or force reset    │
│                     │       │    on first login)    │
│                     │       │ 3. MFA challenge      │
│                     │       │    (SMS or email OTP) │
│                     │       │ 4. OnTokenIssuance    │
│                     │       │    Start event fires  │
│                     │       │         │             │
│                     │       │         ▼             │
│                     │       │  ┌────────────────┐   │
│                     │       │  │ Azure Function │   │
│                     │       │  │ Reads extension│   │
│                     │       │  │ attributes or  │   │
│                     │       │  │ ExponentHR DB  │   │
│                     │       │  │                │   │
│                     │       │  │ Returns claims:│   │
│                     │       │  │ - companyIds   │   │
│                     │       │  │ - employeeIds  │   │
│                     │       │  │ - isHRA        │   │
│                     │       │  │ - permissions  │   │
│                     │       │  └────────────────┘   │
│                     │       │                      │
│                     │       │ 5. Issue ID token +  │
│                     │       │    access token with │
│                     │       │    custom claims     │
│                     │       └──────────┬───────────┘
│                     │                  │
│ ◄───────────────────┼──────────────────┘
│ Receive token at    │         (Authorization Code flow
│ /signin-oidc        │          with PKCE)
│                     │
│ OWIN middleware      │
│ validates token,     │
│ extracts claims,     │
│ creates session      │
│                     │
│ Auth Service maps    │
│ claims to internal   │
│ session context:     │
│ - If single company  │
│   → direct to app   │
│ - If HRA/multiple   │
│   → company switcher│
└─────────────────────┘
```

### First Login Experience (Strategy A)

```
User navigates to ExponentHR
         │
         ▼
OWIN redirects to Entra sign-in
         │
         ▼
User enters username (e.g., "acme_jsmith")
         │
         ▼
Entra prompts for password
         │
         ▼
forceChangePasswordNextSignIn = true
    → Entra forces password reset
         │
         ▼
User sets new password
         │
         ▼
MFA challenge (SMS or email OTP)
         │
         ▼
Token issued with custom claims
         │
         ▼
User lands in ExponentHR
```

## Data Flow: Strategy B — JIT Migration with Seamless Password Migration

**Higher-risk strategy.** More transparent to users but complex runtime behavior and harder to debug.

### Runtime Flow (During Migration Period)

```
User navigates to ExponentHR
         │
         ▼
┌─────────────────────┐
│ Bridge/Interstitial │  ← NEW component (temporary)
│ UI Page             │
│                     │
│ "Enter your current │
│  username and       │
│  password"          │
│                     │
│ User enters legacy  │
│ credentials         │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Migration API       │  ← NEW component (temporary)
│ (Azure Function or  │
│  ExponentHR API)    │
│                     │
│ 1. Validate creds   │──────► Legacy Auth DB
│    against legacy   │       (verify username+password)
│    auth system      │
│                     │
│ 2. If valid:        │
│    Check if Entra   │──────► Graph API
│    account exists   │       (GET user by username)
│                     │
│ 3a. If NO account:  │
│    Create via Graph  │──────► Graph API
│    API:             │       POST /users
│    - shadow email   │       {identities: [...],
│    - username       │        passwordProfile: {
│    - REAL password  │          password: <user's
│      (known from    │          actual password>,
│      step 1)        │          forceChange: false}}
│    - extension attrs│
│                     │
│ 3b. If account      │
│     exists but not  │
│     migrated:       │
│    Update password  │──────► Graph API
│    via Graph API    │       PATCH /users/{id}
│                     │
│ 4. Mark user as     │
│    migrated         │──────► Extension attribute
│    (extension attr) │       isMigrated: true
│                     │
│ 5. Redirect to      │
│    Entra sign-in    │──────► Entra /authorize
│    (user can now    │
│    sign in with     │
│    same password)   │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ Standard Entra      │
│ Sign-In Flow        │
│ (same as Strategy A │
│  post-migration)    │
└─────────────────────┘
```

### Critical Concerns with Strategy B

1. **Email requirement at sign-up**: Entra External ID requires email for sign-UP (account creation). Username sign-in is supported, but sign-up requires an email identity. Strategy B works around this by creating accounts via Graph API (which bypasses the user flow sign-up), so the email requirement during interactive sign-up is sidestepped.

2. **Custom auth extensions timing**: The OnAttributeCollectionStart and OnAttributeCollectionSubmit events fire DURING the user flow sign-up. They cannot bypass the email requirement — they operate on attribute values after email has been established. **This means using custom auth extensions to skip email during interactive sign-up is NOT feasible** (HIGH confidence — verified against official docs).

3. **Bridge UI is a temporary custom component**: Must be built, tested, and eventually decommissioned. Adds surface area for bugs and security issues during the migration window.

4. **Password handling**: Strategy B has the advantage of capturing the user's actual password and setting it in Entra, avoiding a forced password reset. But this means the bridge UI temporarily handles plaintext passwords — security surface area.

## Token Flow: From Custom Tokens to Entra OIDC Tokens

### Current State (Proprietary)

```
User → ExponentHR Auth Service → Custom Token (proprietary format)
     → ExponentHR App reads custom token → Session
```

### Target State (Entra OIDC)

```
User → Entra External ID → OIDC ID Token + Access Token (JWT, standard)
     → OWIN Middleware validates JWT → ClaimsPrincipal
     → Auth Service Adapter maps claims → ExponentHR Session
```

### Token Structure (Target)

```json
{
  "iss": "https://exponenthr.ciamlogin.com/{tenantId}/v2.0",
  "sub": "{entra_user_object_id}",
  "aud": "{exponenthr_client_id}",
  "exp": 1700000000,
  "iat": 1700000000,
  "auth_time": 1700000000,
  "acr": "b2c_1a_signup_signin",

  // Standard claims
  "name": "John Smith",
  "preferred_username": "acme_jsmith",

  // Custom claims (from OnTokenIssuanceStart extension)
  "extension_companyIds": ["ACME", "GLOBEX"],
  "extension_employeeIds": ["EMP001", "EMP002"],
  "extension_isHRA": true,
  "extension_primaryCompanyId": "ACME"
}
```

### OWIN OIDC Middleware Configuration (.NET Framework)

```csharp
// Startup.Auth.cs — OWIN pipeline configuration
public void ConfigureAuth(IAppBuilder app)
{
    app.SetDefaultSignInAsAuthenticationType(
        CookieAuthenticationDefaults.AuthenticationType);

    app.UseCookieAuthentication(new CookieAuthenticationOptions());

    app.UseOpenIdConnectAuthentication(new OpenIdConnectAuthenticationOptions
    {
        ClientId = "{exponenthr_client_id}",
        Authority = "https://exponenthr.ciamlogin.com/{tenantId}/v2.0",
        RedirectUri = "https://app.exponenthr.com/signin-oidc",
        PostLogoutRedirectUri = "https://app.exponenthr.com/",
        Scope = "openid profile",
        ResponseType = "code id_token",

        TokenValidationParameters = new TokenValidationParameters
        {
            NameClaimType = "name",
            ValidateIssuer = true
        },

        Notifications = new OpenIdConnectAuthenticationNotifications
        {
            SecurityTokenValidated = async context =>
            {
                // Extract custom claims from Entra token
                var identity = context.AuthenticationTicket.Identity;
                var companyIds = identity.FindFirst("extension_companyIds")?.Value;
                var isHRA = identity.FindFirst("extension_isHRA")?.Value;

                // Map to ExponentHR internal session
                // (replaces old custom token processing)
            },
            AuthenticationFailed = context =>
            {
                context.HandleResponse();
                context.Response.Redirect("/Error?message=" +
                    context.Exception.Message);
                return Task.FromResult(0);
            }
        }
    });
}
```

**Confidence:** MEDIUM — OWIN OIDC is a well-established pattern for .NET Framework, but Entra External ID's `ciamlogin.com` authority endpoint with OWIN specifically needs validation. Microsoft's official samples target ASP.NET Core with MSAL, not .NET Framework with OWIN. The OIDC protocol is standard, so the middleware should work, but the exact authority URL format and metadata endpoint compatibility need testing.

## Architectural Patterns

### Pattern 1: Auth Service Adapter (Strangler Fig)

**What:** Keep the existing ExponentHR auth service interface but replace its internals to consume Entra OIDC tokens instead of generating custom tokens. Existing code that checks auth status continues to work against the same interface.

**When to use:** When you can't refactor all auth consumers at once. The auth service becomes a thin adapter translating OIDC claims to the internal session format.

**Trade-offs:**
- Pro: Minimal changes to downstream ExponentHR code
- Pro: Can be done incrementally
- Con: Temporary duplication of auth logic during migration window
- Con: Must eventually clean up the adapter layer

**Example:**
```csharp
// Before: Custom token processing
public UserSession Authenticate(string customToken)
{
    var claims = CustomTokenParser.Parse(customToken);
    return new UserSession(claims.UserId, claims.CompanyId, claims.EmployeeId);
}

// After: OIDC claims processing (same interface, different internals)
public UserSession Authenticate(ClaimsPrincipal principal)
{
    var companyIds = principal.FindFirst("extension_companyIds")?.Value;
    var employeeIds = principal.FindFirst("extension_employeeIds")?.Value;
    var isHRA = principal.FindFirst("extension_isHRA")?.Value == "true";

    if (isHRA)
        return new UserSession(principal.Identity.Name, companyIds, employeeIds, isHRA);
    else
        return new UserSession(principal.Identity.Name, companyIds.First(), employeeIds.First());
}
```

### Pattern 2: Custom Claims Provider for ExponentHR Context

**What:** Use the OnTokenIssuanceStart custom authentication extension to look up the user's ExponentHR-specific data (company associations, employee records, HRA status) and inject it as custom claims in the Entra-issued token.

**When to use:** When ExponentHR needs authorization context beyond what Entra stores natively. This is the pattern for mapping an Entra user back to ExponentHR's domain model.

**Trade-offs:**
- Pro: Token is self-contained with all needed claims — no additional DB lookup on every request
- Pro: Standard OIDC pattern; works with any OIDC consumer
- Con: Token size increases with claim count (concern for HRA users with many companies)
- Con: Claims are snapshot at token issuance — stale until token refresh
- Con: Azure Function adds latency to every token issuance (~50-200ms)

**Confidence:** HIGH — This is the documented, supported pattern for enriching tokens in Entra External ID.

### Pattern 3: Dual-Auth Transition Window

**What:** During migration, both the legacy auth system and Entra External ID are active. ExponentHR checks both authentication paths and routes accordingly.

**When to use:** If doing staged/phased rollout rather than big-bang cutover.

**Trade-offs:**
- Pro: Allows gradual migration — can roll back individual users/companies
- Pro: Reduces blast radius of bugs
- Con: Significant complexity — two auth paths in production
- Con: Must maintain legacy auth system during transition
- Con: Testing matrix doubles

**Recommendation:** Avoid if possible within 90-day timeline. Big-bang with pre-import (Strategy A) is simpler and more testable. Reserve dual-auth only if rollout must be staged by company.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Authorization Data Only in Entra Extension Attributes

**What people do:** Store all company/employee/role mappings in Entra extension attributes, treating Entra as the authorization database.

**Why it's wrong:** Entra extension attributes are limited (15 extension properties per application, up to 250 characters per string attribute). Complex authorization data like HRA multi-company mappings don't fit well. Also, updating these attributes requires Graph API calls, adding latency and complexity.

**Do this instead:** Use the OnTokenIssuanceStart custom extension to query ExponentHR's own database at token issuance time. Keep ExponentHR's database as the source of truth for authorization. Entra stores identity; ExponentHR stores authorization.

### Anti-Pattern 2: Building a Fully Custom Login UI

**What people do:** Build a complete custom sign-in/sign-up UI instead of using Entra's themed pages. This includes handling password input, MFA challenges, error flows in custom code.

**Why it's wrong:** Entra External ID's native authentication feature (for fully custom UI) is available but adds massive complexity. You take on responsibility for MFA challenge rendering, error handling, session management, and security hardening. For a migration project with a 90-day timeline, this is scope creep.

**Do this instead:** Use Entra's themed login pages with Company Branding customization. You can customize logos, colors, background images, text, layout, and even upload custom CSS. This covers "ExponentHR-branded" without building a custom UI.

### Anti-Pattern 3: Trying to Bypass Email Requirement During Interactive Sign-Up

**What people do:** Attempt to use custom authentication extensions (OnAttributeCollectionStart with setPrefillValues) to auto-fill the email field and skip the email verification step during interactive sign-up.

**Why it's wrong:** The attribute collection events fire AFTER the initial email submission step. The email field and verification are part of the identity provider's core sign-up flow, not the attribute collection step. Custom auth extensions cannot bypass this. (Verified: Microsoft docs state OnAttributeCollectionStart "occurs at the beginning of the attribute collection step, before the attribute collection page renders" — this is the attribute collection step, NOT the identity/email step.)

**Do this instead:** Create accounts via Graph API (pre-import) which bypasses interactive sign-up entirely. Or use the Bridge UI + Graph API approach (Strategy B) where accounts are created programmatically.

### Anti-Pattern 4: Running Legacy Auth and Entra in Parallel Without Clear Routing

**What people do:** Enable both auth systems without deterministic routing, hoping users "figure it out" or relying on timing.

**Why it's wrong:** Creates confused state where some requests go to legacy auth and some to Entra. Session conflicts, token format mismatches, and debugging nightmares.

**Do this instead:** If parallel operation is needed, route by company ID or user cohort with explicit feature flags. Every request has ONE auth path, deterministically chosen.

## Component Build Order

The build order is dictated by dependencies between components. Each layer requires the previous one to function.

### Phase 1: Foundation (Weeks 1-3)

**Build first — everything else depends on this.**

| Order | Component | Depends On | Deliverable |
|-------|-----------|------------|-------------|
| 1.1 | Entra External ID Tenant | Azure subscription | Configured tenant with custom domain |
| 1.2 | App Registration | Tenant (1.1) | Client ID, client secret, redirect URIs |
| 1.3 | User Flow | Tenant (1.1) | Sign-up/sign-in flow with "Email with password" |
| 1.4 | Username/Alias Sign-In Policy | User Flow (1.3) | Username enabled as sign-in identifier |
| 1.5 | Company Branding | Tenant (1.1) | ExponentHR logo, colors, background on login pages |
| 1.6 | MFA Configuration | Tenant (1.1) | SMS + Email OTP as second-factor methods; Conditional Access policy |

### Phase 2: Integration Layer (Weeks 3-5)

**Connects Entra to ExponentHR.**

| Order | Component | Depends On | Deliverable |
|-------|-----------|------------|-------------|
| 2.1 | OWIN OIDC Middleware | App Registration (1.2) | ExponentHR .NET Framework app redirects to Entra for login |
| 2.2 | Auth Service Adapter | OWIN Middleware (2.1) | Entra OIDC claims mapped to ExponentHR session format |
| 2.3 | OnTokenIssuanceStart Extension | Tenant (1.1), App Registration | Azure Function returns ExponentHR claims (companyIds, HRA, etc.) |
| 2.4 | Claims Mapping Policy | Extension (2.3), App Registration (1.2) | Custom claims appear in tokens issued to ExponentHR |
| 2.5 | Company Switcher Integration | Auth Service Adapter (2.2) | HRA users see company selector populated from Entra token claims |

### Phase 3: Migration Tooling (Weeks 4-6, overlaps Phase 2)

**Can be built in parallel with Phase 2.**

| Order | Component | Depends On | Deliverable |
|-------|-----------|------------|-------------|
| 3.1 | Username Collision Analysis | ExponentHR DB access | Report of all collisions across companies |
| 3.2 | Collision Resolution Strategy | Analysis (3.1) | Algorithm: `{companyCode}_{username}` with mapping table |
| 3.3 | Shadow Email Generation | ExponentHR DB access | Generate `{userId}@exponenthr-auth.com` for no-email users |
| 3.4 | Graph API Batch Import Tool | Tenant (1.1), Collision Resolution (3.2), Shadow Emails (3.3) | Console app creating users via Graph API with email + username identities |
| 3.5 | Validation & Dry-Run | Import Tool (3.4) | Dry-run mode that reports what would be created without writing |
| 3.6 | Migration Report Generator | Import Tool (3.4) | Per-user report: old username → new username, email used, status |

### Phase 4: Testing & Cutover (Weeks 6-8)

| Order | Component | Depends On | Deliverable |
|-------|-----------|------------|-------------|
| 4.1 | E2E Test Suite | Phases 2 + 3 | Test login, MFA, company switch, HRA flow, password reset |
| 4.2 | Staged Pilot | Test Suite (4.1) | Small cohort of users migrated and tested |
| 4.3 | Batch Import Execution | Pilot validated (4.2) | All users imported to Entra |
| 4.4 | DNS/Routing Cutover | Import complete (4.3) | ExponentHR login points to Entra |
| 4.5 | Legacy Auth Decommission | Cutover stable (4.4) | Legacy auth service disabled (after monitoring period) |

### Phase 5: Hardening (Weeks 8-10)

| Order | Component | Depends On | Deliverable |
|-------|-----------|------------|-------------|
| 5.1 | Monitoring & Alerting | All production components | Azure Monitor, sign-in logs, failure alerts |
| 5.2 | Support Tooling | Production environment | Admin tools for password reset, account lookup, troubleshooting |
| 5.3 | User Communication | Migration plan finalized | Welcome emails with new login instructions |
| 5.4 | Rollback Plan | All components | Documented procedure to revert to legacy auth if needed |

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Microsoft Graph API | REST API via Microsoft.Graph SDK; OAuth2 client_credentials flow | Used for user CRUD, extension attributes; rate limits apply (throttling at ~10k requests/10min for batch operations) |
| Entra External ID | OIDC redirect-based flow (authorization code + PKCE) | Authority URL: `https://{subdomain}.ciamlogin.com/{tenantId}/v2.0`; metadata at `.well-known/openid-configuration` |
| Azure Functions | REST API called by Entra via HTTP with bearer token (client_credentials) | Must validate incoming tokens; protected by Azure App Service auth or manual validation |
| SMS Provider (Entra-managed) | Entra handles SMS delivery for MFA | SMS is add-on cost; requires linked Azure subscription; Mexico (+52) needs opt-in region check |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| OWIN Middleware ↔ Auth Service Adapter | In-process (.NET ClaimsPrincipal passed through pipeline) | No network hop; adapter reads claims from `HttpContext.User` |
| Auth Service Adapter ↔ Company Switcher | In-process (existing ExponentHR session object) | Company switcher reads session.CompanyIds — interface unchanged, source changes from custom token to OIDC claims |
| Migration Tooling ↔ ExponentHR DB | Direct SQL read (connection string to user/employee tables) | Read-only during migration; no writes to production DB |
| Custom Auth Extensions ↔ ExponentHR DB | SQL query or internal API call from Azure Function | Azure Function needs network access to ExponentHR DB (VNet integration or public endpoint with auth) |
| Custom Auth Extensions ↔ Entra | HTTP callback (Entra calls the Azure Function REST endpoint) | Entra sends auth context in request body; function returns action response |

## Scaling Considerations

| Concern | At 10K Users | At 100K Users |
|---------|--------------|---------------|
| Graph API batch import | ~1-2 hours with throttling management | ~10-20 hours; needs batching with exponential backoff; consider running over a weekend |
| Token issuance latency | Negligible — Azure Function cold start is primary concern; use Premium plan for warm instances | Same; Azure Function Premium Plan recommended to avoid cold starts |
| MFA SMS delivery | Standard throughput sufficient | Check SMS throttling limits per tenant; may need to stagger migration cohorts |
| Entra tenant user limit | Well within limits | External tenant supports millions of users; no concern |
| Migration tooling memory | Can process all users in memory | May need streaming/paging approach for Graph API reads |

## Key Architectural Decisions

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| Migration strategy | **Strategy A (Pre-Import)** | More controlled; username collisions resolved upfront; no runtime bridge UI; users expect a password reset (common in platform changes); simpler architecture with fewer temporary components |
| Username format | `{companyCode}_{username}` | Globally unique; preserves original username as suffix; company code is short and memorable; can be communicated clearly |
| No-email users | Shadow email `{userId}@exponenthr-auth.com` with SMS-only MFA | Entra requires email identity for account creation; shadow email is never shown to user; MFA via SMS ensures they can recover access |
| Token enrichment | OnTokenIssuanceStart custom extension | Self-contained tokens; ExponentHR DB remains authorization source of truth; standard OIDC pattern |
| .NET Framework integration | OWIN OIDC middleware | Only supported OIDC middleware for .NET Framework (not Core); well-established pattern; NuGet: Microsoft.Owin.Security.OpenIdConnect |
| MFA method | SMS + Email OTP via Conditional Access | SMS for all users (including no-email); Email OTP as additional option; replaces homegrown OTP |

## Sources

- [Entra External ID Planning Guide](https://learn.microsoft.com/en-us/entra/external-id/customers/concept-planning-your-solution) — Official, updated 2025-10-02 (HIGH confidence)
- [Custom Authentication Extensions](https://learn.microsoft.com/en-us/entra/external-id/customers/concept-custom-extensions) — Official, updated 2025-04-10 (HIGH confidence)
- [User Migration Guide](https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-migrate-users) — Official, updated 2025-05-20 (HIGH confidence)
- [Username/Alias Sign-In (Preview)](https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-sign-in-alias) — Official, updated 2025-10-28 (HIGH confidence — feature is in preview)
- [Identity Providers for External Tenants](https://learn.microsoft.com/en-us/entra/external-id/customers/concept-authentication-methods-customers) — Official, updated 2025-10-28 (HIGH confidence)
- [MFA in External Tenants](https://learn.microsoft.com/en-us/entra/external-id/customers/concept-multifactor-authentication-customers) — Official, updated 2025-11-18 (HIGH confidence)
- [Security Fundamentals for External Tenants](https://learn.microsoft.com/en-us/entra/external-id/customers/concept-security-customers) — Official, updated 2026-01-28 (HIGH confidence)
- [Custom Extensions for Attribute Collection](https://learn.microsoft.com/en-us/entra/identity-platform/custom-extension-attribute-collection) — Official, updated 2025-09-16 (HIGH confidence)
- [Token Issuance Start Event](https://learn.microsoft.com/en-us/entra/identity-platform/custom-extension-tokenissuancestart-setup) — Official, updated 2025-05-04 (HIGH confidence)
- [Company Branding Customization](https://learn.microsoft.com/en-us/entra/external-id/customers/concept-branding-customers) — Official, updated 2025-01-07 (HIGH confidence)
- [Managing Customer Accounts](https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-manage-customer-accounts) — Official, updated 2025-04-25 (HIGH confidence)
- [Graph API User Creation with Identities](https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-sign-in-alias) — Graph API example in alias doc (HIGH confidence)
- OWIN OIDC Middleware for .NET Framework — Pattern well-established but Entra External ID `ciamlogin.com` endpoint compatibility unverified with OWIN specifically (MEDIUM confidence — needs spike)

---
*Architecture research for: ExponentHR Identity Migration to Entra External ID*
*Researched: 2026-02-11*
