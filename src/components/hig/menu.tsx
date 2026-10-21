"use client";

import type { ReactElement, ReactNode } from "react";
import { Menu } from "@base-ui/react/menu";
import { Check } from "lucide-react";

export type MenuToggle = { label: string; checked: boolean; onChange: (checked: boolean) => void };
export type MenuAction = { label: string; onSelect: () => void; destructive?: boolean };

const ITEM =
  "grid cursor-default grid-cols-[1rem_1fr] items-center gap-1.5 rounded-[6px] py-1.5 pl-1.5 pr-3 text-body outline-none select-none data-highlighted:bg-tint data-highlighted:text-on-tint";

export function PullDownMenu({
  trigger,
  title,
  toggles = [],
  actions = [],
}: {
  trigger: ReactElement;
  title?: string;
  toggles?: MenuToggle[];
  actions?: MenuAction[];
}) {
  return (
    <Menu.Root>
      <Menu.Trigger render={trigger} />
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end" className="z-[60] outline-none">
          <Menu.Popup className="material-menu min-w-52 origin-[var(--transform-origin)] rounded-[10px] border border-separator p-1 text-text shadow-2xl shadow-shade/50 outline-none transition-[transform,opacity] duration-100 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
            {title && <p className="px-2.5 pb-1 pt-1.5 text-footnote font-semibold text-text-dim">{title}</p>}
            {toggles.map((toggle) => (
              <Menu.CheckboxItem
                key={toggle.label}
                checked={toggle.checked}
                onCheckedChange={toggle.onChange}
                closeOnClick={false}
                className={ITEM}
              >
                <Menu.CheckboxItemIndicator className="col-start-1">
                  <Check className="size-3.5" strokeWidth={2.5} />
                </Menu.CheckboxItemIndicator>
                <span className="col-start-2">{toggle.label}</span>
              </Menu.CheckboxItem>
            ))}
            {toggles.length > 0 && actions.length > 0 && <Menu.Separator className="mx-2 my-1 h-px bg-separator" />}
            {actions.map((action) => (
              <Menu.Item
                key={action.label}
                onClick={action.onSelect}
                className={`${ITEM} ${action.destructive ? "text-danger data-highlighted:bg-danger data-highlighted:text-on-tint" : ""}`}
              >
                <span className="col-start-2">{action.label}</span>
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function MenuTriggerLabel({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-1.5">{children}</span>;
}
