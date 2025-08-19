import { useScrollToHash } from '../../hooks/useScrollToHash';

function Versions() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <h1>Versions</h1>
      <p>
        Current version: <strong>1.0.0</strong>
      </p>
    </div>
  );
}

export default Versions;
