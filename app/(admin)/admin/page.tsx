import { getAllProjects } from "@/lib/projects";
import { AdminApp } from "./ui/admin-app";
import { requireAdminSession } from "@/lib/admin-auth";

export default async function AdminPage() {
  await requireAdminSession();
  const projects = await getAllProjects();

  return <AdminApp initialProjects={projects} />;
}
