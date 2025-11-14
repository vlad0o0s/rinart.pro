export type ProjectSeoDetail = {
  title?: string;
  description?: string;
  keywords?: string[];
  ogImage?: string | null;
};

export type ProjectDetail = {
  id: number;
  slug: string;
  title: string;
  heroImageUrl?: string;
  descriptionBody: string[];
  descriptionHtml?: string | null;
  facts: Array<{ label: string; value: string }>;
  categories: string[];
  gallery: Array<{ id: number; url: string; caption?: string; order: number }>;
  schemes: Array<{ id: number; title: string; url: string; order: number }>;
  seo?: ProjectSeoDetail;
};

