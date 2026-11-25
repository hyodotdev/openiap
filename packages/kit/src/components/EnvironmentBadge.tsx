import { Badge } from "@/components/Badge";
import { NotReported } from "@/components/NotReported";

/** A purchase's store environment; "Not reported" when the store did not say. */
export function EnvironmentBadge({
  environment,
}: {
  environment?: string | null;
}) {
  if (!environment) {
    return (
      <NotReported reason="The store's response does not say whether this purchase is sandbox or production." />
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
