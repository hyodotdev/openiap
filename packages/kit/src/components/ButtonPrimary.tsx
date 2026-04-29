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
        "bg-gradient-to-b from-primary to-primary/90",
        "text-primary-foreground",
        "shadow-lg shadow-primary/25",
        "hover:shadow-xl hover:shadow-primary/30",
        "hover:from-primary/95 hover:to-primary/85",
        "border border-primary/20",
        "before:absolute before:inset-0",
        "before:bg-gradient-to-b before:from-white/20 before:to-transparent",
        "before:opacity-0 hover:before:opacity-100",
        "before:transition-opacity before:duration-200",
      ].join(" "),
      destructive: [
        "bg-gradient-to-b from-red-500 to-red-600",
        "text-white",
        "shadow-lg shadow-red-500/25",
        "hover:shadow-xl hover:shadow-red-500/30",
        "hover:from-red-600 hover:to-red-700",
        "border border-red-600/20",
        "before:absolute before:inset-0",
        "before:bg-gradient-to-b before:from-white/20 before:to-transparent",
        "before:opacity-0 hover:before:opacity-100",
        "before:transition-opacity before:duration-200",
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
        "before:hidden",
      ].join(" "),
    };

    const disabledStyles = [
      "disabled:opacity-50",
      "disabled:cursor-not-allowed",
      "disabled:transform-none",
      "disabled:shadow-none",
      "disabled:hover:shadow-none",
      "disabled:before:opacity-0",
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
