export type SocialPlatform = "instagram" | "telegram" | "vk" | "pinterest" | "behance" | "youtube";

export type SocialLink = {
  id: string;
  platform: SocialPlatform;
  label: string;
  url: string;
};

export type ContactSettings = {
  heroTitle: string;
  phoneLabel: string;
  phoneHref: string;
  emailLabel: string;
  emailHref: string;
  locationLabel: string;
  heroImageUrl: string | null;
  footerTitle: string;
  cityLabel: string;
  whatsappLabel: string;
  whatsappUrl: string;
  backToTopLabel: string;
};

export type TeamMember = {
  id: number;
  name: string;
  role: string | null;
  label: string | null;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  isFeatured: boolean;
  order: number;
};

export type AppearanceSettings = {
  homeHeroImageUrl: string;
  transitionImageUrl: string;
};

