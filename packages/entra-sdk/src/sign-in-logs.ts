import type { Client } from "@microsoft/microsoft-graph-client";
import type { SignInLog, OperationResult, PagedResult } from "./types/index.js";

/**
 * Sign-in log operations for troubleshooting and monitoring.
 *
 * Requires the AuditLog.Read.All permission in the app registration.
 */
export class SignInLogOperations {
  constructor(private client: Client) {}

  /**
   * Get recent sign-in logs for a specific user.
   */
  async getByUser(
    userId: string,
    options: { top?: number; daysBack?: number } = {}
  ): Promise<OperationResult<PagedResult<SignInLog>>> {
    try {
      const top = options.top ?? 25;
      const daysBack = options.daysBack ?? 7;
      const since = new Date();
      since.setDate(since.getDate() - daysBack);

      const filter = `userId eq '${userId}' and createdDateTime ge ${since.toISOString()}`;

      const result = await this.client
        .api("/auditLogs/signIns")
        .filter(filter)
        .top(top)
        .orderby("createdDateTime desc")
        .get();

      return {
        success: true,
        data: {
          items: result.value as SignInLog[],
          nextLink: result["@odata.nextLink"],
        },
      };
    } catch (err) {
      return this.handleError(err, "getByUser");
    }
  }

  /**
   * Get recent failed sign-in attempts across all users.
   * Useful for monitoring and spotting issues.
   */
  async getFailedSignIns(
    options: { top?: number; daysBack?: number } = {}
  ): Promise<OperationResult<PagedResult<SignInLog>>> {
    try {
      const top = options.top ?? 50;
      const daysBack = options.daysBack ?? 1;
      const since = new Date();
      since.setDate(since.getDate() - daysBack);

      const filter = `status/errorCode ne 0 and createdDateTime ge ${since.toISOString()}`;

      const result = await this.client
        .api("/auditLogs/signIns")
        .filter(filter)
        .top(top)
        .orderby("createdDateTime desc")
        .get();

      return {
        success: true,
        data: {
          items: result.value as SignInLog[],
          nextLink: result["@odata.nextLink"],
        },
      };
    } catch (err) {
      return this.handleError(err, "getFailedSignIns");
    }
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

    console.error(`[EntraSDK:SignIn] ${operation} failed:`, { code, message });

    return {
      success: false,
      error: { code, message, details: graphError },
    };
  }
}
