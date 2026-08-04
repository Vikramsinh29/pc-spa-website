import { handleAdminLicenseActivate } from "@/lib/admin/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  return handleAdminLicenseActivate(request, id);
}
