"use client";

import type { ReactElement, ReactNode } from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delay={500} closeDelay={0}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export function Tooltip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side="bottom" sideOffset={6} className="z-[70]">
          <TooltipPrimitive.Popup className="rounded-[6px] border border-separator bg-panel-raised px-2 py-1 text-footnote text-text shadow-lg shadow-black/40 transition-opacity duration-100 data-starting-style:opacity-0 data-ending-style:opacity-0">
            {label}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
