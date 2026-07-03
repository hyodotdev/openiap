import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useSeoMeta } from "../hooks/useSeoMeta";

type PageWithTitleProps = {
  title?: string;
  description?: string;
  canonicalPath?: string;
  keywords?: string[];
  children: ReactNode;
};

export function PageWithTitle({
  title,
  description,
  canonicalPath,
  keywords,
  children,
}: PageWithTitleProps) {
  const { pathname } = useLocation();

  useSeoMeta({
    title,
    description,
    canonicalPath: canonicalPath ?? pathname,
    keywords,
  });

  return <>{children}</>;
}
