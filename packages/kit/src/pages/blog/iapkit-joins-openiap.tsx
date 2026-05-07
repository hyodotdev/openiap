import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useSeoMeta, SITE_ORIGIN, DEFAULT_OG_IMAGE } from "@/hooks/useSeoMeta";
import { getPostBySlug } from "./posts";

const SLUG = "iapkit-joins-openiap";

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Is IAPKit really free?",
    a: "Yes. Every receipt-validation API is free for all developers. No credit card, no paywall, no monthly plan, no usage limits. Indie projects and large commercial apps have the same access — everyone pays the same: nothing.",
  },
  {
    q: "Why is IAPKit joining OpenIAP?",
    a: "Receipt validation is the ground floor of in-app purchases — not a premium feature. Keeping it behind a paywall was out of step with what OpenIAP stands for. Moving IAPKit under OpenIAP and making the API free removes one more wall from an already fragmented IAP ecosystem.",
  },
  {
    q: "What happens to existing paying customers?",
    a: "Existing paying customers have been migrated automatically. Subscriptions are cancelled, and any unused portion is refunded in full.",
  },
  {
    q: "How can I support IAPKit and OpenIAP?",
    a: "Sponsor OpenIAP at any tier ($25 / $100 / $300 / $500 / $1,000) via PayPal or GitHub Sponsors at openiap.dev/sponsors. Sponsors are permanently listed on the sponsors page.",
  },
  {
    q: "Has the domain changed?",
    a: "Yes. IAPKit now lives at kit.openiap.dev. The old iapkit.com domain will expire at the end of 2026 — update any bookmarks and production API endpoints to the new domain.",
  },
  {
    q: "Which platforms does IAPKit support?",
    a: "IAPKit validates receipts for Apple App Store, Google Play, and Meta Horizon. Amazon Vega OS and FireOS support is on the roadmap.",
  },
];

