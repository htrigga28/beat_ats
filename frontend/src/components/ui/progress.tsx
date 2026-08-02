import * as ProgressPrimitive from "@radix-ui/react-progress";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Progress({
  className,
  value = 0,
  ...props
}: ComponentProps<typeof ProgressPrimitive.Root>) {
  const bounded = Math.max(0, Math.min(100, value ?? 0));
  return (
    <ProgressPrimitive.Root
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-slate-200", className)}
      value={bounded}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full bg-indigo-600 transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${100 - bounded}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
