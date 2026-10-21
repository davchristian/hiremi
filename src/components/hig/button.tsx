"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/hig/tooltip";

export type ButtonVariant = "gray" | "accent" | "plain" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  gray: "bg-fill-strong text-text hover:bg-fill-hover",
  accent: "bg-tint text-on-tint font-semibold hover:bg-tint-hover",
  plain: "bg-transparent text-tint hover:bg-tint-soft",
  destructive: "bg-danger-soft text-danger hover:bg-danger-hover",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-7 gap-1.5 px-2.5 text-callout",
  md: "h-8 gap-1.5 px-3.5 text-body",
  lg: "h-10 gap-2 px-4 text-body",
};

const ICON_SIZES: Record<ButtonSize, string> = {
  sm: "size-7",
  md: "size-8",
  lg: "size-10",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "gray", size = "md", icon, className, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-control font-medium transition-[background-color,transform,opacity] duration-150 ease-standard active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
});

export type IconButtonProps = Omit<ButtonProps, "children" | "icon"> & {
  label: string;
  icon: ReactNode;
  tooltip?: boolean;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, size = "md", variant = "plain", className, tooltip = true, ...props },
  ref,
) {
  const button = (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      aria-label={label}
      className={cn("px-0", ICON_SIZES[size], variant === "plain" && "text-text-muted hover:bg-fill hover:text-text", className)}
      {...props}
    >
      {icon}
    </Button>
  );
  return tooltip ? <Tooltip label={label}>{button}</Tooltip> : button;
});
