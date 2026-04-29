import { useNavigate } from "react-router-dom";
import { Home, RefreshCw, AlertTriangle } from "lucide-react";
import { SUPPORT_EMAIL } from "@/utils/constants";

interface ErrorPageProps {
  error?: Error;
  resetError?: () => void;
}

export default function ErrorPage({ error, resetError }: ErrorPageProps) {
  const navigate = useNavigate();

  const handleRefresh = () => {
    if (resetError) {
      resetError();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 pb-20">
      <div className="max-w-lg w-full text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-destructive/10 rounded-full mb-4">
            <AlertTriangle className="w-12 h-12 text-destructive" />
          </div>
          <h1 className="text-9xl font-bold text-destructive opacity-20">
            500
          </h1>
        </div>

        <h2 className="text-3xl font-bold text-foreground mb-4">
          {"Something Went Wrong"}
        </h2>

        <p className="text-lg text-muted-foreground mb-4">
          {"An unexpected error occurred. We're working to fix the problem."}
        </p>

        {error && process.env.NODE_ENV === "development" && (
          <div className="mb-8 p-4 bg-muted rounded-lg text-left">
            <p className="text-sm font-mono text-muted-foreground break-all">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {"Refresh Page"}
          </button>

          <button
            onClick={() => void navigate("/")}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            {"Go Home"}
          </button>
        </div>

        <p className="text-sm text-muted-foreground mt-8">
          {`If the problem persists, please email us at ${SUPPORT_EMAIL}`}
        </p>
      </div>
    </div>
  );
}
