import { Outlet } from "react-router-dom";

export default function BlogLayout() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-12 pb-32">
      <Outlet />
    </div>
  );
}
