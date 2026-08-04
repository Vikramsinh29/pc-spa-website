import { AuthForm } from "@/components/auth/auth-form";
import { requireGuestPage } from "@/lib/auth/server";

export default async function LoginPage() {
  await requireGuestPage();
  return <AuthForm mode="login" />;
}
