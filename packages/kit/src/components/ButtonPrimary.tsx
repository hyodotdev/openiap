import { ButtonHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

interface ButtonPrimaryProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md" | "lg";
  variant?: "default" | "destructive" | "outline";
  loading?: boolean;
  fullWidth?: boolean;
}

// Variants reuse the shared button classes in index.css; sizes override height.
const VARIANT_CLASS = {
  default: "btn-gradient",
  destructive: "btn-destructive",
  outline: "btn-secondary",
};

const SIZE_CLASS = {
  sm: "h-9 px-3",
  md: "",
  lg: "btn-lg",
};

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
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        loading && "cursor-wait",
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading && (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
      )}
      {children}
    </button>
  ),
);

ButtonPrimary.displayName = "ButtonPrimary";
