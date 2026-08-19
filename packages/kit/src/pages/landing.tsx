import { useState, useEffect } from "react";
import { openAuthModal } from "../lib/signals";
import {
  ArrowRight,
  Shield,
  Globe,
  Zap,
  CreditCard,
  CheckCircle2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Footer from "../components/Footer";

const ROTATING_TEXTS = [
  "fitness app 🏋️‍♀️",
  "mobile game 🕹️",
  "health tracker 🫀",
  "dating app 💖",
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsExiting(true);
      // Wait for exit animation to complete before changing text
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % ROTATING_TEXTS.length);
        setIsExiting(false);
      }, 500); // Match animation duration
    }, 3000); // Change every 3 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Hero Section */}
      <section className="hero-background pt-20 pb-20 lg:pt-32 lg:pb-32 performance-optimized">
        <div className="container max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#24292e]/10 dark:bg-[#24292e]/20 text-[#24292e] dark:text-gray-300 rounded-full text-sm font-medium mb-6 opacity-0 animate-fade-in-up">
              <Shield className="w-4 h-4" />
              <span>{"Protect your in-app purchases"}</span>
            </div>
            <h1
              className="text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold mb-8 text-foreground"
              style={{ lineHeight: "1.2" }}
            >
              <span className="block opacity-0 animate-fade-in-up animation-delay-100">
                <span className="block">{"OpenIAP foundation for your"}</span>
                <span className="block relative overflow-hidden h-[1.3em] min-w-[200px] md:min-w-[300px] lg:min-w-[400px]">
                  <span
                    key={currentIndex}
                    className={`inline-block ${
                      isExiting
                        ? "animate-slide-out-up"
                        : "animate-slide-in-from-bottom-opacity"
                    }`}
                  >
                    {ROTATING_TEXTS[currentIndex]}
                  </span>
                </span>
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-6 opacity-0 animate-fade-in-up animation-delay-300">
              IAPKit, managed by{" "}
              <a
                href="https://openiap.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground transition-colors"
              >
                OpenIAP
              </a>
              , provides open purchase validation and entitlement infrastructure
              across the App Store, Google Play, Amazon Appstore, and Meta
              Horizon.
            </p>
            <p className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-900 dark:text-amber-100 text-sm md:text-base font-medium opacity-0 animate-fade-in-up animation-delay-300">
              <span aria-hidden="true">✨</span>
              {
                "Hosted validation and analytics are free under fair-use limits."
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center opacity-0 animate-fade-in-up animation-delay-400">
              <button
                onClick={() => {
                  openAuthModal();
                }}
                className="btn-gradient text-lg px-8 py-4"
              >
                {"Get started"}
                <ArrowRight className="w-5 h-5 ml-2" />
              </button>
              <button
                onClick={() => {
                  void navigate("/docs");
                }}
                className="btn-secondary text-lg px-8 py-4"
              >
                {"Read the docs"}
              </button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground animate-fade-up animation-delay-400">
              {
                "No credit card. Shared, community-funded infrastructure with best-effort availability."
              }
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 lg:py-32">
        <div className="container max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-foreground">
              {"Purpose-built for reliable purchase infrastructure"}
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {"One API to confirm every supported store purchase."}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            <div className="card-hover p-8 overflow-hidden flex flex-col">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 flex-shrink-0">
                <Globe className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground break-words">
                {"Tamper-resistant hosted validation"}
              </h3>
              <p className="text-muted-foreground break-words">
                {
                  "We contact each supported store, verify authoritative purchase state, and return a single isValid answer before you deliver the item."
                }
              </p>
            </div>

            <div className="card-hover p-8 overflow-hidden flex flex-col">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground break-words">
                {"Fast integration"}
              </h3>
              <p className="text-muted-foreground break-words">
                {
                  "Add one IAPKit call and handle every supported store with the same payload. You'll be up and running in minutes."
                }
              </p>
            </div>

            <div className="card-hover p-8 overflow-hidden flex flex-col">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 flex-shrink-0">
                <CreditCard className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground break-words">
                {"Operational visibility"}
              </h3>
              <p className="text-muted-foreground break-words">
                {
                  "Search receipts, inspect payloads, review analytics, and re-run validations without digging through logs."
                }
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* API Example Section */}
      <section className="py-20 lg:py-32 bg-muted/30">
        <div className="container max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="min-w-0">
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">
                {"How IAPKit fits in"}
              </h2>
              <p className="text-xl text-muted-foreground mb-8">
                {
                  "Collect the purchase proof on-device, send it to IAPKit, and unlock the item once the source store confirms it."
                }
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>
                    {
                      "Collect the App Store, Play, Horizon, or Amazon purchase proof with your existing billing library."
                    }
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>
                    {
                      "Send the purchase proof and metadata to IAPKit for managed validation."
                    }
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>
                    {
                      "Unlock app content only when IAPKit returns a valid, store-verified response."
                    }
                  </span>
                </li>
              </ul>
            </div>
            <div className="relative min-w-0">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 blur-3xl" />
              <div className="relative space-y-4">
                <div className="bg-primary-950 dark:bg-[#1e1e26] rounded-xl p-6 text-primary-100 dark:text-primary-200 overflow-x-auto shadow-2xl w-full max-w-full">
                  <p className="text-xs uppercase tracking-wide text-primary-300 mb-3">
                    API request
                  </p>
                  <pre className="text-sm md:text-base w-full min-w-0">
                    <code className="block w-full min-w-0">{`curl -X POST https://kit.openiap.dev/v1/purchase/verify \\
-H "Authorization: Bearer openiap-kit_pk_<your-publishable-key>" \\
-H "Content-Type: application/json" \\
-d '{
  "store": "google",
  "purchaseToken": "<purchaseToken>"
}'`}</code>
                  </pre>
                </div>
                <div className="bg-primary-950 dark:bg-[#1e1e26] rounded-xl p-6 text-primary-100 dark:text-primary-200 overflow-x-auto shadow-2xl w-full max-w-full">
                  <p className="text-xs uppercase tracking-wide text-primary-300 mb-3">
                    API response
                  </p>
                  <pre className="text-sm md:text-base w-full min-w-0">
                    <code className="block w-full min-w-0">{`{
  "isValid": true,
  "state": "ENTITLED",
  "productId": "premium_monthly"
}`}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Shared capacity and sponsorship section */}
      <section id="pricing" className="py-20 lg:py-32">
        <div className="container max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-foreground">
              {"Free, shared, and sustained by the ecosystem"}
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-10">
              {
                "Hosted IAPKit is an open-source community service that every developer can share. It has fair-use rate limits, does not include an SLA, and is not unlimited infrastructure."
              }
            </p>

            <div className="grid gap-6 md:grid-cols-3 text-left mb-10">
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold mb-2">
                  {"Shared for the community"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {
                    "Use the hosted service without a billing meter, cache reads responsibly, and honor 429 or 503 retry guidance so capacity remains available to everyone."
                  }
                </p>
              </div>
              <div className="rounded-xl border border-amber-300/70 dark:border-amber-500/40 bg-amber-50/60 dark:bg-amber-500/10 p-6">
                <h3 className="text-lg font-semibold mb-2">
                  {"Planning significant traffic?"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {
                    "Contact us before launch. If your organization expects to consume a meaningful share of the hosted capacity, we ask it to help fund server expansion, monitoring, and security for the ecosystem."
                  }
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold mb-2">
                  {"Need dedicated capacity?"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {
                    "Self-host the MIT-licensed server for predictable capacity and operational control. Sponsorship supports the shared service; it does not automatically include dedicated resources or an SLA."
                  }
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-center justify-center">
              <a
                href="https://github.com/sponsors/hyodotdev"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center btn-gradient text-lg px-8 py-4"
              >
                {"Sponsor on GitHub"}
                <ArrowRight className="w-5 h-5 ml-2" />
              </a>
              <a
                href="https://opencollective.com/openiap"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center btn-secondary text-lg px-8 py-4"
              >
                {"Support on OpenCollective"}
              </a>
              <a
                href="https://github.com/hyodotdev/openiap/tree/main/packages/kit#deployment-convex--flyio"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
              >
                {"Self-host IAPKit"}
                <ArrowRight className="w-4 h-4 ml-1" />
              </a>
            </div>
            <p className="text-sm text-muted-foreground max-w-3xl mx-auto mt-6">
              {
                "For capacity planning or a separate written service agreement, contact "
              }
              <a
                href="mailto:hyo@hyo.dev"
                className="underline hover:text-foreground transition-colors"
              >
                hyo@hyo.dev
              </a>
              {" before your production launch."}
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32 hero-background">
        <div className="container max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 leading-tight">
            {"Ship trustworthy in-app purchases."}
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            {
              "Drop in one API call and let IAPKit keep fraudsters out of your app."
            }
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => {
                openAuthModal();
              }}
              className="btn-gradient text-lg px-8 py-4"
            >
              {"Create free account"}
              <ArrowRight className="w-5 h-5 ml-2" />
            </button>
            <button
              onClick={() => {
                void navigate("/docs");
              }}
              className="btn-ghost text-lg px-8 py-4"
              style={{ cursor: "pointer", pointerEvents: "auto" }}
            >
              {"Read the docs"}
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </>
  );
}
