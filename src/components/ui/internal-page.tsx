import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

/** Vertical rhythm wrapper for authenticated app pages */
export function InternalPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-6", className)}>{children}</div>;
}
