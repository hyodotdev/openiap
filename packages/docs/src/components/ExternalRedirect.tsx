import { useEffect } from 'react';

interface ExternalRedirectProps {
  to: string;
  hashTargets?: Readonly<Record<string, string>>;
}

function ExternalRedirect({ to, hashTargets }: ExternalRedirectProps) {
  const target = hashTargets?.[window.location.hash] ?? to;

  useEffect(() => {
    window.location.replace(target);
  }, [target]);

  return (
    <div className="doc-page">
      <h1>Documentation moved</h1>
      <p>
        Continue to the{' '}
        <a href={target} rel="noreferrer">
          canonical IAPKit documentation
        </a>
        .
      </p>
    </div>
  );
}

export default ExternalRedirect;
