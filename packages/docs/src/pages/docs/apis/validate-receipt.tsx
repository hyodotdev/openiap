import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SEO from '../../../components/SEO';

function ValidateReceipt() {
  const navigate = useNavigate();

  // Cross-platform `validateReceipt` is deprecated in the schema in favour
  // of `verifyPurchase`. Bookmarks that hit /docs/apis/validate-receipt
  // bounce to the canonical Validation feature page, so old links keep
  // working without us maintaining a parallel reference.
  useEffect(() => {
    navigate('/docs/features/validation#verify-purchase', { replace: true });
  }, [navigate]);

  return (
    <div className="doc-page">
      <SEO
        title="validateReceipt (deprecated)"
        description="validateReceipt is deprecated — use verifyPurchase instead."
        path="/docs/apis/validate-receipt"
        keywords="validateReceipt, verifyPurchase, deprecated"
      />
      <h1>
        <code style={{ textDecoration: 'line-through' }}>validateReceipt</code>
      </h1>
      <div className="alert-card alert-card--warning">
        <p>
          ⚠️ <strong>Deprecated.</strong> The cross-platform{' '}
          <code>validateReceipt</code> mutation has been replaced by{' '}
          <Link to="/docs/features/validation#verify-purchase">
            <code>verifyPurchase</code>
          </Link>
          . Use that instead — it accepts the same{' '}
          <Link to="/docs/types/verify-purchase">
            <code>VerifyPurchaseProps</code>
          </Link>{' '}
          input and returns the same{' '}
          <Link to="/docs/types/verify-purchase-with-provider-result">
            <code>VerifyPurchaseWithProviderResult</code>
          </Link>
          .
        </p>
        <p>
          Redirecting to{' '}
          <Link to="/docs/features/validation#verify-purchase">
            /docs/features/validation
          </Link>
          …
        </p>
      </div>
    </div>
  );
}

export default ValidateReceipt;
