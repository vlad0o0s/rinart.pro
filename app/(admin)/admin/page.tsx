import { getAllProjects } from "@/lib/projects";
import { AdminApp } from "./ui/admin-app";
import { requireAdminSession } from "@/lib/admin-auth";

// Отключаем кеширование страницы админки, чтобы всегда загружать свежие данные
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  await requireAdminSession();
  const projects = await getAllProjects();
  
  // Сортируем проекты по order, чтобы порядок сохранялся при загрузке страницы
  const sortedProjects = [...projects].sort((a, b) => a.order - b.order);

  return <AdminApp initialProjects={sortedProjects} />;
}
