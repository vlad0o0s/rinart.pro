import { redirect } from "next/navigation";
import { AdminLoginForm } from "../ui/admin-login-form";
import { getAdminSessionFromCookies } from "@/lib/admin-auth";

export default async function AdminLoginPage() {
  const session = await getAdminSessionFromCookies();
  if (session) {
    redirect("/admin");
  }

  return <AdminLoginForm />;
}
