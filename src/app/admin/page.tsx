import { redirect } from "next/navigation";
import { requireAdminPageContext } from "@/lib/auth/server";

export default async function AdminPage() {
  await requireAdminPageContext();
  redirect("/admin/licenses");
}
