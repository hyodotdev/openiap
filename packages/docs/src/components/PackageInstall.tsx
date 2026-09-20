import { useState } from 'react';
import CodeBlock from './CodeBlock';

const MANAGERS = ['npm', 'pnpm', 'Yarn', 'Bun'] as const;

function PackageInstall({
  packageName,
}: {
  packageName?: string;
}): React.JSX.Element {
  const [manager, setManager] = useState<(typeof MANAGERS)[number]>('npm');
  const executable = manager.toLowerCase();
  const action = packageName && manager !== 'npm' ? 'add' : 'install';
  const command = `${executable} ${action}${packageName ? ` ${packageName}` : ''}`;

  return (
    <div className="language-tabs">
      <p>Use your favorite package manager.</p>
      <div
        className="language-tabs-header"
        role="group"
        aria-label="Package manager"
      >
        {MANAGERS.map((name) => (
          <button
            key={name}
            type="button"
            className={`language-tab ${manager === name ? 'active' : ''}`}
            aria-pressed={manager === name}
            onClick={() => setManager(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="language-tabs-content">
        <CodeBlock language="bash">{command}</CodeBlock>
      </div>
    </div>
  );
}

export default PackageInstall;
