import { redirect } from "next/navigation";
import { getAuthenticatedPageContext, isAdminUser } from "@/lib/auth/server";

export default async function AdminPage() {
  const context = await getAuthenticatedPageContext();
  if (!context) redirect("/login");
  if (!isAdminUser(context.user.id)) return redirect("/account");
  redirect("/admin/licenses");
}
