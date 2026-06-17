"use client";

import * as Lucide from "lucide-react";
import type { LucideProps } from "lucide-react";

export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = (Lucide as unknown as Record<string, React.ComponentType<LucideProps>>)[name];
  if (!Cmp) return null;
  return <Cmp {...props} />;
}
