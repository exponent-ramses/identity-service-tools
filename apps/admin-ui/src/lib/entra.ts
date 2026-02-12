import { EntraSDK } from "@identity-migration/entra-sdk";

/**
 * Singleton Entra SDK instance for server-side use.
 *
 * Configured via environment variables:
 * - ENTRA_TENANT_ID: The Entra External ID tenant ID
 * - ENTRA_CLIENT_ID: The app registration client ID (Graph API permissions)
 * - ENTRA_CLIENT_SECRET: The app registration client secret
 * - ENTRA_ISSUER_DOMAIN: The issuer domain for local accounts (e.g. yourtenant.onmicrosoft.com)
 * - ENTRA_DEACTIVATED_GROUP_ID: Optional ID of the "Deactivated Users" security group
 */

let _sdk: EntraSDK | null = null;

export function getEntraSDK(): EntraSDK {
  if (_sdk) return _sdk;

  const tenantId = process.env.ENTRA_TENANT_ID;
  const clientId = process.env.ENTRA_CLIENT_ID;
  const clientSecret = process.env.ENTRA_CLIENT_SECRET;
  const issuerDomain = process.env.ENTRA_ISSUER_DOMAIN;

  if (!tenantId || !clientId || !clientSecret || !issuerDomain) {
    throw new Error(
      "Missing required Entra SDK environment variables. " +
        "Set ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET, and ENTRA_ISSUER_DOMAIN."
    );
  }

  _sdk = new EntraSDK({
    tenantId,
    clientId,
    clientSecret,
    issuerDomain,
    deactivatedGroupId: process.env.ENTRA_DEACTIVATED_GROUP_ID,
  });

  return _sdk;
}
