import { createAuthOptionsResponse, handleRegister } from "@/lib/auth/api";
import { getAuthApiDependencies } from "@/lib/auth/route-dependencies";
import { getServerEnvironment } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleRegister(request, await getAuthApiDependencies());
}

export async function OPTIONS(request: Request): Promise<Response> {
  const environment = getServerEnvironment();
  return createAuthOptionsResponse(request, environment.siteUrl.origin, environment.allowedOrigins);
}
