import { redirect } from "next/navigation";
import { AdminLoginForm } from "../ui/admin-login-form";
import { getAdminSessionFromCookies } from "@/lib/admin-auth";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { getSocialLinks } from "@/lib/site-settings";
import styles from "../ui/admin.module.css";

export default async function AdminLoginPage() {
  const session = await getAdminSessionFromCookies();
  if (session) {
    redirect("/admin");
  }

  const socialLinks = await getSocialLinks();

  return (
    <div className={styles.loginShell}>
      <SiteHeader showDesktopNav={false} showDesktopBrand socialLinks={socialLinks} />
      <AdminLoginForm />
      <Footer />
    </div>
  );
}
