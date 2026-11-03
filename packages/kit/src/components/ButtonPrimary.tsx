import { ButtonHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

interface ButtonPrimaryProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md" | "lg";
  variant?: "default" | "destructive" | "outline";
  loading?: boolean;
  fullWidth?: boolean;
}

export const ButtonPrimary = forwardRef<HTMLButtonElement, ButtonPrimaryProps>(
  (
    {
      children,
      className,
      size = "md",
      variant = "default",
      loading = false,
      fullWidth = false,
      disabled,
      ...props
    },
    ref,
  ) => {
    const baseStyles = [
      "inline-flex items-center justify-center gap-2",
      "font-semibold tracking-wide",
      "rounded-xl",
      "transition-all duration-200 ease-out",
      "transform active:scale-[0.98]",
      "relative overflow-hidden",
      "select-none",
      "focus-visible:outline-none",
      "focus-visible:ring-2",
      "focus-visible:ring-primary/30",
      "focus-visible:ring-offset-2",
      "focus-visible:ring-offset-background",
    ];

    const sizeStyles = {
      sm: "px-4 py-2 text-sm",
      md: "px-6 py-3 text-base",
      lg: "px-8 py-4 text-lg",
    };

    const variantStyles = {
      default: [
        "bg-primary text-primary-foreground",
        "border border-primary",
        "hover:bg-primary/90",
      ].join(" "),
      destructive: [
        "bg-destructive text-destructive-foreground",
        "border border-destructive",
        "hover:bg-destructive/90",
      ].join(" "),
      outline: [
        "bg-transparent",
        "text-foreground",
        "border border-border",
        "hover:border-primary/70",
        "hover:text-primary",
        "hover:bg-primary/5",
        "shadow-[0_1px_2px_rgba(15,23,42,0.08)]",
        "hover:shadow-[0_6px_18px_rgba(15,23,42,0.08)]",
      ].join(" "),
    };

    const disabledStyles = [
      "disabled:opacity-50",
      "disabled:cursor-not-allowed",
      "disabled:transform-none",
      "disabled:shadow-none",
      "disabled:hover:shadow-none",
    ].join(" ");

    const loadingStyles = loading ? "cursor-wait" : "";

    const widthStyles = fullWidth ? "w-full" : "";

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          baseStyles,
          sizeStyles[size],
          variantStyles[variant],
          disabledStyles,
          loadingStyles,
          widthStyles,
          className,
        )}
        {...props}
      >
        {loading && (
          <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
        )}
        {children}
      </button>
    );
  },
);

ButtonPrimary.displayName = "ButtonPrimary";
