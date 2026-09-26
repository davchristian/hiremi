"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[85dvh] max-w-md overflow-y-auto border border-hairline bg-panel p-5 ring-0 shadow-xl shadow-black/40 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm font-normal text-text-muted">
            <span className="text-applied">$</span> {title}
          </DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
