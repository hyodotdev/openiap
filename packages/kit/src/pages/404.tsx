import { useNavigate } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 pb-20">
      <div className="max-w-lg w-full text-center">
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-primary opacity-20">404</h1>
        </div>

        <h2 className="text-3xl font-bold text-foreground mb-4">
          {"Page Not Found"}
        </h2>

        <p className="text-lg text-muted-foreground mb-8">
          {
            "Sorry, the page you're looking for doesn't exist or has been moved."
          }
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={() => void navigate(-1)}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {"Go Back"}
          </button>

          <button
            onClick={() => void navigate("/")}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            {"Go Home"}
          </button>
        </div>
      </div>
    </div>
  );
}
