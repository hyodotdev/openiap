import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Copy } from "lucide-react";
import { Highlight, themes, type PrismTheme } from "prism-react-renderer";

interface CodeBlockProps {
  /** Freeform label shown in the block's header (e.g. `"POST /v1/purchase/verify"`). */
  title?: string;
  /** Language hint for syntax highlighting. Defaults to `"text"` when omitted. */
  language?: string;
  /** The raw code. Preserved verbatim; `children` is tokenized by Prism. */
  children: string;
}

// Prism's language ids don't always match what an author types — `sh`
// / `shell` / `zsh` all resolve to `bash`, `ts` to `tsx`, etc.
const LANGUAGE_ALIASES: Record<string, string> = {
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  kt: "kotlin",
  ts: "tsx",
  tsx: "tsx",
  js: "jsx",
  jsx: "jsx",
  yml: "yaml",
};

const LIGHT_THEME: PrismTheme = themes.github;
const DARK_THEME: PrismTheme = themes.vsDark;

function resolveLanguage(raw: string | undefined): string {
  if (!raw) return "text";
  const lower = raw.toLowerCase();
  return LANGUAGE_ALIASES[lower] ?? lower;
}

/**
 * Tracks whether Tailwind's `dark` class is active on <html>. The
 * rest of the app uses `darkMode: "class"`, so we mirror however the
 * theme is toggled elsewhere (ThemeDropdown, system preference, etc.).
 *
 * The MutationObserver is module-level so a docs page with N
 * `CodeBlock`s installs exactly one observer instead of N. Components
 * just subscribe to the shared store via `useSyncExternalStore`. The
 * /docs/api page renders ~10 blocks; the previous per-block observer
 * was both wasted setup and a noticeable hit on tab-switch GC.
 */
const isDarkSubscribers = new Set<() => void>();
let isDarkObserverInstalled = false;
let isDarkSnapshot =
  typeof document !== "undefined" &&
  document.documentElement.classList.contains("dark");

function ensureIsDarkObserver(): void {
  if (isDarkObserverInstalled || typeof document === "undefined") return;
  isDarkObserverInstalled = true;
  new MutationObserver(() => {
    const next = document.documentElement.classList.contains("dark");
    if (next === isDarkSnapshot) return;
    isDarkSnapshot = next;
    for (const notify of isDarkSubscribers) notify();
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
}

function subscribeIsDark(notify: () => void): () => void {
  ensureIsDarkObserver();
  isDarkSubscribers.add(notify);
  return () => {
    isDarkSubscribers.delete(notify);
  };
}

function getIsDarkSnapshot(): boolean {
  return isDarkSnapshot;
}

// SSR-safe server snapshot — defaults to light theme for the static
// HTML the build emits; the client hydrates to the correct value on
// first commit.
function getIsDarkServerSnapshot(): boolean {
  return false;
}

function useIsDarkMode(): boolean {
  return useSyncExternalStore(
    subscribeIsDark,
    getIsDarkSnapshot,
    getIsDarkServerSnapshot,
  );
}

export function CodeBlock({ title, language, children }: CodeBlockProps) {
  // 3-state: `idle` (default), `copied` (success), `error`
  // (clipboard API refused — e.g. non-secure context, permissions
  // denied, or browser doesn't implement it). Using an explicit
  // enum instead of a boolean keeps the label honest: we never
  // claim "Copied" when the underlying writeText() failed.
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const isDark = useIsDarkMode();
  const lang = resolveLanguage(language);

  // Auto-reset the status pill via useEffect so the timer is cleaned
  // up on unmount — previously a raw setTimeout could fire after the
  // component was gone and leak a state update on a dead tree.
  useEffect(() => {
    if (copyState === "idle") return;
    const timer = window.setTimeout(() => setCopyState("idle"), 1_500);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const handleCopy = async () => {
    if (!navigator.clipboard?.writeText) {
      setCopyState("error");
      return;
    }
    try {
      await navigator.clipboard.writeText(children);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  };

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-border bg-muted/30">
      {(title || language) && (
        <div className="flex items-center justify-between border-b border-border bg-muted/60 px-4 py-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {title && (
              <span className="font-mono font-medium text-foreground">
                {title}
              </span>
            )}
            {language && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                {language}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-live="polite"
          >
            {copyState === "copied" ? (
              <>
                <Check className="h-3 w-3" />
                Copied
              </>
            ) : copyState === "error" ? (
              <>
                <Copy className="h-3 w-3" />
                Copy failed
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </button>
        </div>
      )}
      <Highlight
        theme={isDark ? DARK_THEME : LIGHT_THEME}
        code={children.replace(/\n$/, "")}
        language={lang}
      >
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={`${className} overflow-x-auto px-4 py-3 text-sm leading-relaxed`}
            style={{ ...style, background: "transparent" }}
          >
            {tokens.map((line, i) => {
              const lineProps = getLineProps({ line });
              return (
                <div key={i} {...lineProps}>
                  {line.map((token, j) => {
                    const tokenProps = getTokenProps({ token });
                    return <span key={j} {...tokenProps} />;
                  })}
                </div>
              );
            })}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
