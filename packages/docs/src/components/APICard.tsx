import { Link } from 'react-router-dom';

interface APICardProps {
  title: string;
  description: string;
  href: string;
  count?: number;
}

function APICard({ title, description, href, count }: APICardProps) {
  return (
    <div className="api-card-wrapper">
      <Link to={href} className="api-card">
        <h3 className="api-card-title">
          {title}
          {count !== undefined && (
            <span className="api-card-count">{count}</span>
          )}
        </h3>
        <p className="api-card-description">{description}</p>
      </Link>
    </div>
  );
}

export default APICard;
