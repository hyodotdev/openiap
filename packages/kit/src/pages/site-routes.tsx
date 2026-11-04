import type { ReactNode } from "react";
import { Children, cloneElement, isValidElement } from "react";
import { Navigate, Route } from "react-router-dom";

import { PageWithTitle } from "@/components/PageWithTitle";
import BlogLayout from "./blog/BlogLayout";
import BlogIndex from "./blog";
import IapkitJoinsOpenIap from "./blog/iapkit-joins-openiap";
import Terms from "./terms-of-service";
import Privacy from "./privacy-policy";
import About from "./about";
import Contact from "./contact";
import Faq from "./faq";
import Pricing from "./pricing";
import NotFound from "./404";

/**
 * Public site pages as a Fragment of `<Route>` children, mounted under
 * `<SiteLayout>` in both the public and signed-in route trees (like
 * `docsChildRoutes`), so they render the same signed in or out.
 */
export const siteChildRoutes = (
  <>
    <Route
      path="faq"
      element={
        <PageWithTitle
          title="Receipt validation FAQ"
          description="How receipt validation works, why it needs a trusted server, and what IAPKit verifies for each store."
          keywords={[
            "receipt validation FAQ",
            "consumable consumption state",
            "in-app purchase fraud",
          ]}
        >
          <Faq />
        </PageWithTitle>
      }
    />
    <Route
      path="pricing"
      element={
        <PageWithTitle
          title="Pricing"
          description="IAPKit is free and sustained by sponsors. See when larger organizations are asked to sponsor, and what never stops."
        >
          <Pricing />
        </PageWithTitle>
      }
    />
    <Route path="blog" element={<BlogLayout />}>
      <Route index element={<BlogIndex />} />
      <Route path="iapkit-joins-openiap" element={<IapkitJoinsOpenIap />} />
    </Route>
    <Route
      path="about"
      element={
        <PageWithTitle title="About">
          <About />
        </PageWithTitle>
      }
    />
    <Route
      path="contact"
      element={
        <PageWithTitle title="Contact">
          <Contact />
        </PageWithTitle>
      }
    />
    <Route
      path="terms-of-service"
      element={
        <PageWithTitle title="Terms of Service">
          <Terms />
        </PageWithTitle>
      }
    />
    <Route
      path="privacy-policy"
      element={
        <PageWithTitle title="Privacy Policy">
          <Privacy />
        </PageWithTitle>
      }
    />
    <Route
      path="termsofservice"
      element={<Navigate to="/terms-of-service" replace />}
    />
    <Route
      path="privacyandpolicy"
      element={<Navigate to="/privacy-policy" replace />}
    />
    <Route
      path="*"
      element={
        <PageWithTitle title="Page not found">
          <NotFound />
        </PageWithTitle>
      }
    />
  </>
);

type RouteProps = { path?: string; index?: boolean; children?: ReactNode };

/**
 * The site routes with each path a signed-in user's organization uses as its
 * slug handed to that organization, so an organization created before its
 * slug was reserved (convex/organizations/reservedSlugs.ts) keeps its
 * overview. Pages below such a path, like a blog post, keep working.
 */
export function siteRoutesExcept(orgSlugs: ReadonlySet<string>) {
  return Children.toArray(siteChildRoutes.props.children).flatMap((route) => {
    if (!isValidElement<RouteProps>(route)) return [route];
    const { path } = route.props;
    if (!path || !orgSlugs.has(path)) return [route];
    const nested = Children.toArray(route.props.children)
      .filter(isValidElement<RouteProps>)
      .filter((child) => !child.props.index && child.props.path)
      .map((child) =>
        cloneElement(child, { path: `${path}/${child.props.path}` }),
      );
    return nested.length > 0
      ? [cloneElement(route, { path: undefined }, nested)]
      : [];
  });
}
