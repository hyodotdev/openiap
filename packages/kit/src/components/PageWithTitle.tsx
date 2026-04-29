import { ReactNode } from "react";
import { usePageTitle } from "../hooks/usePageTitle";

type PageWithTitleProps = {
  title?: string;
  children: ReactNode;
};

export function PageWithTitle({ title, children }: PageWithTitleProps) {
  usePageTitle(title);
  return <>{children}</>;
}
