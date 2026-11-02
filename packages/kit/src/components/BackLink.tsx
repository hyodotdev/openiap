import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

const BACK_LINK_CLASS =
  "inline-flex items-center gap-1 rounded-sm text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

type BackLinkProps = { label: string; className?: string } & (
  | { to: string; onClick?: never; disabled?: never }
  | { onClick: () => void; to?: never; disabled?: boolean }
);

/**
 * The one back affordance: names the parent screen and links to it
 * explicitly, never to browser history, so it lands in the same place
 * however the reader arrived.
 */
export function BackLink({
  label,
  className = "",
  to,
  onClick,
  disabled,
}: BackLinkProps) {
  const content = (
    <>
      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      {label}
    </>
  );
  return to !== undefined ? (
    <Link to={to} className={`${BACK_LINK_CLASS} ${className}`}>
      {content}
    </Link>
  ) : (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${BACK_LINK_CLASS} ${className}`}
    >
      {content}
    </button>
  );
}
