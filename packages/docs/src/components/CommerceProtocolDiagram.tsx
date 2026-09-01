import '../styles/commerce-protocol.css';

const STORES = ['Apple', 'Google', 'Meta', 'Amazon'];
const OUTPUTS = ['Event', 'Entitlement', 'Webhook'];

function CommerceProtocolDiagram() {
  return (
    <figure
      className="commerce-signal"
      aria-label="A provider — IAPKit, a vendor, or your own backend — verifies, normalizes, and signs store data, and emits it as the Commerce Protocol's portable events, entitlements, and webhooks."
    >
      <svg
        className="commerce-signal-lines"
        viewBox="0 0 600 440"
        role="presentation"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="commerce-signal-in" x1="0" y1="0" x2="1" y2="0">
            <stop
              offset="0"
              stopColor="var(--commerce-coral)"
              stopOpacity="0.18"
            />
            <stop
              offset="1"
              stopColor="var(--commerce-gold)"
              stopOpacity="0.9"
            />
          </linearGradient>
          <linearGradient
            id="commerce-signal-out"
            gradientUnits="userSpaceOnUse"
            x1="332"
            y1="220"
            x2="468"
            y2="220"
          >
            <stop
              offset="0"
              stopColor="var(--commerce-gold)"
              stopOpacity="0.9"
            />
            <stop
              offset="1"
              stopColor="var(--commerce-violet)"
              stopOpacity="0.25"
            />
          </linearGradient>
          <filter
            id="commerce-signal-glow"
            x="-80%"
            y="-80%"
            width="260%"
            height="260%"
          >
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className="commerce-signal-paths commerce-signal-paths--in">
          <path d="M132 54 C218 54 205 220 268 220" />
          <path d="M132 164 C220 164 208 220 268 220" />
          <path d="M132 276 C220 276 208 220 268 220" />
          <path d="M132 386 C218 386 205 220 268 220" />
        </g>
        <g className="commerce-signal-paths commerce-signal-paths--out">
          <path d="M332 220 C400 220 390 92 468 92" />
          <path d="M332 220 L468 220" />
          <path d="M332 220 C400 220 390 348 468 348" />
        </g>

        <circle className="commerce-signal-pulse" cx="300" cy="220" r="6" />
        <circle
          className="commerce-signal-pulse commerce-signal-pulse--echo"
          cx="300"
          cy="220"
          r="6"
        />
      </svg>

      <div className="commerce-signal-list commerce-signal-list--stores">
        {STORES.map((store) => (
          <span key={store}>{store}</span>
        ))}
      </div>

      <div className="commerce-signal-core">
        <span>IAPKit · vendor · your backend</span>
        <strong>Provider</strong>
        <small>verify · normalize · sign</small>
      </div>

      <div className="commerce-signal-list commerce-signal-list--outputs">
        {OUTPUTS.map((output) => (
          <span key={output}>{output}</span>
        ))}
      </div>

      <figcaption>
        <span>Store-specific</span>
        <span>OpenIAP Commerce Protocol</span>
      </figcaption>
    </figure>
  );
}

export default CommerceProtocolDiagram;
