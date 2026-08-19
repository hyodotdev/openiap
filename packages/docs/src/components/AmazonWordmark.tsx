import type { ReactElement } from 'react';

interface AmazonWordmarkProps {
  className?: string;
}

function AmazonWordmark({ className }: AmazonWordmarkProps): ReactElement {
  const classes = ['amazon-wordmark', className].filter(Boolean).join(' ');

  return (
    <span className={classes} role="img" aria-label="Amazon">
      <img
        className="amazon-wordmark-light"
        src="/sponsors/amazon.webp"
        alt=""
        aria-hidden="true"
      />
      <img
        className="amazon-wordmark-dark"
        src="/sponsors/amazon-dark.webp"
        alt=""
        aria-hidden="true"
      />
    </span>
  );
}

export default AmazonWordmark;
