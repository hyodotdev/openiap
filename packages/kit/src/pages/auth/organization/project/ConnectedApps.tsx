import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Unplug } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ButtonSecondary } from "@/components/ButtonSecondary";
import { api } from "@/convex";
import type { Id } from "@/convex";

const day = (time: number) => new Date(time).toLocaleDateString();

/** Connectors (Claude, ChatGPT) signed in to this project, with a way out. */
export function ConnectedApps({
  projectId,
}: {
  projectId: Id<"projects">;
}): React.JSX.Element | null {
  const grants = useQuery(api.oauth.query.listProjectGrants, { projectId });
  const disconnect = useMutation(api.oauth.mutation.disconnect);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  if (!grants) return null;

  async function end(grant: { id: Id<"oauthGrants">; clientName: string }) {
    if (
      !confirm(
        `Disconnect ${grant.clientName}? It loses access to this project at once.`,
      )
    ) {
      return;
    }
    setPending((ids) => new Set(ids).add(grant.id));
    try {
      await disconnect({ grantId: grant.id });
      toast.success(`${grant.clientName} disconnected`);
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setPending((ids) => {
        const rest = new Set(ids);
        rest.delete(grant.id);
        return rest;
      });
    }
  }

  return (
    <section className="mt-8">
      <h3 className="mb-1 text-lg font-semibold">Connected apps</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Claude and ChatGPT connections to this project. To add one, see{" "}
        <Link to="/docs/ai-assistants" className="text-primary underline">
          AI assistants
        </Link>
        .
      </p>
      <ul className="space-y-3">
        {grants.map((grant) => (
          <li
            key={grant.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
          >
            <div className="min-w-0">
              <p className="font-medium">
                {grant.clientName} ·{" "}
                {grant.scope === "write" ? "Read and change" : "Read only"}
              </p>
              {/* Each phrase wraps as a unit on narrow screens. */}
              <p className="text-sm text-muted-foreground wrap-anywhere">
                <span className="inline-block">
                  Connected{grant.connectedBy && ` by ${grant.connectedBy}`} on{" "}
                  {day(grant.createdAt)}
                </span>
                {" · "}
                <span className="inline-block">
                  Last used {day(grant.lastUsedAt)}
                </span>
              </p>
            </div>
            <ButtonSecondary
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending.has(grant.id)}
              onClick={() => void end(grant)}
              aria-label={`Disconnect ${grant.clientName}`}
              className="gap-2"
            >
              <Unplug className="h-4 w-4" aria-hidden="true" />
              Disconnect
            </ButtonSecondary>
          </li>
        ))}
      </ul>
    </section>
  );
}
