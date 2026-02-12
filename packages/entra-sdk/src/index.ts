import type { Client } from "@microsoft/microsoft-graph-client";
import { createGraphClient } from "./client.js";
import { UserOperations } from "./users.js";
import { MFAOperations } from "./mfa.js";
import { GroupOperations } from "./groups.js";
import { SignInLogOperations } from "./sign-in-logs.js";
import type { EntraSDKConfig } from "./types/index.js";

/**
 * ExponentHR Entra SDK
 *
 * A reusable Graph API client for managing Entra External ID users,
 * MFA methods, groups, and sign-in logs.
 *
 * Usage:
 * ```ts
 * import { EntraSDK } from "@identity-migration/entra-sdk";
 *
 * const sdk = new EntraSDK({
 *   tenantId: "your-tenant-id",
 *   clientId: "your-app-client-id",
 *   clientSecret: "your-app-client-secret",
 *   issuerDomain: "yourtenant.onmicrosoft.com",
 *   deactivatedGroupId: "optional-group-id",
 * });
 *
 * // Look up a user
 * const result = await sdk.users.getByUsername("jsmith");
 *
 * // Reset their password
 * await sdk.users.resetPassword({
 *   userId: result.data.id,
 *   newPassword: "TempP@ssw0rd!",
 *   forceChangeOnNextSignIn: true,
 * });
 *
 * // Clear their MFA
 * await sdk.mfa.resetAllMethods(result.data.id);
 * ```
 */
export class EntraSDK {
  public readonly users: UserOperations;
  public readonly mfa: MFAOperations;
  public readonly groups: GroupOperations;
  public readonly signInLogs: SignInLogOperations;

  private readonly graphClient: Client;

  constructor(config: EntraSDKConfig) {
    this.graphClient = createGraphClient(config);
    this.users = new UserOperations(this.graphClient, config);
    this.mfa = new MFAOperations(this.graphClient);
    this.groups = new GroupOperations(this.graphClient);
    this.signInLogs = new SignInLogOperations(this.graphClient);
  }
}

// Re-export everything
export { createGraphClient } from "./client.js";
export { UserOperations } from "./users.js";
export { MFAOperations } from "./mfa.js";
export { GroupOperations } from "./groups.js";
export { SignInLogOperations } from "./sign-in-logs.js";
export * from "./types/index.js";
