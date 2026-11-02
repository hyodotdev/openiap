import { Outlet } from "react-router-dom";

import { SiteHeader } from "./SiteHeader";

/** Header plus a scrolling page body for the landing page, blog and legal pages. */
export function SiteLayout() {
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      <SiteHeader />
      <main className="w-full flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
