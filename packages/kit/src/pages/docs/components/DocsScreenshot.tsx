import { useState } from "react";
import { ImageOff } from "lucide-react";

/**
 * Renders a dashboard screenshot, but gracefully degrades when the
 * file isn't on disk yet — docs often ship ahead of the capture
 * pipeline, and a broken-image icon looks worse than no image at
 * all. On `onError` we swap the <img> for a dashed placeholder tile
 * so the prose stays readable and the figure's caption still carries
 * the context.
 */
export function DocsScreenshot({
  src,
  alt,
  caption,
  maxWidth,
}: {
  src: string;
  alt: string;
  caption?: string;
  /** Pixels; keeps a small capture, such as a dialog, at its own size. */
  maxWidth?: number;
}): React.JSX.Element {
  const [failed, setFailed] = useState(false);

  return (
    <figure className="mx-auto my-6" style={{ maxWidth }}>
      {failed ? (
        <div className="flex aspect-[16/9] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
          <ImageOff className="mr-2 h-4 w-4" />
          Screenshot pending
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="w-full rounded-lg border border-border"
        />
      )}
      {caption && (
        <figcaption className="mt-2 text-xs text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
