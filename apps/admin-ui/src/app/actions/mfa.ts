"use server";

import { getEntraSDK } from "@/lib/entra";
import { requireSession } from "@/lib/session";

export async function listAuthMethods(userId: string) {
  await requireSession();
  const sdk = getEntraSDK();
  return sdk.mfa.listMethods(userId);
}

export async function getPhoneMethods(userId: string) {
  await requireSession();
  const sdk = getEntraSDK();
  return sdk.mfa.getPhoneMethods(userId);
}

export async function getEmailMethods(userId: string) {
  await requireSession();
  const sdk = getEntraSDK();
  return sdk.mfa.getEmailMethods(userId);
}

export async function deletePhoneMethod(userId: string, methodId: string) {
  await requireSession();
  const sdk = getEntraSDK();
  return sdk.mfa.deletePhoneMethod(userId, methodId);
}

export async function deleteEmailMethod(userId: string, methodId: string) {
  await requireSession();
  const sdk = getEntraSDK();
  return sdk.mfa.deleteEmailMethod(userId, methodId);
}

export async function resetAllMfaMethods(userId: string) {
  await requireSession();
  const sdk = getEntraSDK();
  return sdk.mfa.resetAllMethods(userId);
}
