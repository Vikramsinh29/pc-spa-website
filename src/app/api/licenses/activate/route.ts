import { createLicenseOptionsResponse, handleLicenseActivation } from "@/lib/licensing/api";
import { getLicensingApiDependencies } from "@/lib/licensing/route-dependencies";
import { getServerEnvironment } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleLicenseActivation(request, await getLicensingApiDependencies());
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createLicenseOptionsResponse(request, getServerEnvironment().siteUrl.origin);
}
