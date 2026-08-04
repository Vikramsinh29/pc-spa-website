import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createRepositories } from "../db";
import { getD1Client } from "../db/client";
import type { SessionRecord, UserRecord } from "../db/types";
import { getServerEnvironment } from "../env";
import { hashValue } from "../licensing/crypto";
import { authSessionCookieName, getSessionCookie } from "./session";

export type AuthenticatedRequestContext = {
  session: SessionRecord;
  user: UserRecord;
};

async function findAuthenticatedRequestContextFromToken(token: string | null): Promise<AuthenticatedRequestContext | null> {
  if (!token) return null;
  const repositories = createRepositories(await getD1Client());
  const session = await repositories.sessions.findByTokenHash(await hashValue(token));
  if (!session || session.revoked_at || session.expires_at <= new Date().toISOString()) return null;
  const user = await repositories.users.findById(session.user_id);
  if (!user) return null;
  return { session, user };
}

export async function getAuthenticatedRequestContext(request: Request): Promise<AuthenticatedRequestContext | null> {
  return findAuthenticatedRequestContextFromToken(getSessionCookie(request));
}

export async function getAuthenticatedPageContext(): Promise<AuthenticatedRequestContext | null> {
  const cookieStore = await cookies();
  return findAuthenticatedRequestContextFromToken(cookieStore.get(authSessionCookieName)?.value ?? null);
}

export async function requireAuthenticatedPageContext(): Promise<AuthenticatedRequestContext> {
  const context = await getAuthenticatedPageContext();
  if (!context) redirect("/login");
  return context;
}

export async function requireGuestPage(): Promise<void> {
  if (await getAuthenticatedPageContext()) redirect("/account");
}

export function isAdminUser(userId: string): boolean {
  return getServerEnvironment().adminUserIds.has(userId);
}

export async function requireAdminPageContext(): Promise<AuthenticatedRequestContext> {
  const context = await requireAuthenticatedPageContext();
  if (!isAdminUser(context.user.id)) redirect("/account");
  return context;
}
