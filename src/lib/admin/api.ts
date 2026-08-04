import { getAuthenticatedRequestContext } from "../auth/server";
import { createRepositories } from "../db";
import { getD1Client } from "../db/client";
import { DatabaseError } from "../db/errors";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function requireAdminRequestContext(request: Request) {
  const authenticated = await getAuthenticatedRequestContext(request);
  if (!authenticated) {
    return json({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } }, 401);
  }

  const repositories = createRepositories(await getD1Client());
  await repositories.sessions.touch(authenticated.session.id, new Date().toISOString());

  const { isAdminUser } = await import("../auth/server");
  if (!isAdminUser(authenticated.user.id)) {
    return json({ error: { code: "FORBIDDEN", message: "Administrator access is required." } }, 403);
  }

  return authenticated;
}

export async function handleAdminUsers(request: Request): Promise<Response> {
  const authenticated = await requireAdminRequestContext(request);
  if (authenticated instanceof Response) return authenticated;
  const repositories = createRepositories(await getD1Client());
  const users = await repositories.users.listAll();
  return json({
    data: {
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      })),
    },
  });
}

export async function handleAdminBetaRequests(request: Request): Promise<Response> {
  const authenticated = await requireAdminRequestContext(request);
  if (authenticated instanceof Response) return authenticated;
  const repositories = createRepositories(await getD1Client());
  return json({ data: { betaRequests: await repositories.betaAccessRequests.listAll() } });
}

export async function handleAdminLicenses(request: Request): Promise<Response> {
  const authenticated = await requireAdminRequestContext(request);
  if (authenticated instanceof Response) return authenticated;
  const repositories = createRepositories(await getD1Client());
  return json({ data: { licenses: await repositories.licenses.listAll() } });
}

export async function handleAdminLicenseActivate(request: Request, licenseId: string): Promise<Response> {
  const authenticated = await requireAdminRequestContext(request);
  if (authenticated instanceof Response) return authenticated;
  const repositories = createRepositories(await getD1Client());
  try {
    await repositories.licenses.transitionState(licenseId, "active");
    const license = await repositories.licenses.findById(licenseId);
    console.info(JSON.stringify({ event: "admin_license_activate", actorUserId: authenticated.user.id, licenseId, outcome: "updated" }));
    return json({ data: { status: "active", license } });
  } catch (error) {
    if (error instanceof DatabaseError) return json({ error: { code: "DATABASE_ERROR", message: "License could not be updated." } }, 503);
    return json({ error: { code: "INVALID_STATE", message: "License could not be activated." } }, 409);
  }
}

export async function handleAdminLicenseRevoke(request: Request, licenseId: string): Promise<Response> {
  const authenticated = await requireAdminRequestContext(request);
  if (authenticated instanceof Response) return authenticated;
  const repositories = createRepositories(await getD1Client());
  try {
    await repositories.licenses.transitionState(licenseId, "revoked");
    const license = await repositories.licenses.findById(licenseId);
    console.info(JSON.stringify({ event: "admin_license_revoke", actorUserId: authenticated.user.id, licenseId, outcome: "updated" }));
    return json({ data: { status: "revoked", license } });
  } catch (error) {
    if (error instanceof DatabaseError) return json({ error: { code: "DATABASE_ERROR", message: "License could not be updated." } }, 503);
    return json({ error: { code: "INVALID_STATE", message: "License could not be revoked." } }, 409);
  }
}
