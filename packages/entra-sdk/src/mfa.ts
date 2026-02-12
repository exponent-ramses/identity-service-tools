import type { Client } from "@microsoft/microsoft-graph-client";
import type {
  AuthenticationMethod,
  PhoneAuthMethod,
  EmailAuthMethod,
  OperationResult,
} from "./types/index.js";

/**
 * MFA and authentication method management operations.
 *
 * These operations allow support agents to view and reset
 * a user's registered authentication methods (phone, email,
 * authenticator app, etc.).
 */
export class MFAOperations {
  constructor(private client: Client) {}

  // ── List Methods ───────────────────────────────────────────

  /**
   * Get all registered authentication methods for a user.
   * Returns a unified list with method type and detail.
   */
  async listMethods(
    userId: string
  ): Promise<OperationResult<AuthenticationMethod[]>> {
    try {
      const result = await this.client
        .api(`/users/${userId}/authentication/methods`)
        .get();

      const methods: AuthenticationMethod[] = (
        result.value as Array<{ id: string; "@odata.type": string; [key: string]: unknown }>
      ).map(
        (m) => ({
          id: m.id,
          methodType: this.parseMethodType(m["@odata.type"] as string),
          detail: this.parseMethodDetail(m),
        })
      );

      return { success: true, data: methods };
    } catch (err) {
      return this.handleError(err, "listMethods");
    }
  }

  /**
   * Get phone authentication methods specifically.
   */
  async getPhoneMethods(
    userId: string
  ): Promise<OperationResult<PhoneAuthMethod[]>> {
    try {
      const result = await this.client
        .api(`/users/${userId}/authentication/phoneMethods`)
        .get();

      return { success: true, data: result.value as PhoneAuthMethod[] };
    } catch (err) {
      return this.handleError(err, "getPhoneMethods");
    }
  }

  /**
   * Get email authentication methods specifically.
   */
  async getEmailMethods(
    userId: string
  ): Promise<OperationResult<EmailAuthMethod[]>> {
    try {
      const result = await this.client
        .api(`/users/${userId}/authentication/emailMethods`)
        .get();

      return { success: true, data: result.value as EmailAuthMethod[] };
    } catch (err) {
      return this.handleError(err, "getEmailMethods");
    }
  }

  // ── Reset Methods ──────────────────────────────────────────

  /**
   * Delete a specific phone authentication method.
   * Use this when a user gets a new phone and needs to re-register.
   */
  async deletePhoneMethod(
    userId: string,
    methodId: string
  ): Promise<OperationResult> {
    try {
      await this.client
        .api(`/users/${userId}/authentication/phoneMethods/${methodId}`)
        .delete();

      return { success: true };
    } catch (err) {
      return this.handleError(err, "deletePhoneMethod");
    }
  }

  /**
   * Delete a specific email authentication method.
   */
  async deleteEmailMethod(
    userId: string,
    methodId: string
  ): Promise<OperationResult> {
    try {
      await this.client
        .api(`/users/${userId}/authentication/emailMethods/${methodId}`)
        .delete();

      return { success: true };
    } catch (err) {
      return this.handleError(err, "deleteEmailMethod");
    }
  }

  /**
   * Delete a Microsoft Authenticator registration.
   */
  async deleteMicrosoftAuthenticator(
    userId: string,
    methodId: string
  ): Promise<OperationResult> {
    try {
      await this.client
        .api(
          `/users/${userId}/authentication/microsoftAuthenticatorMethods/${methodId}`
        )
        .delete();

      return { success: true };
    } catch (err) {
      return this.handleError(err, "deleteMicrosoftAuthenticator");
    }
  }

  /**
   * Delete a software OATH token method.
   */
  async deleteSoftwareOathMethod(
    userId: string,
    methodId: string
  ): Promise<OperationResult> {
    try {
      await this.client
        .api(
          `/users/${userId}/authentication/softwareOathMethods/${methodId}`
        )
        .delete();

      return { success: true };
    } catch (err) {
      return this.handleError(err, "deleteSoftwareOathMethod");
    }
  }

