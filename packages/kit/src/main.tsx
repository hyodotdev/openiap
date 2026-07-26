// Must be first — `./lib/sentry` calls `Sentry.init` at module load
// so subsequent imports are already instrumented.
import "./lib/sentry";

import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { resolveBrowserConvexUrl } from "./lib/convex-url";

const convexUrl = resolveBrowserConvexUrl(import.meta.env);
const convex = new ConvexReactClient(convexUrl);

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <ConvexAuthProvider client={convex}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </ConvexAuthProvider>
  </BrowserRouter>,
);
