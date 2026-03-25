import type { HTMLAttributes } from "react";
import { cn } from "./lib";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-secondary px-2 py-1 text-xs font-medium text-white",
        className,
      )}
      {...props}
    />
  );
}