  /**
   * Reset ALL non-password authentication methods for a user.
   * This is the nuclear option — use when a user needs to completely
   * re-register all their MFA methods.
   *
   * Note: This deletes phone, email, authenticator, and OATH methods
   * but preserves the password method.
   */
  async resetAllMethods(userId: string): Promise<OperationResult<{ deleted: string[]; failed: string[] }>> {
    const deleted: string[] = [];
    const failed: string[] = [];

    try {
      const methodsResult = await this.listMethods(userId);
      if (!methodsResult.success || !methodsResult.data) {
        return {
          success: false,
          error: methodsResult.error ?? {
            code: "ListFailed",
            message: "Could not list authentication methods",
          },
        };
      }

      for (const method of methodsResult.data) {
        // Skip the password method — we never delete that here
        if (method.methodType === "password") continue;

        try {
          await this.deleteMethodByType(userId, method);
          deleted.push(`${method.methodType}:${method.id}`);
        } catch {
          failed.push(`${method.methodType}:${method.id}`);
        }
      }

      return {
        success: failed.length === 0,
        data: { deleted, failed },
        error:
          failed.length > 0
            ? {
                code: "PartialFailure",
                message: `Deleted ${deleted.length}, failed ${failed.length}`,
              }
            : undefined,
      };
    } catch (err) {
      return this.handleError(err, "resetAllMethods");
    }
  }

  // ── Helpers ────────────────────────────────────────────────

  private async deleteMethodByType(
    userId: string,
    method: AuthenticationMethod
  ): Promise<void> {
    const pathMap: Record<string, string> = {
      phone: "phoneMethods",
      email: "emailMethods",
      microsoftAuthenticator: "microsoftAuthenticatorMethods",
      softwareOath: "softwareOathMethods",
      fido2: "fido2Methods",
    };

    const path = pathMap[method.methodType];
    if (!path) {
      throw new Error(`Unknown method type: ${method.methodType}`);
    }

    await this.client
      .api(`/users/${userId}/authentication/${path}/${method.id}`)
      .delete();
  }

  private parseMethodType(odataType: string): string {
    const typeMap: Record<string, string> = {
      "#microsoft.graph.phoneAuthenticationMethod": "phone",
      "#microsoft.graph.emailAuthenticationMethod": "email",
      "#microsoft.graph.microsoftAuthenticatorAuthenticationMethod":
        "microsoftAuthenticator",
      "#microsoft.graph.softwareOathAuthenticationMethod": "softwareOath",
      "#microsoft.graph.fido2AuthenticationMethod": "fido2",
      "#microsoft.graph.passwordAuthenticationMethod": "password",
      "#microsoft.graph.temporaryAccessPassAuthenticationMethod":
        "temporaryAccessPass",
    };
    return typeMap[odataType] ?? odataType;
  }

  private parseMethodDetail(method: Record<string, unknown>): string {
    if (method.phoneNumber) return method.phoneNumber as string;
    if (method.emailAddress) return method.emailAddress as string;
    if (method.displayName) return method.displayName as string;
    return "";
  }

  private handleError(err: unknown, operation: string): OperationResult<never> {
    const graphError = err as {
      code?: string;
      message?: string;
      body?: string;
    };

    let code = graphError.code ?? "Unknown";
    let message = graphError.message ?? "An unknown error occurred";

    if (graphError.body) {
      try {
        const body = JSON.parse(graphError.body);
        code = body.error?.code ?? code;
        message = body.error?.message ?? message;
      } catch {
        // not JSON
      }
    }

    console.error(`[EntraSDK:MFA] ${operation} failed:`, { code, message });

    return {
      success: false,
      error: { code, message, details: graphError },
    };
  }
}
