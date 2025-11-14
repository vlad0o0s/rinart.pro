type RichTextProps = {
  html: string;
  className?: string;
};

export function RichText({ html, className }: RichTextProps) {
  if (!html.trim()) {
    return null;
  }

  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

