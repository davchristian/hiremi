"use client";

import type { ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { IconButton } from "@/components/hig/button";
import { cn } from "@/lib/utils";

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeButton = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  closeButton?: boolean;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-shade/55 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          className={cn(
            "fixed z-50 flex max-h-[92dvh] flex-col border border-separator bg-panel-raised text-text shadow-2xl shadow-shade/60 outline-none transition-[transform,opacity] duration-200 ease-standard data-ending-style:opacity-0 data-starting-style:opacity-0",
            "inset-x-0 bottom-0 rounded-t-[var(--radius-sheet)] pb-[env(safe-area-inset-bottom)] data-ending-style:translate-y-6 data-starting-style:translate-y-6",
            "desk:inset-x-auto desk:bottom-auto desk:left-1/2 desk:top-1/2 desk:w-[calc(100%-2rem)] desk:-translate-x-1/2 desk:-translate-y-1/2 desk:rounded-[var(--radius-sheet)] desk:pb-0 desk:data-ending-style:translate-y-[-48%] desk:data-starting-style:translate-y-[-48%] desk:data-ending-style:scale-[0.98] desk:data-starting-style:scale-[0.98]",
            size === "sm" ? "desk:max-w-[400px]" : size === "md" ? "desk:max-w-[520px]" : "desk:max-w-[640px]",
          )}
        >
          <div aria-hidden className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-fill-strong desk:hidden" />
          <div className="flex shrink-0 items-start gap-3 px-5 pb-1 pt-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-headline text-[15px]">{title}</Dialog.Title>
              {description && <Dialog.Description className="mt-1 text-callout text-text-muted">{description}</Dialog.Description>}
            </div>
            {closeButton && (
              <IconButton
                label="Close"
                icon={<X strokeWidth={2.5} />}
                variant="gray"
                size="sm"
                tooltip={false}
                onClick={onClose}
                className="-mr-1 -mt-0.5 rounded-full text-text-muted hover:text-text [&_svg]:size-3.5"
              />
            )}
          </div>
          {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">{children}</div>}
          {footer && (
            <div className="flex shrink-0 flex-col-reverse gap-2 px-5 pb-5 pt-2 desk:flex-row desk:justify-end">{footer}</div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
