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

const convexUrl = import.meta.env.VITE_KIT_CONVEX_URL;

if (typeof convexUrl !== "string" || convexUrl.length === 0) {
  throw new Error("VITE_KIT_CONVEX_URL is not defined");
}

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
