import { redirect } from "next/navigation";

type PageProps = {
  params: { slug: string };
};

export default function LegacyProjectRedirect({ params }: PageProps) {
  redirect(`/${params.slug}`);
}

