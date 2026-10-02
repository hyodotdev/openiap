import { useState } from 'react';
import {
  ArrowRight,
  ArrowDown,
  Boxes,
  Code,
  Package,
  Smartphone,
  Store,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import '../../../styles/store-providers.css';

const bindings = {
  android: {
    label: 'Android',
    core: 'openiap-core',
    discovery: 'Application manifest → factory',
    installation: 'Maven artifact + openiapStore + openiapProvider',
    vendor: 'Play, Amazon, Horizon, or a community SDK',
    selection: '#select',
  },
  apple: {
    label: 'Apple',
    core: 'OpenIAP',
    discovery: 'Info.plist → Objective-C factory',
    installation: 'Swift package, CocoaPod, or framework + factory key',
    vendor: 'StoreKit, Onside, or a community SDK',
    selection: '#apple-selection',
  },
} as const;

const purchaseSteps = [
  {
    title: 'Request',
    detail:
      'The app calls requestPurchase with a store product id. The provider opens the store checkout.',
  },
  {
    title: 'Receive',
    detail:
      'The provider maps the store callback to purchaseUpdated or purchaseError. Pending purchases grant no entitlement.',
  },
  {
    title: 'Verify and grant',
    detail:
      'The app sends the receipt to a backend that supports this store. That backend verifies it and grants the entitlement.',
  },
  {
    title: 'Finish',
    detail:
      'After successful delivery, the app calls finishTransaction. The provider acknowledges or consumes the store transaction.',
  },
] as const;

export default function StoreProviderDiagram() {
  const [platform, setPlatform] = useState<keyof typeof bindings>('android');
  const binding = bindings[platform];
  const nodes = [
    {
      title: 'Your app',
      detail: 'Purchase UI and entitlement delivery',
      icon: Smartphone,
    },
    {
      title: 'OpenIAP SDK',
      detail: 'The same purchase APIs in all six frameworks',
      icon: Code,
    },
    { title: binding.core, detail: binding.discovery, icon: Boxes },
    {
      title: 'Selected provider',
      detail: 'Store-specific mapping and lifecycle',
      icon: Package,
    },
    { title: 'Store SDK', detail: binding.vendor, icon: Store },
  ];
  return (
    <div className="store-provider-diagram">
      <div className="store-provider-diagram-heading">
        <h3>One contract, two native bindings</h3>
        <div
          className="store-provider-platforms"
          role="group"
          aria-label="Native platform binding"
        >
          {Object.entries(bindings).map(([key, value]) => (
            <button
              key={key}
              type="button"
              aria-pressed={platform === key}
              onClick={() => setPlatform(key as keyof typeof bindings)}
            >
              {value.label}
            </button>
          ))}
        </div>
      </div>
      <ol
        className="store-provider-pipeline"
        aria-label={`${binding.label} provider architecture`}
      >
        {nodes.map(({ title, detail, icon: Icon }, index) => (
          <li key={title}>
            <div className="store-provider-node">
              <Icon size={22} aria-hidden="true" />
              <strong>{title}</strong>
              <span>{detail}</span>
            </div>
            {index < nodes.length - 1 && (
              <span className="store-provider-arrow" aria-hidden="true">
                <ArrowRight className="store-provider-arrow-wide" size={18} />
                <ArrowDown className="store-provider-arrow-narrow" size={18} />
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className="store-provider-installation">
        <strong>{binding.label} setup:</strong> {binding.installation}.{' '}
        <a href={binding.selection}>Select a provider</a>.
      </p>
      <div className="store-provider-lifecycle">
        <h3>A purchase crosses two boundaries</h3>
        <ol>
          {purchaseSteps.map(({ title, detail }, index) => (
            <li key={title}>
              <span aria-hidden="true">{index + 1}</span>
              <div>
                <strong>{title}</strong>
                <p>{detail}</p>
              </div>
            </li>
          ))}
        </ol>
        <p>
          The store provider runs on the device. A{' '}
          <Link to="/commerce-protocol/overview">
            Commerce Protocol provider
          </Link>{' '}
          runs on your backend. Selecting a store provider does not add receipt
          verification support to a backend.
        </p>
      </div>
    </div>
  );
}
