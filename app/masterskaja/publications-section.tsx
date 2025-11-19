import { getPublications } from "@/lib/site-settings";
import { PublicationsSectionClient } from "./publications-section-client";

export async function PublicationsSection() {
  const publications = await getPublications();

  return <PublicationsSectionClient publications={publications} />;
}
