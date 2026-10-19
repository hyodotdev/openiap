import { ButtonHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

interface ButtonSecondaryProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md";
  variant?: "default" | "destructive";
  fullWidth?: boolean;
}

export const ButtonSecondary = forwardRef<
  HTMLButtonElement,
  ButtonSecondaryProps
>(
  (
    {
      className,
      size = "md",
      variant = "default",
      fullWidth = false,
      ...props
    },
    ref,
  ) => {
    const baseStyles = [
      "inline-flex items-center justify-center",
      "rounded-lg border border-border",
      "bg-transparent",
      // Danger Badge text colors; --destructive text fails 4.5:1 on cards.
      variant === "destructive"
        ? "text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
        : "text-foreground hover:bg-muted",
      "text-sm font-medium",
      "transition-colors",
      "focus-visible:outline-none",
      "focus-visible:ring-2 focus-visible:ring-primary/30",
      "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:opacity-50 disabled:pointer-events-none",
    ];

    const sizeStyles =
      size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-sm";

    const widthStyles = fullWidth ? "w-full" : "";

    return (
      <button
        ref={ref}
        className={clsx(baseStyles, sizeStyles, widthStyles, className)}
        {...props}
      />
    );
  },
);

ButtonSecondary.displayName = "ButtonSecondary";
