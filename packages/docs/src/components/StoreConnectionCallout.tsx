import { Link } from 'react-router-dom';
import Callout from './Callout';

interface StoreConnectionCalloutProps {
  purchaseErrorEvent?: boolean;
}

function StoreConnectionCallout({
  purchaseErrorEvent = false,
}: StoreConnectionCalloutProps) {
  return (
    <Callout kind="important" title="Requires an open connection">
      <p>
        <strong>React Native / Expo:</strong> wait for the hook&apos;s{' '}
        <code>connected</code> flag, or call{' '}
        <Link to="/docs/apis/init-connection">
          <code>initConnection()</code>
        </Link>{' '}
        and require a <code>true</code> result. Android does not connect
        implicitly;{' '}
        {purchaseErrorEvent ? (
          <>
            a disconnected purchase reports <code>not-prepared</code> through
            the purchase-error event
          </>
        ) : (
          <>
            a disconnected call rejects with <code>not-prepared</code>
          </>
        )}
        . iOS can connect on demand, but the same gate keeps behavior consistent
        across platforms.
      </p>
    </Callout>
  );
}

export default StoreConnectionCallout;
