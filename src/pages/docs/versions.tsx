import { useScrollToHash } from '../../hooks/useScrollToHash';

function Versions() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <h1>Versions</h1>
      <p>
        Current version: <strong>v1.0.0 (2025.08)</strong>
      </p>
    </div>
  );
}

export default Versions;
