import { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> {
  options: DropdownOption[];
  className?: string;
}

export function Dropdown({ options, className = "", ...props }: DropdownProps) {
  return (
    <div className="relative">
      <select
        className={`appearance-none px-3 py-2 pr-10 bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer text-foreground ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            className="bg-background text-foreground"
          >
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
    </div>
  );
}
