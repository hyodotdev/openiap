import {
  COMMERCE_IMPLEMENTATIONS,
  COMMERCE_IMPLEMENTATION_TOPICS,
  type CommerceImplementationTopic,
} from '../lib/commerceImplementations';

interface CommerceImplementationComparisonProps {
  topic: CommerceImplementationTopic;
  collapsed?: boolean;
}

export default function CommerceImplementationComparison({
  topic,
  collapsed = false,
}: CommerceImplementationComparisonProps): React.JSX.Element {
  const comparison = COMMERCE_IMPLEMENTATION_TOPICS[topic];
  const content = (
    <div className="commerce-implementation-pair" data-topic={topic}>
      <p className="commerce-implementation-pair-title">{comparison.title}</p>
      <div className="commerce-implementation-pair-grid">
        {(['example', 'kit'] as const).map((key) => {
          const project = COMMERCE_IMPLEMENTATIONS[key];
          const reference = comparison[key];
          const line = 'line' in reference ? `#L${reference.line}` : '';
          return (
            <div className="commerce-implementation-reference" key={key}>
              <span className="commerce-implementation-role">
                {project.role}
              </span>
              <p className="commerce-implementation-name">
                <a href={project.url} target="_blank" rel="noopener noreferrer">
                  {project.name}
                </a>
              </p>
              <p>{reference.description}</p>
              <a
                className="commerce-implementation-source"
                href={`${project.source}/${reference.file}.html${line}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${project.name}: read ${reference.symbol}`}
              >
                Read code: {reference.symbol}
              </a>
            </div>
          );
        })}
      </div>
      <details className="commerce-implementation-checks">
        <summary>How to check this behavior</summary>
        {(['example', 'kit'] as const).map((key) => (
          <p key={key}>
            <strong>{key === 'example' ? 'Example' : 'IAPKit'}.</strong>{' '}
            {comparison[key].check}{' '}
            <a
              href={`${COMMERCE_IMPLEMENTATIONS[key].source}/${comparison[key].checkFile}.html`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Inspect reference
            </a>
          </p>
        ))}
      </details>
    </div>
  );

  return collapsed ? (
    <details className="commerce-run-details">
      <summary>Compare the example and IAPKit</summary>
      {content}
    </details>
  ) : (
    content
  );
}
