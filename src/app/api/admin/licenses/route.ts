import { handleAdminLicenses } from "@/lib/admin/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleAdminLicenses(request);
}
