import { COMMERCE_PROTOCOL_INSTALL } from '../lib/config';
import { useEffect, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowRightLeft,
  Smartphone,
  Store,
  Server,
  Package,
} from 'lucide-react';
import {
  closeCommerceArchitectureModal,
  getCommerceArchitectureSnapshot,
  openCommerceArchitectureModal,
  subscribeToCommerceArchitecture,
  type CommerceArchitecturePart,
} from '../lib/signals';

const PARTS = {
  app: {
    label: 'Your app',
    title: 'The app starts the purchase',
    description:
      'Use a store SDK to buy a product and receive purchase evidence. Send that evidence to your authenticated backend; keep server credentials there.',
    reference: '/docs/getting-started',
    referenceLabel: 'Client SDK guide',
  },
  stores: {
    label: 'Stores',
    title: 'The store is the purchase authority',
    description:
      'Apple, Google, Meta, and Amazon issue their own purchase evidence. A provider verifies it with the appropriate store adapter and processes the lifecycle signals that store supports.',
    reference: '/commerce-protocol/capabilities',
    referenceLabel: 'Store capabilities',
  },
  verify: {
    label: 'Verify purchases',
    title: 'Is this purchase evidence valid?',
    description:
      'The provider checks store evidence and returns isValid. A successful verification does not attach a user or grant account access.',
    reference: '/commerce-protocol/operations#verifyPurchase',
    referenceLabel: 'Verification contract',
    step: 2,
  },
  bind: {
    label: 'Bind ownership',
    title: 'Which user owns the purchase?',
    description:
      'Your backend selects a user from its authenticated session and ownership policy. The provider binds the purchase to that user and refuses transfer to another user.',
    reference: '/commerce-protocol/operations#bindPurchase',
    referenceLabel: 'Binding contract',
    step: 3,
  },
  access: {
    label: 'Read access',
    title: 'What can this user access now?',
    description:
      'Entitlements combine the stored subscription state with the current time. Cancellation keeps the paid period open; access closes at its expiry deadline.',
    reference: '/commerce-protocol/operations#entitlements',
    referenceLabel: 'Entitlement contract',
    step: 6,
  },
  events: {
    label: 'Deliver events',
    title: 'Keep the backend informed',
    description:
      'Store lifecycle changes become signed server-to-server webhooks. The receiver persists and deduplicates events, then refreshes current access when needed.',
    reference: '/commerce-protocol/webhooks',
    referenceLabel: 'Webhook contract',
    step: 5,
  },
  backend: {
    label: 'Your backend',
    title: 'Your backend owns the access decision',
    description:
      'Authenticate the app user, authorize binding, and read entitlements through REST or GraphQL. Receive webhooks here; mobile apps do not consume a project-wide event stream.',
    reference: '/commerce-protocol/getting-started',
    referenceLabel: 'Connect a provider',
    step: 3,
  },
  contract: {
    label: 'Commerce Protocol',
    title: 'The contract your AI implements',
    description:
      'Install the specification, schemas, API bindings, and conformance tools in your own project. Your AI builds the runtime; the package itself does not start a server.',
    reference: '/commerce-protocol/implementation',
    referenceLabel: 'Build with AI',
    step: 1,
    packageName: COMMERCE_PROTOCOL_INSTALL,
  },
} satisfies Record<string, CommerceArchitecturePart>;

type PartId = keyof typeof PARTS;

interface CommerceProtocolDiagramProps {
  onShowExample: (step: number) => void;
}

function CommerceProtocolDiagram({
  onShowExample,
}: CommerceProtocolDiagramProps): React.JSX.Element {
  const { hash } = useLocation();
  const navigate = useNavigate();
  const modal = useSyncExternalStore(
    subscribeToCommerceArchitecture,
    getCommerceArchitectureSnapshot,
    () => null
  );

  useEffect(() => {
    const id = hash.slice('#architecture-'.length);
    if (
      hash.startsWith('#architecture-') &&
      Object.prototype.hasOwnProperty.call(PARTS, id)
    ) {
      const trigger = document.getElementById(`architecture-${id}`);
      trigger?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      trigger?.focus({ preventScroll: true });
      openCommerceArchitectureModal({
        part: PARTS[id as PartId],
        onShowExample,
        onClose: () =>
          navigate('#architecture', {
            replace: true,
            state: { commerceKeepScroll: true },
          }),
      });
    } else {
      closeCommerceArchitectureModal();
    }
    return closeCommerceArchitectureModal;
  }, [hash, navigate, onShowExample]);

  const node = (id: PartId, icon?: React.ReactNode): React.JSX.Element => (
    <button
      type="button"
      id={`architecture-${id}`}
      className={`btn ${modal?.part === PARTS[id] ? 'btn-primary' : 'btn-secondary'}`}
      aria-haspopup="dialog"
      aria-controls="commerce-architecture-detail"
      onClick={(event) => {
        event.currentTarget.focus({ preventScroll: true });
        navigate(`#architecture-${id}`);
      }}
    >
      {icon}
      {PARTS[id].label}
    </button>
  );
  return (
    <div id="architecture" className="commerce-architecture">
      <div className="commerce-architecture-heading">
        <h2 id="provider-architecture">Commerce backend architecture</h2>
        <span>Select a part to explore it.</span>
      </div>
      <div
        className="commerce-architecture-map"
        role="group"
        aria-label="Commerce architecture: app, stores, commerce provider, and authenticated developer backend"
      >
        <div className="commerce-architecture-end">
          {node('app', <Smartphone size={18} aria-hidden="true" />)}
          <small>Purchase UI</small>
        </div>
        <div className="commerce-connection">
          <ArrowRightLeft size={22} aria-hidden="true" />
          <small>Store SDK</small>
        </div>
        <div className="commerce-architecture-end">
          {node('stores', <Store size={18} aria-hidden="true" />)}
          <small>
            Apple · Google
            <br />
            Meta · Amazon
          </small>
        </div>
        <div className="commerce-connection">
          <ArrowRightLeft size={22} aria-hidden="true" />
          <small>
            Store APIs
            <br />
            Notifications
          </small>
        </div>
        <div className="commerce-provider">
          <strong>
            <Server size={17} aria-hidden="true" /> Commerce backend
          </strong>
          <small>IAPKit or your implementation</small>
          <div>
            {(['verify', 'bind', 'access', 'events'] as const).map((id) => (
              <div key={id}>{node(id)}</div>
            ))}
          </div>
        </div>
        <div className="commerce-connection">
          <ArrowRightLeft size={22} aria-hidden="true" />
          <small>REST / GraphQL</small>
          <ArrowRight size={20} aria-hidden="true" />
          <small>Signed webhooks</small>
        </div>
        <div className="commerce-architecture-end">
          {node('backend', <Server size={18} aria-hidden="true" />)}
          <small>Login + access control</small>
        </div>
      </div>
      <div className="commerce-app-connection">
        <Smartphone size={15} aria-hidden="true" />
        <span>
          App → your backend: authenticated session + purchase evidence
        </span>
        <ArrowRight size={16} aria-hidden="true" />
      </div>
      <div className="commerce-contract-node">
        {node('contract', <Package size={16} aria-hidden="true" />)}
        <small>
          Defines the interfaces and behavior between these systems.
        </small>
      </div>
    </div>
  );
}

export default CommerceProtocolDiagram;
