import { Link } from "react-router-dom";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full text-center">
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-primary opacity-20">404</h1>
        </div>

        <h2 className="text-3xl font-bold text-foreground mb-4">
          {"Page not found"}
        </h2>

        <p className="text-lg text-muted-foreground mb-8">
          {"This page doesn't exist or has moved."}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link to="/" className="btn-gradient btn-lg">
            <Home className="w-4 h-4" aria-hidden="true" />
            {"Go to IAPKit home"}
          </Link>
          <Link to="/docs" className="btn-secondary btn-lg">
            {"Read the docs"}
          </Link>
        </div>
      </div>
    </div>
  );
}
