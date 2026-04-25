import { Navigate } from 'react-router-dom';

// Cross-platform `validateReceipt` is deprecated in the schema in favour
// of `verifyPurchase`. Bookmarks that hit /docs/apis/validate-receipt
// bounce to the canonical Validation feature page, so old links keep
// working without us maintaining a parallel reference. Use
// <Navigate replace /> so the redirect happens declaratively during
// render — no flash of intermediate content, no extra effect-driven
// re-render.
function ValidateReceipt() {
  return <Navigate to="/docs/features/validation#verify-purchase" replace />;
}

export default ValidateReceipt;
