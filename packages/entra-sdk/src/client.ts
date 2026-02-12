import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import {
  TokenCredentialAuthenticationProvider,
  type TokenCredentialAuthenticationProviderOptions,
} from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js";
import type { EntraSDKConfig } from "./types/index.js";

/**
 * Creates an authenticated Microsoft Graph client using client credentials flow.
 *
 * This is the foundation for all SDK operations — it handles token acquisition
 * and refresh transparently via @azure/identity.
 */
export function createGraphClient(config: EntraSDKConfig): Client {
  const credential = new ClientSecretCredential(
    config.tenantId,
    config.clientId,
    config.clientSecret
  );

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  } as TokenCredentialAuthenticationProviderOptions);

  return Client.initWithMiddleware({
    authProvider,
    debugLogging: process.env.NODE_ENV === "development",
  });
}
