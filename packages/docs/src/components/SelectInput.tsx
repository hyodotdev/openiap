import type { ReactElement, SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

export default function SelectInput({
  children,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>): ReactElement {
  return (
    <div className="select-input">
      <select {...props} className={`select-input-control ${className}`}>
        {children}
      </select>
      <ChevronDown
        className="select-input-icon"
        size={16}
        strokeWidth={1.8}
        aria-hidden="true"
      />
    </div>
  );
}
