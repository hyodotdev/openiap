import { useEffect } from "react";

export const SITE_NAME = "IAPKit";

export const formatPageTitle = (title?: string) => {
  const normalized = title?.trim();
  return normalized ? `${normalized} | ${SITE_NAME}` : SITE_NAME;
};

export function usePageTitle(title?: string) {
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    document.title = formatPageTitle(title);
  }, [title]);
}
