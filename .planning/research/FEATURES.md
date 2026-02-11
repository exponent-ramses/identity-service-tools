# Feature Research: ExponentHR Identity Migration to Entra External ID

**Domain:** Enterprise identity migration — proprietary auth to Microsoft Entra External ID
**Researched:** 2026-02-11
**Confidence:** MEDIUM-HIGH (critical features verified against official Microsoft docs)

---

## Critical Technical Findings

Before the feature landscape, these findings from official Microsoft documentation fundamentally shape what's feasible and what isn't. Every feature below is informed by these findings.

### Finding 1: Email CAN Be Hidden During Sign-Up (HIGH confidence)

**Source:** [Microsoft Graph API — Update authenticationEventsFlow](https://learn.microsoft.com/en-us/graph/api/authenticationeventsflow-update#example-2-update-the-page-layout-of-a-self-service-sign-up-user-flow) (official docs, Example 2)

The official Microsoft documentation includes a literal example of hiding the email attribute on the sign-up page:

```json
{
  "attribute": "email",
  "label": "Email Address",
  "inputType": "text",
  "hidden": true,
  "editable": false,
  "writeToDirectory": true,
  "required": true
}
```

**What this means:** The `hidden` and `editable` flags on `authenticationAttributeCollectionInputConfiguration` allow you to:
- Set `hidden: true` — email field is not rendered on the sign-up page
- Set `editable: false` — user cannot modify it even if somehow visible
- Keep `writeToDirectory: true` and `required: true` — email is still stored

**The gap:** Hiding the field means the user doesn't see it, but *something* must still provide a value. Two mechanisms can supply the value:
1. **OnAttributeCollectionStart custom extension** — the `setPrefillValues` action can prefill the email with a shadow value before the page renders
2. **OnAttributeCollectionSubmit custom extension** — the `modifyAttributeValues` action can inject/override the email after submission

**Confidence:** HIGH — this is from official Microsoft Graph API documentation with working code examples.

### Finding 2: OnAttributeCollectionStart Can Prefill Values (HIGH confidence)

**Source:** [Custom extension attribute collection](https://learn.microsoft.com/en-us/entra/identity-platform/custom-extension-attribute-collection) and [OnAttributeCollectionStart reference](https://learn.microsoft.com/en-us/entra/identity-platform/custom-extension-onattributecollectionstart-retrieve-return-data)

The `OnAttributeCollectionStart` event fires before the attribute collection page renders and supports three actions:
- `continueWithDefaultBehavior` — render page as usual
- `setPrefillValues` — prefill form fields with values from your REST API
- `showBlockPage` — block sign-up entirely

The prefill action accepts a dictionary of attribute names to values:
```json
{
  "data": {
    "@odata.type": "microsoft.graph.onAttributeCollectionStartResponseData",
    "actions": [
      {
        "@odata.type": "microsoft.graph.attributeCollectionStart.setPrefillValues",
        "inputs": {
          "email": "generated-shadow@exponenthr-auth.com",
          "displayName": "John Smith"
        }
      }
    ]
  }
}
```

**Key constraint:** Your REST API cannot add NEW attributes — only prefill attributes that are already in the user flow. This means email must still be configured as a collected attribute in the user flow (but hidden via the `hidden: true` flag).

**The request payload includes user identities** (including federated identity info), which means your REST API receives context about who is signing up and can generate an appropriate shadow email.

### Finding 3: Username Sign-In Is Now Supported (PREVIEW) (HIGH confidence)

**Source:** [Sign in with alias or username (preview)](https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-sign-in-alias)

Entra External ID now supports username as an alternative sign-in identifier alongside email. This is a preview feature but officially documented.

- Users can sign in with **username + password** (not just email + password)
- Configured via "Sign-in identifiers" policy in the Entra admin center
- Users need both an `emailAddress` identity AND a `userName` identity in their `identities[]` array
- Custom regex validation available for username format

**Graph API for creating users with username:**
```json
POST https://graph.microsoft.com/v1.0/users
{
    "displayName": "Test User",
    "identities": [
        {
            "signInType": "emailAddress",
            "issuer": "contoso.onmicrosoft.com",
            "issuerAssignedId": "dylan@woodgrovebank.com"
        },
        {
            "signInType": "userName",
            "issuer": "contoso.onmicrosoft.com",
            "issuerAssignedId": "dylan123"
        }
    ],
    "mail": "dylan@woodgrovebank.com",
    "passwordProfile": {
        "password": "passwordValue",
        "forceChangePasswordNextSignIn": false
    },
    "passwordPolicies": "DisablePasswordExpiration"
}
```

**What this means for ExponentHR:** Users CAN sign in with their existing freeform usernames. But **email is still required during account creation** — the `emailAddress` identity must exist. The username identity is additive, not a replacement.

### Finding 4: Graph API User Import Requires Email for External Tenants (HIGH confidence)

**Source:** [Microsoft Graph API — Create User](https://learn.microsoft.com/en-us/graph/api/user-post-users) (Example 3: Create a customer account in external tenants)

For external tenant user creation via Graph API, the documented pattern requires:
- `identities` array with `signInType: "emailAddress"`
- `mail` property set to the email address
- `passwordProfile` with password
- `passwordPolicies: "DisablePasswordExpiration"`

**Critical question:** Can users be created with ONLY a `userName` identity (no `emailAddress` identity) in external tenants?

**Evidence says probably not for external tenants.** Example 2 (B2C migration scenario) shows `signInType: "userName"` WITHOUT `emailAddress`, but that example is for Azure AD B2C, not Entra External ID external tenants. Example 3 (external tenants) only shows `signInType: "emailAddress"`.

**Recommendation:** The pre-import strategy should create users with BOTH a shadow `emailAddress` identity AND a `userName` identity. The email doesn't need to be real — it just needs to be unique and in email format (e.g., `{uniqueId}@exponenthr-auth.com`).

### Finding 5: SMS for MFA Supported, SMS for Password Reset NOT Supported (HIGH confidence)

**Source:** [MFA in external tenants](https://learn.microsoft.com/en-us/entra/external-id/customers/concept-multifactor-authentication-customers)

- **MFA methods available:** Email OTP and SMS (SMS is add-on with per-country pricing)
- **Mexico (+52):** In "Mid Low Cost" pricing tier — SMS MFA IS supported
- **Password reset:** Uses email OTP only — **SMS is NOT available for self-service password reset in external tenants currently**
- SMS is also NOT available as a first-factor authentication method

**What this means:** Users without email cannot use self-service password reset through Entra's built-in flow. They'll need either:
1. Admin-initiated password reset via Graph API + custom support tooling
2. A custom password reset flow that verifies via SMS outside Entra and then resets via Graph API
3. Wait for Microsoft to add SMS password reset to external tenants

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels broken or users can't work.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Username sign-in preservation** | Users have muscle memory; changing credentials causes mass support tickets | MEDIUM | Use Entra's username sign-in identifier (preview). Users keep existing usernames. Requires username collision resolution across companies. |
| **Password sign-in** | Primary auth method, users expect it | LOW | Entra "Email with password" identity provider. Username is the sign-in identifier, password is the credential. |
| **Account creation for all users (including no-email)** | 10-30% of users lack deliverable email; they must not be locked out | HIGH | **THE CRITICAL FEATURE.** Use shadow emails (`{uniqueId}@exponenthr-auth.com`) via Graph API import. Combine with `hidden: true` email attribute on sign-up flows. |
| **Forced password reset on first login** | Entra cannot import custom password hashes; users must set new Entra passwords | MEDIUM | Graph API: `forceChangePasswordNextSignIn: true`. Welcome email/notification explains the change. |
| **SMS MFA** | Replacing homegrown OTP; users expect MFA to work | MEDIUM | Entra Conditional Access + SMS authentication method. Mexico (+52) confirmed supported. SMS is add-on cost. |
| **Email OTP MFA** | Secondary MFA option for users with email | LOW | Built into Entra. Configure via Conditional Access policy. |
| **Post-login company/employee/environment selection** | HRA users manage multiple companies; workflow depends on switcher | LOW | In-app feature — NOT an Entra feature. ExponentHR's existing switcher stays. Entra token carries user identity; app maps to employee records. |
| **Password reset (email users)** | Users forget passwords regularly | LOW | Built into Entra for users with email addresses. Self-service password reset (SSPR) via email OTP. |
| **Branded login pages** | Users need to recognize the login page as ExponentHR | LOW | Entra company branding — logo, background, colors, hint text customization all supported. |
| **Username collision resolution** | Same username exists across different companies (companyA/jsmith, companyB/jsmith) | HIGH | Must generate globally unique Entra usernames. Strategy: prefix with company code, or append unique suffix. Communication to affected users critical. |
| **Welcome/migration communication** | Users need to know login is changing | MEDIUM | Email campaign for email users. In-app notification for no-email users. Must explain new credentials if username changed. |

### Differentiators (Competitive Advantage)

Features that set the migration apart as well-executed. Not expected, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Zero-disruption JIT migration path** | Users never notice the migration happened — existing credentials work, no forced reset | VERY HIGH | Bridge UI + custom auth extensions + shadow email. OnAttributeCollectionStart prefills hidden email. OnAttributeCollectionSubmit validates/modifies. Complex but achievable based on docs. **Recommend as aspirational, not MVP.** |
| **SMS password reset for no-email users** | 10-30% of users can't use email-based SSPR; SMS fallback prevents lockout | HIGH | NOT natively supported by Entra External ID. Requires custom flow: verify phone via SMS → call Graph API to reset password. Significant custom build. |
| **HRA multi-identity mapping** | Single Entra identity maps to multiple employee records across subsidiaries | MEDIUM | Custom claim in token via custom claims provider (OnTokenIssuanceStart). REST API returns employee mappings. ExponentHR app uses these to show company switcher. |
| **Support admin tooling** | Help desk can troubleshoot login issues, reset MFA, unlock accounts | MEDIUM | Graph API for user management. Custom admin UI for: user lookup, password reset, MFA reset, account enable/disable, identity/username lookup. |
| **Staged rollout** | Migrate client companies one at a time, reducing blast radius | HIGH | Dual auth running simultaneously. Routing logic per company. More complex but lower risk. |
| **International phone number support** | Mexico (+52) users can use SMS MFA | LOW | Natively supported. Mexico in "Mid Low Cost" SMS tier. Region opt-in may be required for certain countries. |
| **Custom OTP email provider** | Brand the verification emails to match ExponentHR | MEDIUM | OnOtpSend custom authentication extension. Use Azure Communication Services or SendGrid. Custom templates, from-address, localization. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. Deliberately do NOT build these.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Fully custom login UI** | "We want complete control over the login experience" | Massive build effort, ongoing maintenance, security responsibility shifts to you, miss Entra security updates | Use Entra-hosted pages with company branding. Customize via branding settings + custom CSS. |
| **Password hash migration** | "Let users keep their exact existing password" | Entra External ID does NOT support importing custom password hashes. Attempting workarounds (like proxying auth) creates security risks and unsupported configurations. | Accept forced password reset on first login. Communicate clearly. Users set new password once. |
| **Big bang migration** | "Migrate everyone at once, clean cut" | If anything goes wrong, ALL users are affected. No rollback. Support overwhelmed. | Staged rollout by client company. Start with low-risk clients. |
| **Building a custom MFA system** | "We already have homegrown OTP, let's keep it" | Homegrown MFA is why you're migrating. Maintaining it defeats the purpose. Security liability. | Use Entra's built-in SMS and email OTP MFA. Leverage Conditional Access for policy. |
| **Social login (Google/Facebook/Apple)** | "Modern auth should support social login" | ExponentHR is enterprise HR software. Users don't want to link personal social accounts to their employer's HR system. Adds complexity without value. | Stay with username + password. Add social only if customer demand materializes. |
| **Real-time sync of legacy credentials** | "Keep legacy auth running in parallel with live sync" | Two systems of record = data consistency nightmare. Which password is canonical? MFA state diverges. | Clean cutover per company. Legacy auth disabled after migration for that company. |
| **Username-only sign-up (no email at all)** | "Our users don't have email, don't create shadow emails" | Entra fundamentally requires an email identity for account creation in external tenants. Fighting this creates unsupported configurations. Shadow emails are the sanctioned workaround. | Use shadow emails. They're never shown to users, never emailed. They're an internal implementation detail. |

---

## Feature Dependencies

```
[Username Collision Resolution]
    └──required-before──> [Graph API User Import]
                              └──required-before──> [Username Sign-in Configuration]
                                                        └──required-before──> [First Login / Password Reset]

[Entra Tenant Setup]
    └──required-before──> [User Flow Configuration]
                              └──required-before──> [Custom Auth Extensions (if JIT)]
                              └──required-before──> [Company Branding]
                              └──required-before──> [MFA Policy (Conditional Access)]

[Shadow Email Strategy]
    └──required-before──> [Graph API User Import]
    └──required-before──> [Custom Auth Extensions (if JIT)]

[Graph API User Import]
    └──enables──> [Forced Password Reset on First Login]
    └──enables──> [Welcome Communication]

[MFA Policy (Conditional Access)]
    └──requires──> [SMS Authentication Method Enabled]
    └──requires──> [Email OTP Authentication Method Enabled]

[SMS Password Reset (No-Email Users)]
    └──requires──> [Custom REST API for SMS verification]
    └──requires──> [Graph API password reset integration]
    └──conflicts-with──> [Native Entra SSPR] (can't use Entra's built-in SSPR for this)

[HRA Multi-Identity Mapping]
    └──requires──> [Custom Claims Provider (OnTokenIssuanceStart)]
    └──requires──> [ExponentHR employee record lookup API]

[Support Admin Tooling]
    └──requires──> [Graph API access configured]
    └──enhances──> [All user-facing features]
```

### Dependency Notes

- **Username Collision Resolution → User Import:** Cannot import users until collision strategy is decided. Affects usernames, shadow emails, display names.
- **Shadow Email Strategy → Everything:** The shadow email format (`{uniqueId}@exponenthr-auth.com`) affects Graph API import, custom auth extensions, and support tooling. Must be decided early.
- **SMS Password Reset conflicts with Native SSPR:** Entra's built-in SSPR uses email only. No-email users need a completely separate custom flow. These are two different systems.
- **HRA Multi-Identity requires Custom Claims Provider:** The mapping of one Entra user → multiple employee records must be returned via custom claims at token issuance time, or handled entirely in-app.

---

## MVP Definition

### Launch With (v1) — Pre-Import Strategy

The pre-import strategy is recommended for MVP because it is simpler, more controlled, and doesn't require the complex JIT migration infrastructure.

- [ ] **Entra External ID tenant setup** — tenant creation, app registration, domain verification
- [ ] **Username collision resolution** — define strategy (company code prefix, unique suffix, etc.), resolve conflicts across all companies
- [ ] **Shadow email generation** — generate `{uniqueId}@exponenthr-auth.com` for every user, especially no-email users
- [ ] **Batch user import via Graph API** — import all users with `signInType: "emailAddress"` (shadow) + `signInType: "userName"` identities, `forceChangePasswordNextSignIn: true`
- [ ] **Enable username sign-in identifier** — configure sign-in identifiers policy to allow username sign-in
- [ ] **User flow with branded pages** — sign-in/sign-up flow with ExponentHR branding
- [ ] **MFA via Conditional Access** — SMS + email OTP as second factors
- [ ] **Email-based password reset (SSPR)** — for users with real email addresses
- [ ] **Welcome communication** — email for email users, in-app notification for no-email users, explaining new login process
- [ ] **ExponentHR OIDC/OAuth integration** — .NET app configured as Entra client, receives tokens, maps to employee records
- [ ] **Rollback plan** — ability to revert to legacy auth if critical issues

### Add After Validation (v1.x)

Features to add once core migration is working.

- [ ] **Custom SMS password reset for no-email users** — when users without email forget passwords, admin-assisted or custom SMS verification flow
- [ ] **Support admin tooling** — web UI for help desk to look up users, reset passwords, reset MFA, view login attempts
- [ ] **HRA custom claims provider** — OnTokenIssuanceStart extension returning employee-to-company mappings in token
- [ ] **Custom OTP email provider** — branded verification emails via OnOtpSend extension
- [ ] **Staged rollout tooling** — if not doing big-bang, tooling to manage per-company migration status

### Future Consideration (v2+)

Features to defer until post-migration stabilization.

- [ ] **JIT migration path** — Bridge UI + custom auth extensions for any remaining legacy users or new client onboarding
- [ ] **Username format modernization** — allow users to change usernames post-migration
- [ ] **Passkey/FIDO2 support** — passwordless authentication (Entra supports this but adds complexity)
- [ ] **Self-service account linking** — users link their own additional identities

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Username sign-in preservation | HIGH | MEDIUM | **P1** |
| Account creation for no-email users (shadow email) | HIGH | MEDIUM | **P1** |
| Batch user import via Graph API | HIGH | MEDIUM | **P1** |
| Forced password reset on first login | HIGH | LOW | **P1** |
| Branded login pages | MEDIUM | LOW | **P1** |
| SMS MFA | HIGH | MEDIUM | **P1** |
| Email OTP MFA | HIGH | LOW | **P1** |
| MFA Conditional Access policy | HIGH | MEDIUM | **P1** |
| Email-based SSPR | HIGH | LOW | **P1** |
| Username collision resolution | HIGH | HIGH | **P1** |
| Welcome/migration communication | HIGH | MEDIUM | **P1** |
| ExponentHR OIDC integration | HIGH | MEDIUM | **P1** |
| Rollback plan | HIGH | MEDIUM | **P1** |
| SMS password reset (no-email) | HIGH | HIGH | **P2** |
| Support admin tooling | MEDIUM | MEDIUM | **P2** |
| HRA multi-identity mapping | MEDIUM | MEDIUM | **P2** |
| Custom OTP email provider | LOW | MEDIUM | **P2** |
| Staged rollout tooling | MEDIUM | HIGH | **P2** |
| JIT migration path | LOW | VERY HIGH | **P3** |
| Passkey/FIDO2 | LOW | MEDIUM | **P3** |

**Priority key:**
- **P1:** Must have for launch — migration fails without these
- **P2:** Should have — add after initial migration succeeds
- **P3:** Nice to have — future enhancement

---

## Migration Strategy Comparison: Pre-Import vs JIT

| Criterion | Pre-Import (Graph API) | JIT (Custom Auth Extensions) |
|-----------|----------------------|------------------------------|
| **Complexity** | MEDIUM — batch scripting, collision resolution | VERY HIGH — bridge UI, REST APIs, custom extensions, shadow email injection |
| **User disruption** | MEDIUM — forced password reset, username may change | LOW — credentials work on first visit (aspirational) |
| **No-email user support** | EASY — shadow emails assigned at import time | COMPLEX — must inject shadow email via OnAttributeCollectionStart + hidden field |
| **Rollback** | EASY — don't flip DNS, keep legacy auth | HARD — JIT creates accounts on-the-fly, hard to undo |
| **Timeline** | Shorter — well-documented Graph API patterns | Longer — custom auth extensions are newer, less battle-tested |
| **Data quality** | HIGH — all users verified before go-live | VARIABLE — depends on real-time validation |
| **Collision resolution** | Before migration — clean resolution | On-the-fly — more error-prone |
| **Risk** | LOWER — controlled, testable, reversible | HIGHER — runtime failures affect individual users |

**Recommendation:** Pre-import via Graph API for MVP. JIT migration as a future enhancement for edge cases or new client onboarding. The pre-import approach is simpler, better documented, and more controllable. The JIT approach adds significant complexity for marginal user experience benefit.

---

## Entra External ID Platform Capabilities Reference

| Capability | Available? | Notes | Source Confidence |
|------------|-----------|-------|-------------------|
| Username sign-in | YES (preview) | `signInType: "userName"` in identities array | HIGH — official docs |
| Username sign-up (self-service) | NO | Email required for initial account creation | HIGH — official docs |
| Hidden email attribute on sign-up | YES | `hidden: true, editable: false` via Graph API | HIGH — official docs Example 2 |
| Prefill attributes (OnAttributeCollectionStart) | YES | `setPrefillValues` action in REST API response | HIGH — official docs |
| Modify attributes (OnAttributeCollectionSubmit) | YES | `modifyAttributeValues` action | HIGH — official docs |
| Graph API user creation with username identity | YES | Both `emailAddress` and `userName` signInTypes | HIGH — official docs |
| Force password change on first login | YES | `forceChangePasswordNextSignIn: true` | HIGH — official docs |
| Import password hashes | NO | Not supported for any tenant type | HIGH — official docs |
| SMS MFA | YES (add-on) | Per-country pricing, Mexico in Mid Low Cost tier | HIGH — official docs |
| Email OTP MFA | YES | Built-in, no add-on cost | HIGH — official docs |
| SMS self-service password reset | NO | Not currently available in external tenants | HIGH — official docs |
| Email SSPR | YES | Built-in for email+password users | HIGH — official docs |
| Company branding | YES | Logo, colors, background, hint text | HIGH — official docs |
| Custom claims provider | YES | OnTokenIssuanceStart event | HIGH — official docs |
| Custom email OTP provider | YES | OnOtpSend event | HIGH — official docs |
| Conditional Access | YES | Grant controls including MFA requirement | HIGH — official docs |
| International SMS (+52 Mexico) | YES | Requires region opt-in for some countries | HIGH — official docs |

---

## Sources

All findings verified against official Microsoft documentation:

- [Custom authentication extensions overview](https://learn.microsoft.com/en-us/entra/identity-platform/custom-extension-overview) — HIGH confidence
- [Custom extension for attribute collection](https://learn.microsoft.com/en-us/entra/identity-platform/custom-extension-attribute-collection) — HIGH confidence
- [OnAttributeCollectionStart reference](https://learn.microsoft.com/en-us/entra/identity-platform/custom-extension-onattributecollectionstart-retrieve-return-data) — HIGH confidence
- [Update authenticationEventsFlow (hidden email example)](https://learn.microsoft.com/en-us/graph/api/authenticationeventsflow-update#example-2-update-the-page-layout-of-a-self-service-sign-up-user-flow) — HIGH confidence
- [Graph API — Create User](https://learn.microsoft.com/en-us/graph/api/user-post-users) — HIGH confidence
- [Define custom attributes](https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-define-custom-attributes) — HIGH confidence
- [User profile attributes](https://learn.microsoft.com/en-us/entra/external-id/customers/concept-user-attributes) — HIGH confidence
- [Sign in with alias/username (preview)](https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-sign-in-alias) — HIGH confidence
- [Identity providers for external tenants](https://learn.microsoft.com/en-us/entra/external-id/customers/concept-authentication-methods-customers) — HIGH confidence
- [MFA in external tenants](https://learn.microsoft.com/en-us/entra/external-id/customers/concept-multifactor-authentication-customers) — HIGH confidence
- [Create sign-up/sign-in user flow](https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-user-flow-sign-up-sign-in-customers) — HIGH confidence

---
*Feature research for: ExponentHR Identity Migration to Entra External ID*
*Researched: 2026-02-11*
