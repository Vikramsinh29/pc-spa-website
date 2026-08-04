import { createAuthOptionsResponse, handleSession } from "@/lib/auth/api";
import { getAuthApiDependencies } from "@/lib/auth/route-dependencies";
import { getServerEnvironment } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleSession(request, await getAuthApiDependencies());
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createAuthOptionsResponse(request, getServerEnvironment().siteUrl.origin);
}
