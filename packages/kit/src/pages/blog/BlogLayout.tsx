import { Link, Outlet } from "react-router-dom";

export default function BlogLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar — persistent home + blog anchor. Medium-style: a thin
          border underneath, brand on the left, simple nav on the right. */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <img
              src="/logo.png"
              alt=""
              className="h-6 w-6 rounded"
              aria-hidden="true"
            />
            <span className="font-bold text-base">IAPKit</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link
              to="/blog"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              All posts
            </Link>
            <Link
              to="/docs"
              className="flex items-center gap-2 rounded-md border border-border bg-card/50 px-3 py-1.5 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
            >
              <span className="font-medium">Docs</span>
              <span className="text-xs">→</span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-12 pb-32">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
