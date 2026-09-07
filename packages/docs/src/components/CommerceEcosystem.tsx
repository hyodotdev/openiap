import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChartNoAxesCombined,
  Check,
  Layers,
  PanelsTopLeft,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { COMMERCE_BUSINESSES, COMMERCE_ROLES } from '../lib/commerceEcosystem';

const ROLE_ICONS = {
  experience: PanelsTopLeft,
  commerce: ShieldCheck,
  data: ChartNoAxesCombined,
};

function CommerceEcosystem(): React.JSX.Element {
  const [business, setBusiness] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const roles: readonly string[] = COMMERCE_BUSINESSES[business].roles;
  const detail = COMMERCE_ROLES.find((role) => role.id === selected);
  const selectRole = (id: string): void => {
    setSelected(selected === id ? null : id);
    if (selected !== id) {
      requestAnimationFrame(() =>
        document
          .getElementById('ecosystem-role-detail')
          ?.scrollIntoView({ block: 'nearest' })
      );
    }
  };
  return (
    <section
      id="architecture"
      className="commerce-ecosystem"
      aria-labelledby="ecosystem-heading"
    >
      <div className="commerce-ecosystem-heading">
        <div>
          <span className="commerce-eyebrow">The big picture</span>
          <h2 id="ecosystem-heading">One ecosystem. Your part in it.</h2>
        </div>
        <p>Choose your business. Explore the roles you need.</p>
      </div>
      <div
        className="platform-tabs platform-tabs-header commerce-businesses"
        role="group"
        aria-label="Business composition"
      >
        {COMMERCE_BUSINESSES.map((entry, index) => (
          <button
            key={entry.name}
            className={`platform-tab ${index === business ? 'active' : ''}`}
            aria-pressed={index === business}
            onClick={() => setBusiness(index)}
          >
            {entry.name}
          </button>
        ))}
      </div>
      <div className="commerce-ecosystem-canvas">
        <div className="commerce-ecosystem-roles">
          {COMMERCE_ROLES.map((role, index) => {
            const Icon = ROLE_ICONS[role.id];
            const owned = roles.includes(role.id);
            return (
              <Fragment key={role.id}>
                {index > 0 && (
                  <div className="commerce-role-connection">
                    <ArrowRight size={20} aria-hidden="true" />
                    <span>
                      {index === 1 ? 'App + backend' : 'Signed events'}
                    </span>
                  </div>
                )}
                <button
                  className="btn commerce-ecosystem-role"
                  data-owned={owned}
                  aria-label={role.title}
                  aria-describedby={`commerce-${role.id}-ownership commerce-${role.id}-description`}
                  aria-expanded={selected === role.id}
                  aria-controls="ecosystem-role-detail"
                  onClick={() => selectRole(role.id)}
                >
                  <span className="commerce-role-topline">
                    <span className="commerce-role-icon">
                      <Icon size={22} aria-hidden="true" />
                    </span>
                    <span
                      id={`commerce-${role.id}-ownership`}
                      className="commerce-role-ownership"
                    >
                      {owned && <Check size={12} aria-hidden="true" />}
                      {owned ? 'You provide' : 'Connect a service'}
                    </span>
                  </span>
                  <strong>{role.title}</strong>
                  <span
                    id={`commerce-${role.id}-description`}
                    className="commerce-role-description"
                  >
                    {role.examples}
                  </span>
                  <span className="commerce-role-action">
                    {selected === role.id
                      ? 'Close details'
                      : 'Explore this role'}
                    <ArrowRight size={15} aria-hidden="true" />
                  </span>
                </button>
              </Fragment>
            );
          })}
        </div>
        <div className="commerce-app-boundary">
          <Smartphone size={20} aria-hidden="true" />
          <div>
            <strong>Your app connects the pieces</strong>
            <span>
              OpenIAP client SDK → store purchase → your authenticated backend
            </span>
          </div>
          <span className="commerce-boundary-label">
            <Layers size={14} aria-hidden="true" /> Shared contracts
          </span>
        </div>
      </div>
      <p className="commerce-ecosystem-note">
        Own one role or combine them. Your app keeps login and access control;
        partners can supply the rest.{' '}
        <Link to="/commerce-protocol/getting-started#purchase-flow">
          Follow one purchase through the system →
        </Link>
      </p>
      <div id="ecosystem-role-detail" aria-live="polite">
        {detail && (
          <div className="commerce-part-detail">
            <h3>
              {detail.title}: {detail.owns}
            </h3>
            <p>
              <strong>Receives:</strong> {detail.input}
            </p>
            <p>
              <strong>Provides:</strong> {detail.output}
            </p>
            <p>{detail.rule}</p>
            <div className="commerce-actions">
              <Link className="btn btn-primary" to={detail.start}>
                Start with this role
              </Link>
              <Link
                className="btn btn-secondary"
                to="/commerce-protocol/ecosystem"
              >
                Connection rules
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
export default CommerceEcosystem;
