import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, X } from "lucide-react";
import { toast } from "sonner";

import { copyTextToClipboard } from "@/lib/clipboard";

export interface GeneratedApiKey {
  name: string;
  key: string;
}

interface GeneratedApiKeyNoticeProps {
  apiKey: GeneratedApiKey;
  onDismiss: () => void;
}

export function GeneratedApiKeyNotice({
  apiKey,
  onDismiss,
}: GeneratedApiKeyNoticeProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const timer = window.setTimeout(() => setCopied(false), 1_500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async (): Promise<void> => {
    const ok = await copyTextToClipboard(apiKey.key);
    if (!ok) {
      toast.message("Copy failed. Select the key manually.");
      return;
    }

    setCopied(true);
    toast.success("API key copied to clipboard");
  };

  return (
    <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              {apiKey.name}
            </h3>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            {"This full key is shown once. Store it before leaving this page."}
          </p>
          <code className="block max-w-full select-all overflow-x-auto rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground">
            {apiKey.key}
          </code>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
            aria-label="Dismiss API key"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