export default function IapkitJoinsOpenIap() {
  const post = getPostBySlug(SLUG);

  const jsonLd = useMemo(() => {
    if (!post) return null;
    const url = `${SITE_ORIGIN}/blog/${post.slug}`;
    return [
      {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "@id": url,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        headline: post.title,
        description: post.description,
        url,
        datePublished: post.date,
        dateModified: post.date,
        inLanguage: "en",
        image: [DEFAULT_OG_IMAGE],
        keywords: post.keywords.join(", "),
        author: {
          "@type": "Person",
          name: post.author.name,
          url: post.author.url,
        },
        publisher: {
          "@type": "Organization",
          name: "OpenIAP",
          url: "https://www.openiap.dev",
          logo: {
            "@type": "ImageObject",
            url: `${SITE_ORIGIN}/logo.webp`,
          },
        },
        isPartOf: {
          "@type": "Blog",
          "@id": `${SITE_ORIGIN}/blog`,
          name: "IAPKit Blog",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: FAQ.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: {
            "@type": "Answer",
            text: a,
          },
        })),
      },
    ];
  }, [post]);

  useSeoMeta({
    title: post?.title ?? "IAPKit joins OpenIAP",
    description:
      post?.description ??
      "IAPKit is joining OpenIAP and going completely free. No paywall, no plans, no usage limits.",
    canonicalPath: `/blog/${SLUG}`,
    ogType: "article",
    keywords: post?.keywords,
    jsonLd,
    jsonLdId: "blog-post",
  });

  return (
    <article>
      <header className="mb-12">
        <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground mb-5">
          <time dateTime={post?.date}>{post?.date}</time>
          <span className="text-border">·</span>
          <span>{post?.readingTime}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
          IAPKit joins OpenIAP. The API is now free for everyone.
        </h1>
        <div className="mt-8 flex items-center gap-3 pt-6 border-t border-border">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-600 to-accent flex items-center justify-center text-white font-semibold">
            H
          </div>
          <div>
            <p className="text-sm font-medium">Hyo</p>
            <p className="text-xs text-muted-foreground">OpenIAP Maintainer</p>
          </div>
        </div>
      </header>

      <div className="blog-content">
        <p>
          When we started building IAPKit, we kept seeing the same wall stop
          developers everywhere. Apple, Google, and more recently Meta Horizon —
          each platform makes in-app purchase validation harder than it needs to
          be, and each in its own way. Different APIs, different edge cases,
          different ways to fail. Every IAP developer reinventing the same
          wheel. And with new platforms like Amazon Vega OS and FireOS joining
          the ecosystem, the fragmentation is only getting worse.
        </p>

        <p>
          IAPKit was built to solve this problem once, so nobody has to solve it
          again.
        </p>

        <p>Today, we're taking the next step.</p>

        <h2>IAPKit is now part of OpenIAP</h2>

        <p>
          IAPKit is now officially an <strong>OpenIAP</strong> project — a
          community-driven initiative to make in-app purchase infrastructure
          accessible, open, and reliable for every developer who builds apps.
        </p>

        <p>
          As part of this transition, <strong>the domain has also moved</strong>
          . IAPKit now lives at{" "}
          <a
            href="https://kit.openiap.dev"
            target="_blank"
            rel="noopener noreferrer"
          >
            kit.openiap.dev
          </a>
          , and the old <code>iapkit.com</code> domain will expire at the end of
          2026. Please update any bookmarks and production API endpoints to the
          new domain.
        </p>

        <p>
          And with this transition, the IAPKit API is becoming{" "}
          <strong>completely free</strong>.
        </p>

        <h2>Why we're doing this</h2>

        <p>
          Receipt validation is not a feature. It's the ground floor. Every app
          with a purchase button needs it.
        </p>

        <p>
          Keeping it behind a paywall made sense as an early-stage business
          decision — but over time, it became increasingly out of step with what
          OpenIAP stands for. Charging for the most foundational building block
          of IAP was adding one more wall to the very fragmentation we set out
          to fix.
        </p>

        <p>So we changed the model:</p>

        <ul>
          <li>
            Free for every developer — from side projects to production apps.
          </li>
          <li>
            Sustained by community Sponsorship — any amount, fully voluntary.
          </li>
          <li>Transparent and community-driven — open where it matters.</li>
        </ul>

        <p>
          The best developer tools have always worked this way. Redis,
          PostgreSQL, Sentry, Prometheus — all free to use, all supported by
          organizations that depend on them. IAPKit follows that path now.
        </p>

        <h2>What's changing</h2>

        <ul>
          <li>
            <strong>All validation APIs are free.</strong> No credit card, no
            paywall, no monthly plan, no usage limits.
          </li>
          <li>
            <strong>
              Same access for indie projects and large commercial apps
            </strong>{" "}
            — everyone pays the same: nothing.
          </li>
          <li>
            <strong>
              Existing paying customers have been migrated automatically.
            </strong>{" "}
            Subscriptions are cancelled, and any unused portion is refunded in
            full.
          </li>
          <li>
            <strong>OpenIAP Sponsorship.</strong> Support OpenIAP at any tier
            ($25 / $100 / $300 / $500 / $1,000) via PayPal or GitHub Sponsors at{" "}
            <a
              href="https://www.openiap.dev/sponsors"
              target="_blank"
              rel="noopener noreferrer"
            >
              openiap.dev/sponsors
            </a>
            . Sponsors are permanently listed on the sponsors page.
          </li>
        </ul>

        <h2>What's next</h2>

        <p>This transition frees us to invest in what actually matters:</p>

        <ul>
          <li>
            Deeper platform integrations — App Store Server API v2, Google Play
            Billing v7+, Meta Horizon.
          </li>
          <li>
            <strong>New platform support coming</strong> — Amazon Vega OS,
            FireOS.
          </li>
          <li>
            Server-side webhooks and real-time notifications — renewals,
            refunds, purchase events.
          </li>
          <li>
            Observability into purchase flows — see exactly where payments
            break.
          </li>
          <li>
            Self-hosted enterprise option, for companies with strict data
            residency needs.
          </li>
        </ul>

        <h2>Frequently asked questions</h2>

        <dl className="blog-faq">
          {FAQ.map(({ q, a }) => (
            <div key={q}>
              <dt>
                <strong>{q}</strong>
              </dt>
              <dd>{a}</dd>
            </div>
          ))}
        </dl>

        <h2>Today</h2>

        <p>
          Building something with IAPKit?{" "}
          <a
            href="https://kit.openiap.dev"
            target="_blank"
            rel="noopener noreferrer"
          >
            Start now
          </a>
          . No card, no limits to worry about.
        </p>

        <p>
          Running IAPKit in production and depending on it? Please consider
          sponsoring OpenIAP at{" "}
          <a
            href="https://www.openiap.dev/sponsors"
            target="_blank"
            rel="noopener noreferrer"
          >
            openiap.dev/sponsors
          </a>
          . Any tier from $25 to $1,000 keeps IAPKit free for thousands of indie
          developers.
        </p>
      </div>

      <footer className="mt-16 pt-8 border-t border-border">
        <Link
          to="/blog"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← All posts
        </Link>
      </footer>
    </article>
  );
}
