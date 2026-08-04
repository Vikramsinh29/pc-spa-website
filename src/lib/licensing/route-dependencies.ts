import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { RateLimit } from "@cloudflare/workers-types";
import { createRepositories } from "../db";
import { getD1Client } from "../db/client";
import { getServerEnvironment } from "../env";
import type { LicensingApiDependencies } from "./api";

type LicensingEnvironment = CloudflareEnv & {
  BETA_REQUEST_LIMITER?: RateLimit;
  LICENSE_TOKEN_SECRET?: string;
  ADMIN_USER_IDS?: string;
};

export async function getLicensingApiDependencies(): Promise<LicensingApiDependencies> {
  const { env } = await getCloudflareContext({ async: true });
  const database = await getD1Client();
  const repositories = createRepositories(database);
  const bindings = env as LicensingEnvironment;

  return {
    licenses: repositories.licenses,
    devices: repositories.devices,
    sessions: repositories.sessions,
    rateLimiter: bindings.BETA_REQUEST_LIMITER,
    tokenSecret: bindings.LICENSE_TOKEN_SECRET,
    adminUserIds: new Set((bindings.ADMIN_USER_IDS ?? "").split(",").map((value) => value.trim()).filter(Boolean)),
    approvedOrigin: getServerEnvironment().siteUrl.origin,
    logger: (entry) => console.info(JSON.stringify(entry)),
  };
}
