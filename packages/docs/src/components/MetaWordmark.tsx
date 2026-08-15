import type { ReactElement } from 'react';

function MetaWordmark(): ReactElement {
  return (
    <span className="meta-wordmark" role="img" aria-label="Meta">
      <img src="/meta.svg" alt="" aria-hidden="true" />
      <img src="/meta-txt.svg" alt="" aria-hidden="true" />
    </span>
  );
}

export default MetaWordmark;
