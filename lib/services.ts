/**
 * Страницы услуг — один список на весь сайт. По нему статьи ссылаются на услугу,
 * а новые страницы услуг (интерьеры, бани, реконструкция) появятся здесь же.
 */
export type ServicePage = {
  path: string;
  label: string;
};

export const SERVICE_PAGES: ServicePage[] = [{ path: "/proektirovanie", label: "Проектирование частных домов" }];
