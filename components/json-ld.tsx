type JsonLdProps = {
  schema: Record<string, unknown> | Array<Record<string, unknown>>;
};

export function JsonLd({ schema }: JsonLdProps) {
  const entries = Array.isArray(schema) ? schema : [schema];
  return entries.map((entry, index) => (
    <script dangerouslySetInnerHTML={{ __html: JSON.stringify(entry) }} key={index} type="application/ld+json" />
  ));
}

