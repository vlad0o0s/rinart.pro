import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/admin-auth";
import { createArticle, fetchAllArticles, isArticleSlugTaken } from "@/lib/article-repository";
import { ARTICLES_PATH, validateArticleInput } from "@/lib/articles";
import { moveInlineImagesToUploads } from "@/lib/inline-images-server";
import { notifyIndexNow } from "@/lib/indexnow";
import { getAllProjects } from "@/lib/projects";
import { SERVICE_PAGES } from "@/lib/services";

export const dynamic = "force-dynamic";

/** assertAdmin бросает готовый ответ 401 — отдаём его как есть. */
async function guard(request: NextRequest): Promise<Response | null> {
  try {
    await assertAdmin(request);
    return null;
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    throw error;
  }
}

export async function GET(request: NextRequest) {
  const denied = await guard(request);
  if (denied) {
    return denied;
  }

  const [articles, projects] = await Promise.all([fetchAllArticles(), getAllProjects()]);
  return NextResponse.json(
    {
      articles,
      services: SERVICE_PAGES,
      projects: projects.map((project) => ({ slug: project.slug, title: project.title })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const denied = await guard(request);
  if (denied) {
    return denied;
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ errors: ["Не удалось прочитать данные статьи"] }, { status: 400 });
  }

  // Картинки base64 из текста — в файлы до проверки, как в описаниях проектов.
  if (typeof body.bodyHtml === "string") {
    body.bodyHtml = await moveInlineImagesToUploads(body.bodyHtml, typeof body.title === "string" ? body.title : "");
  }

  const validation = validateArticleInput(body);
  if (!validation.ok) {
    return NextResponse.json({ errors: validation.errors }, { status: 400 });
  }
  if (await isArticleSlugTaken(validation.value.slug)) {
    return NextResponse.json({ errors: ["Статья с таким адресом уже есть"] }, { status: 409 });
  }

  const article = await createArticle(validation.value);
  revalidatePath(ARTICLES_PATH);
  // О черновиках не сообщаем: роботу нечего смотреть, пока статья не опубликована.
  if (article.status === "published") {
    void notifyIndexNow([`${ARTICLES_PATH}/${article.slug}`, ARTICLES_PATH]);
  }
  return NextResponse.json({ article }, { status: 201 });
}
