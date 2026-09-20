import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/admin-auth";
import { deleteArticle, fetchArticleById, isArticleSlugTaken, updateArticle } from "@/lib/article-repository";
import { ARTICLES_PATH, validateArticleInput } from "@/lib/articles";
import { moveInlineImagesToUploads } from "@/lib/inline-images-server";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

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

async function readId(context: Context): Promise<number | null> {
  const { id } = await context.params;
  const value = Number(id);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export async function PATCH(request: NextRequest, context: Context) {
  const denied = await guard(request);
  if (denied) {
    return denied;
  }
  const id = await readId(context);
  const existing = id ? await fetchArticleById(id) : null;
  if (!id || !existing) {
    return NextResponse.json({ errors: ["Статья не найдена"] }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ errors: ["Не удалось прочитать данные статьи"] }, { status: 400 });
  }

  if (typeof body.bodyHtml === "string") {
    body.bodyHtml = await moveInlineImagesToUploads(body.bodyHtml, typeof body.title === "string" ? body.title : existing.title);
  }

  // Дату публикации не теряем: если в форме её стёрли, остаётся прежняя.
  if (!body.publishedAt && existing.publishedAt) {
    body.publishedAt = existing.publishedAt;
  }

  const validation = validateArticleInput(body);
  if (!validation.ok) {
    return NextResponse.json({ errors: validation.errors }, { status: 400 });
  }
  if (await isArticleSlugTaken(validation.value.slug, id)) {
    return NextResponse.json({ errors: ["Статья с таким адресом уже есть"] }, { status: 409 });
  }

  const article = await updateArticle(id, validation.value);
  revalidatePath(ARTICLES_PATH);
  revalidatePath(`${ARTICLES_PATH}/${existing.slug}`);
  if (article && article.slug !== existing.slug) {
    revalidatePath(`${ARTICLES_PATH}/${article.slug}`);
  }
  return NextResponse.json({ article });
}

export async function DELETE(request: NextRequest, context: Context) {
  const denied = await guard(request);
  if (denied) {
    return denied;
  }
  const id = await readId(context);
  const existing = id ? await fetchArticleById(id) : null;
  if (!id || !existing) {
    return NextResponse.json({ errors: ["Статья не найдена"] }, { status: 404 });
  }

  await deleteArticle(id);
  revalidatePath(ARTICLES_PATH);
  revalidatePath(`${ARTICLES_PATH}/${existing.slug}`);
  return NextResponse.json({ ok: true });
}
