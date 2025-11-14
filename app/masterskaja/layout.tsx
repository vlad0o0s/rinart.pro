import type { ReactNode } from "react";

export default function MasterskajaLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[1920px]">{children}</div>;
}

