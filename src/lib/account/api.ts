import { getAuthenticatedRequestContext } from "../auth/server";
import { createRepositories } from "../db";
import { getD1Client } from "../db/client";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function handleAccountLicenses(request: Request): Promise<Response> {
  const authenticated = await getAuthenticatedRequestContext(request);
  if (!authenticated) {
    return json({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } }, 401);
  }

  const repositories = createRepositories(await getD1Client());
  const licenses = await repositories.licenses.listByUserId(authenticated.user.id);

  return json({
    data: {
      user: {
        id: authenticated.user.id,
        email: authenticated.user.email,
        displayName: authenticated.user.display_name,
      },
      session: {
        id: authenticated.session.id,
        expiresAt: authenticated.session.expires_at,
      },
      licenses,
    },
  });
}
