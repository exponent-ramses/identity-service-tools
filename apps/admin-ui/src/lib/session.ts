import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * Get the current session on the server side.
 * Returns null if the user is not authenticated.
 */
export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

/**
 * Require authentication. Throws if not authenticated.
 * Use in server components and server actions.
 */
export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}
