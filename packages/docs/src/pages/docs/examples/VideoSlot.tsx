import { useState } from 'react';

export interface VideoVariant {
  id: string;
  label: string;
  title: string;
  description: string;
  src?: string;
  poster?: string;
}

interface VideoSlotProps {
  title: string;
  description: string;
  src?: string;
  poster?: string;
  variants?: VideoVariant[];
}

function VideoSlot({
  title,
  description,
  src,
  poster,
  variants,
}: VideoSlotProps) {
  const [activeVariantId, setActiveVariantId] = useState(
    variants?.[0]?.id ?? ''
  );
  const activeVariant =
    variants?.find((variant) => variant.id === activeVariantId) ??
    variants?.[0];
  const activeTitle = activeVariant?.title ?? title;
  const activeDescription = activeVariant?.description ?? description;
  const activeSrc = activeVariant?.src ?? src;
  const activePoster = activeVariant?.poster ?? poster;

  return (
    <div className="example-video-card">
      {variants?.length ? (
        <div className="example-video-tabs" role="tablist" aria-label={title}>
          {variants.map((variant) => (
            <button
              key={variant.id}
              type="button"
              role="tab"
              aria-selected={activeVariant?.id === variant.id}
              className={`example-video-tab ${
                activeVariant?.id === variant.id ? 'active' : ''
              }`}
              onClick={() => setActiveVariantId(variant.id)}
            >
              {variant.label}
            </button>
          ))}
        </div>
      ) : null}
      {activeSrc ? (
        <video
          key={activeSrc}
          controls
          preload="metadata"
          playsInline
          poster={activePoster}
        >
          <source src={activeSrc} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      ) : (
        <div className="example-video-placeholder">
          <span>Video placeholder</span>
        </div>
      )}
      <div className="example-video-content">
        <h4>{activeTitle}</h4>
        <p>{activeDescription}</p>
      </div>
    </div>
  );
}

export default VideoSlot;
