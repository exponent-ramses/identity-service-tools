"use server";

import { getEntraSDK } from "@/lib/entra";
import { requireSession } from "@/lib/session";

export async function searchUsers(query: string) {
  await requireSession();
  const sdk = getEntraSDK();
  return sdk.users.search(query);
}

export async function listUsers(options?: {
  top?: number;
  nextLink?: string;
}) {
  await requireSession();
  const sdk = getEntraSDK();
  return sdk.users.list(options);
}

export async function getUser(userId: string) {
  await requireSession();
  const sdk = getEntraSDK();
  return sdk.users.getById(userId);
}

export async function getUserByUsername(username: string) {
  await requireSession();
  const sdk = getEntraSDK();
  return sdk.users.getByUsername(username);
}

export async function createUser(input: {
  displayName: string;
  username: string;
  password: string;
  email?: string;
  forceChangePassword?: boolean;
  mobilePhone?: string;
  companyName?: string;
  jobTitle?: string;
  department?: string;
}) {
  await requireSession();
  const sdk = getEntraSDK();
  return sdk.users.create(input);
}

export async function updateUser(
  userId: string,
  input: {
    displayName?: string;
    accountEnabled?: boolean;
    mobilePhone?: string | null;
    companyName?: string | null;
    jobTitle?: string | null;
    department?: string | null;
  }
) {
  await requireSession();
  const sdk = getEntraSDK();
  return sdk.users.update(userId, input);
}

export async function resetPassword(
  userId: string,
  newPassword: string,
  forceChangeOnNextSignIn?: boolean
) {
  await requireSession();
  const sdk = getEntraSDK();
  return sdk.users.resetPassword({
    userId,
    newPassword,
    forceChangeOnNextSignIn,
  });
}

export async function disableUser(userId: string) {
  await requireSession();
  const sdk = getEntraSDK();
  return sdk.users.disable(userId);
}

export async function enableUser(userId: string) {
  await requireSession();
  const sdk = getEntraSDK();
  return sdk.users.enable(userId);
}

export async function deactivateUser(userId: string) {
  await requireSession();
  const sdk = getEntraSDK();
  return sdk.users.deactivate(userId);
}

export async function reactivateUser(userId: string) {
  await requireSession();
  const sdk = getEntraSDK();
  return sdk.users.reactivate(userId);
}

export async function deleteUser(userId: string) {
  await requireSession();
  const sdk = getEntraSDK();
  return sdk.users.delete(userId);
}

export async function getUserGroups(userId: string) {
  await requireSession();
  const sdk = getEntraSDK();
  return sdk.users.getGroups(userId);
}
