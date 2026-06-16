import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
      {...props}
    />
  );
}
