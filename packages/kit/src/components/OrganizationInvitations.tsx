import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, type Id } from "@/convex";

export function OrganizationInvitations() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.organizations.query.getMyInvitations,
    {},
    { initialNumItems: 10 },
  );
  const respond = useMutation(api.organizations.mutation.respondToInvitation);
  const navigate = useNavigate();
  const [pending, setPending] = useState<Id<"organizationInvitations"> | null>(
    null,
  );

  async function answer(
    invitationId: Id<"organizationInvitations">,
    accept: boolean,
  ): Promise<void> {
    setPending(invitationId);
    try {
      const organization = await respond({ invitationId, accept });
      toast.success(accept ? "Invitation accepted" : "Invitation declined");
      if (organization) void navigate(`/${organization.slug}`);
    } catch {
      toast.error(
        "This invitation could not be changed. It may have expired or the inviter's access may have changed.",
      );
    } finally {
      setPending(null);
    }
  }

  if (results.length === 0 && status === "Exhausted") return null;
  if (status === "LoadingFirstPage") return null;
  return (
    <section
      aria-label="Organization invitations"
      className="m-4 p-4 rounded border border-border bg-card space-y-3"
    >
      <h2 className="font-semibold">Organization invitations</h2>
      <p className="text-sm text-muted-foreground">
        Joining is your choice. Invitations expire after seven days.
      </p>
      {results.map((invitation) => (
        <div key={invitation._id} className="contained-action-card">
          <p className="min-w-0 break-words">
            <strong>{invitation.organizationName}</strong>
            {" — "}
            {invitation.role}
          </p>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              className="btn-primary"
              disabled={pending !== null}
              onClick={() => void answer(invitation._id, true)}
            >
              Accept
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={pending !== null}
              onClick={() => void answer(invitation._id, false)}
            >
              Decline
            </button>
          </div>
        </div>
      ))}
      {status === "CanLoadMore" ? (
        <button
          type="button"
          className="btn-secondary"
          onClick={() => loadMore(10)}
        >
          More invitations
        </button>
      ) : null}
      {status === "LoadingMore" ? (
        <p className="text-sm text-muted-foreground">Loading invitations…</p>
      ) : null}
    </section>
  );
}
