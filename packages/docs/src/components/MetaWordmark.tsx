import type { ReactElement } from 'react';

interface MetaWordmarkProps {
  className?: string;
}

function MetaWordmark({ className }: MetaWordmarkProps): ReactElement {
  const classes = ['meta-wordmark', className].filter(Boolean).join(' ');

  return (
    <span className={classes} role="img" aria-label="Meta">
      <img src="/meta.svg" alt="" aria-hidden="true" />
      <img src="/meta-txt.svg" alt="" aria-hidden="true" />
    </span>
  );
}

export default MetaWordmark;
