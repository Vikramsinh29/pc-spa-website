import { createLicenseOptionsResponse, handleAdminLicenseIssue } from "@/lib/licensing/api";
import { getServerEnvironment } from "@/lib/env";
import { getLicensingApiDependencies } from "@/lib/licensing/route-dependencies";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleAdminLicenseIssue(request, await getLicensingApiDependencies());
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createLicenseOptionsResponse(request, getServerEnvironment().siteUrl.origin);
}
