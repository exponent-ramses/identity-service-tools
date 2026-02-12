/**
 * Type definitions for the Entra SDK
 *
 * These types model the subset of Microsoft Graph API objects
 * relevant to ExponentHR identity management operations.
 */

// ── User Types ──────────────────────────────────────────────

export interface EntraUser {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail: string | null;
  accountEnabled: boolean;
  createdDateTime: string;
  signInActivity?: SignInActivity;
  identities?: UserIdentity[];
  jobTitle?: string | null;
  department?: string | null;
  companyName?: string | null;
  mobilePhone?: string | null;
  /** Custom extension attributes for ExponentHR-specific data */
  [key: `extension_${string}`]: unknown;
}

export interface UserIdentity {
  signInType: "userName" | "emailAddress" | "federated" | string;
  issuer: string;
  issuerAssignedId: string;
}

export interface SignInActivity {
  lastSignInDateTime: string | null;
  lastNonInteractiveSignInDateTime: string | null;
}

export interface CreateUserInput {
  displayName: string;
  username: string;
  password: string;
  email?: string;
  /** If true, user must change password on next sign-in */
  forceChangePassword?: boolean;
  mobilePhone?: string;
  companyName?: string;
  jobTitle?: string;
  department?: string;
}

export interface UpdateUserInput {
  displayName?: string;
  accountEnabled?: boolean;
  mobilePhone?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
  department?: string | null;
}

// ── Password Types ──────────────────────────────────────────

export interface PasswordResetInput {
  userId: string;
  newPassword: string;
  forceChangeOnNextSignIn?: boolean;
}

// ── MFA / Authentication Methods ────────────────────────────

export interface AuthenticationMethod {
  id: string;
  methodType: "phone" | "email" | "fido2" | "microsoftAuthenticator" | "softwareOath" | string;
  /** Human-readable detail, e.g. phone number or email */
  detail?: string;
}

export interface PhoneAuthMethod {
  id: string;
  phoneNumber: string;
  phoneType: "mobile" | "alternateMobile" | "office";
  smsSignInState?: "ready" | "notSupported" | "notAllowedByPolicy" | "notConfigured";
}

export interface EmailAuthMethod {
  id: string;
  emailAddress: string;
}

// ── Group Types ─────────────────────────────────────────────

export interface EntraGroup {
  id: string;
  displayName: string;
  description: string | null;
  groupTypes: string[];
  membershipRule?: string | null;
  securityEnabled: boolean;
  mailEnabled: boolean;
}

// ── Sign-In Log Types ───────────────────────────────────────

export interface SignInLog {
  id: string;
  createdDateTime: string;
  userDisplayName: string;
  userPrincipalName: string;
  userId: string;
  appDisplayName: string;
  ipAddress: string;
  clientAppUsed: string;
  status: {
    errorCode: number;
    failureReason: string | null;
    additionalDetails: string | null;
  };
  location?: {
    city: string | null;
    state: string | null;
    countryOrRegion: string | null;
  };
  mfaDetail?: {
    authMethod: string | null;
    authDetail: string | null;
  };
}

// ── Operation Results ───────────────────────────────────────

export interface OperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PagedResult<T> {
  items: T[];
  nextLink?: string;
  totalCount?: number;
}

// ── SDK Configuration ───────────────────────────────────────

export interface EntraSDKConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  /** The issuer domain for local account identities (e.g. "yourtenantname.onmicrosoft.com") */
  issuerDomain: string;
  /** Optional: ID of the "Deactivated Users" security group */
  deactivatedGroupId?: string;
}
