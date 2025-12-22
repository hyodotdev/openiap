import { IAPKIT_URL, trackIapKitClick } from '../lib/config';

function IapKitBanner() {
  return (
    <a
      href={IAPKIT_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={trackIapKitClick}
    >
      <img
        src="/iapkit-banner.gif"
        alt="IAPKit Banner"
        style={{
          width: '100%',
          borderRadius: '8px',
          marginBottom: '1rem',
        }}
      />
    </a>
  );
}

export default IapKitBanner;
