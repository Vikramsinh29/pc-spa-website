import { handleAccountLicenses } from "@/lib/account/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleAccountLicenses(request);
}
