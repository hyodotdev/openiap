import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

interface SelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "children"
> {
  options: ReadonlyArray<{ value: string; label: string }>;
}

/**
 * A native select whose arrow sits inside the field, clear of its edge.
 * Pass vertical and left padding in `className`; the right side is reserved.
 */
export function Select({
  options,
  className = "",
  ...props
}: SelectProps): React.JSX.Element {
  return (
    <div className="relative">
      <select
        {...props}
        className={`w-full cursor-pointer appearance-none rounded border border-border bg-background pr-10 text-foreground disabled:cursor-not-allowed ${className}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
