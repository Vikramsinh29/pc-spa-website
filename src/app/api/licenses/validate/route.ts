import { createLicenseOptionsResponse, handleLicenseValidation } from "@/lib/licensing/api";
import { getLicensingApiDependencies } from "@/lib/licensing/route-dependencies";
import { getServerEnvironment } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleLicenseValidation(request, await getLicensingApiDependencies());
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createLicenseOptionsResponse(request, getServerEnvironment().siteUrl.origin);
}
