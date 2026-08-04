import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { RateLimit } from "@cloudflare/workers-types";
import { createOptionsResponse, handleBetaRequest } from "@/lib/beta-request/handler";
import { getServerEnvironment } from "@/lib/env";
import { createRepositories } from "@/lib/db";
import { getD1Client } from "@/lib/db/client";

export const dynamic = "force-dynamic";

type BetaRequestEnvironment = CloudflareEnv & {
  BETA_REQUEST_LIMITER?: RateLimit;
};

export async function POST(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const database = await getD1Client();
  const repositories = createRepositories(database);
  const serverEnvironment = getServerEnvironment();
  const bindings = env as BetaRequestEnvironment;

  return handleBetaRequest(request, {
    repository: repositories.betaAccessRequests,
    rateLimiter: bindings.BETA_REQUEST_LIMITER,
    approvedOrigin: serverEnvironment.siteUrl.origin,
    allowedOrigins: serverEnvironment.allowedOrigins,
    logger: (entry) => console.info(JSON.stringify(entry)),
  });
}

export async function OPTIONS(request: Request): Promise<Response> {
  const environment = getServerEnvironment();
  return createOptionsResponse(request, environment.siteUrl.origin, environment.allowedOrigins);
}
