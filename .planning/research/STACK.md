# Stack Research

**Domain:** Enterprise identity migration — proprietary auth to Microsoft Entra External ID
**Researched:** 2026-02-11
**Confidence:** HIGH (all core packages verified via NuGet and official Microsoft docs)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Microsoft Entra External ID | Current (GA) | Identity platform replacing proprietary auth | Microsoft's successor to Azure AD B2C (B2C unavailable to new customers since May 2025). Supports username sign-in, custom branding, user flows, Conditional Access, and custom authentication extensions. This is the only forward-looking CIAM platform from Microsoft. **Confidence: HIGH** — verified via [official docs](https://learn.microsoft.com/en-us/entra/external-id/customers/overview-customers-ciam), last updated 2026-01-30. |
| Microsoft.Graph | 5.102.0 | User provisioning, batch import, account management via Graph API | The primary SDK for creating/managing user accounts in Entra. Targets .NET Standard 2.0, fully compatible with .NET Framework 4.6.1+. Used for pre-import migration strategy (batch user creation) and ongoing account management. Kiota-based v5 is current; v4 is legacy. **Confidence: HIGH** — verified on [NuGet](https://www.nuget.org/packages/Microsoft.Graph), released 2026-02-05. |
| Microsoft.Identity.Client (MSAL.NET) | 4.82.1 | Token acquisition for server-to-server Graph API calls | MSAL.NET is the standard auth library for acquiring tokens to call Microsoft APIs. Required by Azure.Identity and used internally by Microsoft.Identity.Web. Targets .NET Framework 4.6.2+, .NET Standard 2.0, and .NET 8.0. Actively maintained with monthly releases. Supported versions: >= 4.77.1. **Confidence: HIGH** — verified on [NuGet](https://www.nuget.org/packages/Microsoft.Identity.Client), released 2026-02-05. |
| Microsoft.Identity.Web.OWIN | 4.3.0 | OIDC integration for ASP.NET (.NET Framework) apps | **This is the critical library for ExponentHR.** It bridges Microsoft Identity Web (designed for ASP.NET Core) to ASP.NET Framework via OWIN/Katana. Provides OIDC middleware, token acquisition, and session management for .NET Framework 4.7.2+ web apps. Targets .NET Framework 4.7.2. **Confidence: HIGH** — verified on [NuGet](https://www.nuget.org/packages/Microsoft.Identity.Web.OWIN), released 2026-01-07. |
| Azure.Identity | 1.17.1 | Credential management for Azure SDK services | Provides `ClientSecretCredential` and `ClientCertificateCredential` for authenticating the migration tooling's calls to Graph API. Targets .NET Standard 2.0 (compatible with .NET Framework 4.6.1+). **Confidence: HIGH** — verified on [NuGet](https://www.nuget.org/packages/Azure.Identity), released 2025-11-19. |
| Microsoft.Owin.Security.OpenIdConnect | 4.2.3 | OWIN OIDC middleware for ASP.NET Framework | Low-level OIDC middleware that Microsoft.Identity.Web.OWIN builds upon. Direct dependency. Targets .NET Framework 4.5+. Updated July 2025 — this package is alive, not abandoned. **Confidence: HIGH** — verified on [NuGet](https://www.nuget.org/packages/Microsoft.Owin.Security.OpenIdConnect), released 2025-07-08. |

### Custom Authentication Extensions Runtime

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Azure Functions (.NET) | v4 (in-process) or Isolated Worker | Host custom authentication extension REST APIs | Microsoft's official docs for custom auth extensions use Azure Functions as the REST API backend. Functions handle OnAttributeCollectionStart, OnAttributeCollectionSubmit, and OnTokenIssuanceStart events. Use in-process for simplicity with .NET 6, or isolated worker for .NET 8. **Confidence: HIGH** — verified via [official docs](https://learn.microsoft.com/en-us/entra/identity-platform/custom-extension-attribute-collection). |
| Azure Functions authentication events API (app registration) | N/A | Secure the custom auth extension endpoint | Entra uses client_credentials flow to call your Azure Function. You register an app and configure authentication on the Function App. Required for production deployment. **Confidence: HIGH** — verified via official docs. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Microsoft.Graph.Core | 3.2.5+ | Core HTTP pipeline for Graph SDK | Auto-installed as dependency of Microsoft.Graph. Do not install separately. |
| Microsoft.Owin.Host.SystemWeb | 4.2.2+ | OWIN hosting in IIS/System.Web pipeline | Required for OWIN middleware to work in ASP.NET Framework. Dependency of Microsoft.Identity.Web.OWIN. |
| Microsoft.Owin.Security.ActiveDirectory | 4.2.2+ | Bearer token validation for Web APIs | If ExponentHR exposes APIs that need Entra token validation. Dependency of Microsoft.Identity.Web.OWIN. |
| Newtonsoft.Json | 13.0.1+ | JSON serialization | Required by OWIN packages and Azure Functions (in-process). Already a dependency — do not replace with System.Text.Json in the OWIN pipeline. |
| System.IdentityModel.Tokens.Jwt | 8.15.0+ | JWT token parsing and validation | Dependency of Microsoft.Identity.Web.OWIN. Used for validating tokens from Entra. Pin to >= 8.x to match Microsoft.IdentityModel.Validators. |
| Microsoft.IdentityModel.Validators | 8.15.0+ | Issuer and audience validation | Dependency of Microsoft.Identity.Web.OWIN v4.x. Handles Entra-specific token validation. |
| Microsoft.Extensions.Configuration | 3.1.24+ | Configuration reading from appsettings.json | Dependency of Microsoft.Identity.Web.OWIN. Enables Entra config binding from standard .NET configuration. |

### Infrastructure & Tooling

| Tool | Purpose | Notes |
|------|---------|-------|
| Microsoft Entra Admin Center | Tenant configuration, user flows, branding, custom extensions | Portal at entra.microsoft.com. Used for all Entra configuration — user flows, custom auth extensions, Conditional Access policies, company branding. |
| Azure Portal | Azure Functions deployment, Function App authentication | Portal at portal.azure.com. Used for Azure Functions and related infrastructure. |
| Microsoft Graph Explorer | Ad-hoc Graph API testing | browser tool at developer.microsoft.com/graph/graph-explorer. Test user creation, batch operations, and Conditional Access policies before coding. |
| Azure CLI / Az PowerShell | Scripting Entra configuration and deployments | Use for automating tenant setup, app registrations, and CI/CD pipeline integration. |
| Postman or similar | REST API testing for custom auth extensions | Test your Azure Function endpoints locally before connecting them to Entra user flows. |

## Installation

```bash
# Core packages for the ASP.NET Framework web application
Install-Package Microsoft.Identity.Web.OWIN -Version 4.3.0
# This pulls in: Microsoft.Owin.Security.OpenIdConnect, Microsoft.Owin.Host.SystemWeb,
#   Microsoft.Identity.Client (transitively), System.IdentityModel.Tokens.Jwt, etc.

# For server-side Graph API calls (migration tooling, user management)
Install-Package Microsoft.Graph -Version 5.102.0
Install-Package Azure.Identity -Version 1.17.1

# For the custom authentication extension (Azure Functions project, separate from main app)
# In the Azure Functions project:
Install-Package Microsoft.NET.Sdk.Functions
Install-Package Newtonsoft.Json -Version 13.0.1
```

> **Note:** These are NuGet packages, not npm. Use Package Manager Console or `dotnet add package` in the appropriate projects.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Microsoft.Identity.Web.OWIN 4.3.0 | Microsoft.Owin.Security.OpenIdConnect alone (raw OWIN) | **Never for this project.** Raw OWIN requires manual token cache management, manual authority configuration, and manual claims mapping. Microsoft.Identity.Web.OWIN handles all of this and is actively maintained. The only reason to go raw OWIN is if you're on .NET Framework < 4.7.2, which would require upgrading first. |
| Microsoft.Identity.Web.OWIN 4.3.0 | Migrate to ASP.NET Core first, then use Microsoft.Identity.Web | Only if there's a parallel initiative to port ExponentHR to .NET Core/.NET 8. This is a massive effort orthogonal to the identity migration. Don't couple them. |
| Microsoft.Graph 5.x | Direct REST API calls to Graph | Only for operations not yet supported by the SDK (rare). The SDK provides type safety, retry logic, batching support, and pagination handling. Raw REST adds maintenance burden. |
| Azure Functions (C#) | Azure Logic Apps for custom auth extensions | Only for no-code scenarios. Logic Apps are harder to test, version, and debug. Azure Functions give full C# control, which you'll need for shadow email generation, username collision logic, etc. |
| Azure.Identity (ClientSecretCredential) | MSAL.NET ConfidentialClientApplication directly | Azure.Identity when using Azure SDK services (Graph SDK accepts TokenCredential). Use MSAL directly only if you need fine-grained control over token caching or need to work outside the Azure SDK ecosystem. |
| Pre-import via Graph API | JIT migration with custom auth extensions | **Both are viable.** Pre-import is more predictable: batch create users with Graph, force password reset. JIT migration is more transparent to users but requires shadow email workaround. See ARCHITECTURE.md for decision framework. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Azure AD B2C | **Discontinued for new customers as of May 2025.** No new features. Microsoft is converging everything to Entra External ID. Starting a new migration on B2C is a dead end. | Microsoft Entra External ID (external tenant) |
| ADAL (Active Directory Authentication Library) | **Deprecated and end-of-life.** ADAL reached EOL in June 2023. No security patches. Microsoft actively recommends migration to MSAL. | MSAL.NET (Microsoft.Identity.Client) 4.82.1+ |
| Microsoft.Identity.Web (ASP.NET Core version) on .NET Framework | This package targets ASP.NET Core middleware. It will not work in the OWIN/Katana pipeline used by ASP.NET Framework apps. | Microsoft.Identity.Web.OWIN 4.3.0 (specifically designed for .NET Framework + OWIN) |
| Azure AD Graph API | **Retired.** Azure AD Graph was shut down in 2023. All user management must go through Microsoft Graph API. | Microsoft.Graph 5.x SDK |
| WS-Federation / SAML for the client app | Entra External ID is optimized for OIDC-based apps. While SAML is supported for enterprise apps via the Enterprise Applications feature, the user flow system (sign-up, sign-in, branding, custom extensions) requires OIDC. | OpenID Connect via OWIN middleware |
| Custom token validation middleware | Building your own JWT validation logic is error-prone and misses Entra-specific validation (issuer, audience, nonce, key rotation). | System.IdentityModel.Tokens.Jwt + Microsoft.IdentityModel.Validators (bundled with Microsoft.Identity.Web.OWIN) |
| Microsoft.Graph 4.x (legacy) | v4 uses the old code generation model. v5 uses Kiota with breaking API changes but better performance and maintenance. All new samples and docs target v5. | Microsoft.Graph 5.102.0 |

## Stack Patterns by Variant

**If using Pre-Import Migration (Strategy A):**
- Use `Microsoft.Graph` 5.x with `Azure.Identity` for batch user creation
- Use `ClientSecretCredential` or `ClientCertificateCredential` for daemon/service authentication
- Build a standalone migration console app or Azure Function for the batch import
- No custom authentication extensions needed for migration itself (only for ongoing sign-up)
- Users get forced password reset on first login (Entra cannot import custom password hashes)

**If using JIT Migration (Strategy B):**
- Use `Azure Functions` for custom authentication extensions
- Build `OnAttributeCollectionStart` handler to pre-fill shadow email (`{unique_id}@exponenthr-auth.com`)
- Build `OnAttributeCollectionSubmit` handler to validate and transform attributes
- Build `OnTokenIssuanceStart` handler to enrich tokens with custom claims from legacy system
- Bridge UI (served by ExponentHR) collects legacy credentials, validates against old system, then redirects to Entra sign-up with pre-populated data
- **Critical research gap:** Whether `OnAttributeCollectionStart` with `setPrefillValues` can bypass email collection entirely during sign-up, or if user still sees the email field. Needs prototype validation.

**If targeting .NET Framework < 4.7.2:**
- Must upgrade to at least .NET Framework 4.7.2 before integrating Microsoft.Identity.Web.OWIN
- Alternatively, use raw `Microsoft.Owin.Security.OpenIdConnect` 4.2.3 with manual configuration (not recommended — significant additional code)
- Check current ExponentHR target framework version first

**If running dual auth (migration transition period):**
- OWIN pipeline supports multiple authentication middleware
- Configure Entra OIDC as primary, legacy auth as fallback
- Use claims transformation middleware to normalize claims from both sources
- Session management must handle both token types during transition

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Microsoft.Identity.Web.OWIN 4.3.0 | .NET Framework 4.7.2+ | Minimum .NET Framework version. Will NOT work on 4.5, 4.6, or 4.7.0. Verify ExponentHR's target framework. |
| Microsoft.Identity.Web.OWIN 4.3.0 | Microsoft.Owin.Security.OpenIdConnect >= 4.2.2 | Dependency declared in package. Will pull correct version. |
| Microsoft.Identity.Web.OWIN 4.3.0 | Microsoft.Graph >= 4.36.0 | The OWIN package has a dependency on Microsoft.Graph >= 4.36.0 (v4 era). Installing Microsoft.Graph 5.x separately is fine — NuGet resolves to the higher version. |
| Microsoft.Identity.Web.OWIN 4.3.0 | System.IdentityModel.Tokens.Jwt >= 8.15.0 | Must align with Microsoft.IdentityModel.Validators version. Both are dependencies — let NuGet resolve. |
| Microsoft.Graph 5.102.0 | .NET Standard 2.0 / .NET Framework 4.6.1+ | Graph SDK works on .NET Framework 4.6.1+. However, if using with Microsoft.Identity.Web.OWIN, the app must target 4.7.2+ anyway. |
| Azure.Identity 1.17.1 | .NET Standard 2.0 / .NET Framework 4.6.1+ | Compatible with .NET Framework. Uses MSAL.NET >= 4.78.0 internally. |
| Microsoft.Identity.Client 4.82.1 | .NET Framework 4.6.2+ | Supported versions: >= 4.77.1. Versions below 4.77.1 are unsupported and may have vulnerabilities. |

## Critical Compatibility Warning

**Microsoft.Identity.Web.OWIN 4.3.0 requires .NET Framework 4.7.2 or higher.** This is the single most important compatibility constraint. Before any integration work begins:

1. Verify ExponentHR's current .NET Framework target version
2. If < 4.7.2, plan a framework upgrade as Phase 0
3. .NET Framework 4.7.2 is fully supported on Windows Server 2012 R2+ and is a safe, non-breaking upgrade from 4.6.x/4.7.x

## Entra External ID Platform Capabilities (Verified)

| Capability | Status | Source |
|------------|--------|--------|
| Username sign-in | **Supported** | Official docs: "email and password, one-time passcodes, social accounts" and username sign-in methods |
| Username sign-up (registration) | **NOT supported** — email is required at sign-up | PROJECT.md context + official docs: account creation requires email identity |
| Custom authentication extensions (OnAttributeCollectionStart) | **Supported** | Verified via [official docs](https://learn.microsoft.com/en-us/entra/external-id/customers/concept-custom-extensions) |
| Custom authentication extensions (OnAttributeCollectionSubmit) | **Supported** | Same source |
| Custom authentication extensions (OnTokenIssuanceStart) | **Supported** | Same source |
| setPrefillValues action in OnAttributeCollectionStart | **Supported** — can pre-fill form fields including built-in and custom attributes | Verified via [official docs](https://learn.microsoft.com/en-us/entra/identity-platform/custom-extension-attribute-collection) |
| showBlockPage action | **Supported** — can block sign-up based on custom logic | Same source |
| modifyAttributeValues action in OnAttributeCollectionSubmit | **Supported** — can silently override submitted values | Same source |
| Company branding on sign-in pages | **Supported** | Official overview docs |
| Conditional Access with MFA | **Supported** — can target specific apps and user groups | Official overview docs |
| OIDC protocol for app registration | **Supported and optimized** — the user flow system is OIDC-native | Official overview docs |
| SAML protocol for app registration | **Supported via Enterprise Applications** — but user flows are OIDC-only | Official overview docs |
| User creation via Graph API | **Supported** — admin center and Graph API both supported | Verified via [official docs](https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-manage-customer-accounts) |
| Password reset by admin (Graph API) | **Supported** — temporary password generated, user forced to change on next sign-in | Same source |

## Sources

- NuGet: [Microsoft.Graph 5.102.0](https://www.nuget.org/packages/Microsoft.Graph) — version, compatibility, dependencies verified 2026-02-11 (HIGH confidence)
- NuGet: [Microsoft.Identity.Client 4.82.1](https://www.nuget.org/packages/Microsoft.Identity.Client) — version, .NET Framework 4.6.2+ support verified 2026-02-11 (HIGH confidence)
- NuGet: [Microsoft.Identity.Web.OWIN 4.3.0](https://www.nuget.org/packages/Microsoft.Identity.Web.OWIN) — version, .NET Framework 4.7.2 requirement, dependencies verified 2026-02-11 (HIGH confidence)
- NuGet: [Microsoft.Owin.Security.OpenIdConnect 4.2.3](https://www.nuget.org/packages/Microsoft.Owin.Security.OpenIdConnect) — version, .NET Framework 4.5+ support verified 2026-02-11 (HIGH confidence)
- NuGet: [Azure.Identity 1.17.1](https://www.nuget.org/packages/Azure.Identity) — version, .NET Standard 2.0 support verified 2026-02-11 (HIGH confidence)
- Microsoft Learn: [Entra External ID Overview](https://learn.microsoft.com/en-us/entra/external-id/customers/overview-customers-ciam) — last updated 2026-01-30 (HIGH confidence)
- Microsoft Learn: [Custom Authentication Extensions](https://learn.microsoft.com/en-us/entra/external-id/customers/concept-custom-extensions) — last updated 2025-04-10 (HIGH confidence)
- Microsoft Learn: [Attribute Collection Custom Extensions](https://learn.microsoft.com/en-us/entra/identity-platform/custom-extension-attribute-collection) — last updated 2025-09-16 (HIGH confidence)
- Microsoft Learn: [Manage Customer Accounts](https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-manage-customer-accounts) — last updated 2025-04-25 (HIGH confidence)

---
*Stack research for: ExponentHR Identity Migration to Microsoft Entra External ID*
*Researched: 2026-02-11*
