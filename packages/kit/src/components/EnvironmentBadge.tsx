import { Badge } from "@/components/Badge";

/** A purchase's store environment; "Not reported" when the store did not say. */
export function EnvironmentBadge({
  environment,
}: {
  environment?: string | null;
}) {
  if (!environment) {
    return (
      <span
        className="whitespace-nowrap text-xs text-muted-foreground"
        title="The store's response does not say whether this purchase is sandbox or production."
      >
        {"Not reported"}
      </span>
    );
  }
  return (
    <Badge
      variant={environment === "Production" ? "outline" : "warning"}
      size="sm"
    >
      {environment}
    </Badge>
  );
}
