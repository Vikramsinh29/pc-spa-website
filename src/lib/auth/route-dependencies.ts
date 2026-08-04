import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { RateLimit } from "@cloudflare/workers-types";
import { createRepositories } from "../db";
import { getD1Client } from "../db/client";
import { getServerEnvironment } from "../env";
import type { AuthApiDependencies } from "./api";

type AuthEnvironment = CloudflareEnv & { BETA_REQUEST_LIMITER?: RateLimit };

export async function getAuthApiDependencies(): Promise<AuthApiDependencies> {
  const { env } = await getCloudflareContext({ async: true });
  const environment = getServerEnvironment();
  const repositories = createRepositories(await getD1Client());
  const bindings = env as AuthEnvironment;
  return {
    users: repositories.users,
    sessions: repositories.sessions,
    rateLimiter: bindings.BETA_REQUEST_LIMITER,
    approvedOrigin: environment.siteUrl.origin,
    secureCookies: environment.siteUrl.protocol === "https:",
    logger: (entry) => console.info(JSON.stringify(entry)),
  };
}
