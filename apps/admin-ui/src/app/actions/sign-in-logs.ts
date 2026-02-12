"use server";

import { getEntraSDK } from "@/lib/entra";
import { requireSession } from "@/lib/session";

export async function getUserSignInLogs(
  userId: string,
  options?: { top?: number; daysBack?: number }
) {
  await requireSession();
  const sdk = getEntraSDK();
  return sdk.signInLogs.getByUser(userId, options);
}

export async function getFailedSignIns(options?: {
  top?: number;
  daysBack?: number;
}) {
  await requireSession();
  const sdk = getEntraSDK();
  return sdk.signInLogs.getFailedSignIns(options);
}
