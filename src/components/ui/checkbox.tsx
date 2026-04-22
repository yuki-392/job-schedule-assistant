"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { cn } from "@/lib/utils";

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-sm border border-slate-400 bg-white data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-white">
        <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
          <path
            d="M13.485 3.515a.75.75 0 0 1 0 1.06l-6.364 6.364a.75.75 0 0 1-1.06 0L2.515 7.394a.75.75 0 0 1 1.06-1.06l3.016 3.015 5.834-5.834a.75.75 0 0 1 1.06 0Z"
            fill="currentColor"
          />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
