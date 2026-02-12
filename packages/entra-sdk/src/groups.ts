import type { Client } from "@microsoft/microsoft-graph-client";
import type {
  EntraGroup,
  OperationResult,
  PagedResult,
} from "./types/index.js";

/**
 * Group management operations.
 *
 * Primarily used for managing the "Deactivated Users" security group
 * and checking group memberships, but general enough for any group ops.
 */
export class GroupOperations {
  constructor(private client: Client) {}

  /**
   * Get a group by its ID.
   */
  async getById(groupId: string): Promise<OperationResult<EntraGroup>> {
    try {
      const group = await this.client
        .api(`/groups/${groupId}`)
        .select("id,displayName,description,groupTypes,securityEnabled,mailEnabled,membershipRule")
        .get();

      return { success: true, data: group as EntraGroup };
    } catch (err) {
      return this.handleError(err, "getById");
    }
  }

  /**
   * Search groups by display name.
   */
  async search(
    query: string,
    options: { top?: number } = {}
  ): Promise<OperationResult<PagedResult<EntraGroup>>> {
    try {
      const top = options.top ?? 25;

      const result = await this.client
        .api("/groups")
        .filter(`startswith(displayName,'${query}')`)
        .select("id,displayName,description,groupTypes,securityEnabled,mailEnabled")
        .top(top)
        .orderby("displayName")
        .get();

      return {
        success: true,
        data: {
          items: result.value as EntraGroup[],
          nextLink: result["@odata.nextLink"],
        },
      };
    } catch (err) {
      return this.handleError(err, "search");
    }
  }

  /**
   * List members of a group.
   */
  async listMembers(
    groupId: string,
    options: { top?: number; nextLink?: string } = {}
  ): Promise<OperationResult<PagedResult<{ id: string; displayName: string; userPrincipalName: string }>>> {
    try {
      const top = options.top ?? 25;

      let request;
      if (options.nextLink) {
        request = this.client.api(options.nextLink);
      } else {
        request = this.client
          .api(`/groups/${groupId}/members`)
          .select("id,displayName,userPrincipalName")
          .top(top);
      }

      const result = await request.get();

      return {
        success: true,
        data: {
          items: result.value,
          nextLink: result["@odata.nextLink"],
        },
      };
    } catch (err) {
      return this.handleError(err, "listMembers");
    }
  }

  /**
   * Add a user to a group.
   */
  async addMember(
    groupId: string,
    userId: string
  ): Promise<OperationResult> {
    try {
      await this.client.api(`/groups/${groupId}/members/$ref`).post({
        "@odata.id": `https://graph.microsoft.com/v1.0/users/${userId}`,
      });

      return { success: true };
    } catch (err) {
      return this.handleError(err, "addMember");
    }
  }

  /**
   * Remove a user from a group.
   */
  async removeMember(
    groupId: string,
    userId: string
  ): Promise<OperationResult> {
    try {
      await this.client
        .api(`/groups/${groupId}/members/${userId}/$ref`)
        .delete();

      return { success: true };
    } catch (err) {
      return this.handleError(err, "removeMember");
    }
  }

  /**
   * Check if a user is a member of a specific group.
   */
  async isMember(
    groupId: string,
    userId: string
  ): Promise<OperationResult<boolean>> {
    try {
      const result = await this.client
        .api(`/groups/${groupId}/members`)
        .filter(`id eq '${userId}'`)
        .select("id")
        .get();

      return {
        success: true,
        data: (result.value as Array<{ id: string }>).length > 0,
      };
    } catch (err) {
      return this.handleError(err, "isMember");
    }
  }

  /**
   * Create a new security group.
   * Useful for initial setup of the "Deactivated Users" group.
   */
  async createSecurityGroup(
    displayName: string,
    description: string
  ): Promise<OperationResult<EntraGroup>> {
    try {
      const group = await this.client.api("/groups").post({
        displayName,
        description,
        securityEnabled: true,
        mailEnabled: false,
        mailNickname: displayName.toLowerCase().replace(/\s+/g, "-"),
        groupTypes: [],
      });

      return { success: true, data: group as EntraGroup };
    } catch (err) {
      return this.handleError(err, "createSecurityGroup");
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

    console.error(`[EntraSDK:Groups] ${operation} failed:`, { code, message });

    return {
      success: false,
      error: { code, message, details: graphError },
    };
  }
}
