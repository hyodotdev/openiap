import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { toast } from "sonner";
import { api, type Id } from "@/convex";

export function OrganizationPendingInvitations({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.organizations.query.getPendingInvitations,
    { organizationId },
    { initialNumItems: 10 },
  );
  const cancel = useMutation(api.organizations.mutation.cancelInvitation);
  const [pending, setPending] = useState(false);
  async function withdraw(invitationId: Id<"organizationInvitations">) {
    setPending(true);
    try {
      await cancel({ invitationId });
      toast.success("Invitation withdrawn");
    } catch {
      toast.error("Could not withdraw the invitation. Refresh and try again.");
    } finally {
      setPending(false);
    }
  }
  if (
    status === "LoadingFirstPage" ||
    (results.length === 0 && status === "Exhausted")
  )
    return null;
  return (
    <section aria-label="Pending invitations" className="mb-6 space-y-3">
      <h3 className="font-medium">Pending invitations</h3>
      {results.map((invitation) => (
        <div key={invitation._id} className="contained-action-card">
          <p className="min-w-0 break-words">
            {invitation.email} — {invitation.role}
          </p>
          <button
            type="button"
            className="btn-secondary"
            disabled={pending}
            onClick={() => void withdraw(invitation._id)}
          >
            Withdraw invitation
          </button>
        </div>
      ))}
      {status === "CanLoadMore" ? (
        <button
          type="button"
          className="btn-secondary"
          onClick={() => loadMore(10)}
        >
          More pending invitations
        </button>
      ) : null}
      {status === "LoadingMore" ? (
        <p className="text-sm text-muted-foreground">Loading invitations…</p>
      ) : null}
    </section>
  );
}
