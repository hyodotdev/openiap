import { SiGithub } from "@icons-pack/react-simple-icons";
import { Link, useNavigate } from "react-router-dom";
import { KIT_REPO_URL } from "@/lib/constants";
import { useShowsLandingFeatures } from "@/hooks/useShowsLandingFeatures";

export default function Footer() {
  const navigate = useNavigate();
  const showsFeatures = useShowsLandingFeatures();

  const handleFeaturesClick = () => {
    if (typeof document !== "undefined") {
      const featuresSection = document.getElementById("features");
      if (featuresSection) {
        featuresSection.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    void navigate("/#features");
  };

  return (
    <footer className="bg-muted/50 py-12 border-t">
      <div className="container max-w-7xl mx-auto">
        <div className="grid md:grid-cols-5 gap-8">
          <div className="md:col-span-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 mb-4 hover:opacity-80 transition-opacity"
            >
              <img src="/logo.webp" alt="" className="h-8 w-8 logo-image" />
              <span className="font-bold text-xl">IAPKit</span>
            </Link>
            <p className="text-sm text-muted-foreground mb-4">
              Open-source purchase validation and entitlement infrastructure for
              the OpenIAP ecosystem.
            </p>
            <p className="text-xs text-muted-foreground">
              By{" "}
              <a
                href="https://hyo.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                Hyo Dev
              </a>
              ,{" "}
              <a
                href="https://openiap.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                OpenIAP
              </a>{" "}
              founding company.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">{"Product"}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {showsFeatures && (
                <li>
                  <button
                    type="button"
                    onClick={handleFeaturesClick}
                    className="hover:text-foreground transition-colors"
                  >
                    {"Features"}
                  </button>
                </li>
              )}
              <li>
                <Link
                  to="/docs"
                  className="hover:text-foreground transition-colors"
                >
                  {"Documentation"}
                </Link>
              </li>
              <li>
                <Link
                  to="/pricing"
                  className="hover:text-foreground transition-colors"
                >
                  {"Pricing"}
                </Link>
              </li>
              <li>
                <Link
                  to="/blog"
                  className="hover:text-foreground transition-colors"
                >
                  {"Blog"}
                </Link>
              </li>
              <li>
                <Link
                  to="/faq"
                  className="hover:text-foreground transition-colors"
                >
                  {"FAQ"}
                </Link>
              </li>
              <li>
                <a
                  href="https://openiap.dev/sponsors"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  {"Sponsors"}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">{"Company"}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  to="/about"
                  className="hover:text-foreground transition-colors"
                >
                  {"About"}
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="hover:text-foreground transition-colors"
                >
                  {"Contact"}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">{"Legal"}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  to="/terms-of-service"
                  className="hover:text-foreground transition-colors"
                >
                  {"Terms of Service"}
                </Link>
              </li>
              <li>
                <Link
                  to="/privacy-policy"
                  className="hover:text-foreground transition-colors"
                >
                  {"Privacy Policy"}
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-sm text-muted-foreground">
          <p>
            © {new Date().getFullYear()}{" "}
            <a
              href="https://hyo.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Hyo Dev
            </a>
            . All rights reserved.
          </p>
          <a
            href={KIT_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 hover:text-foreground transition-colors"
            aria-label="View kit source on GitHub"
          >
            <SiGithub className="w-4 h-4" aria-hidden="true" />
            <span>Source on GitHub</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
