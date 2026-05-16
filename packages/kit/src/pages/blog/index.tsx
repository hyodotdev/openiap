import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useSeoMeta, SITE_ORIGIN } from "@/hooks/useSeoMeta";
import { POSTS } from "./posts";

const BLOG_DESCRIPTION =
  "Announcements, roadmap, and engineering notes from IAPKit — the OpenIAP receipt-validation service for App Store, Google Play, and Meta Horizon.";

export default function BlogIndex() {
  const jsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "Blog",
      "@id": `${SITE_ORIGIN}/blog`,
      name: "IAPKit Blog",
      url: `${SITE_ORIGIN}/blog`,
      description: BLOG_DESCRIPTION,
      publisher: {
        "@type": "Organization",
        name: "OpenIAP",
        url: "https://openiap.dev",
      },
      blogPost: POSTS.map((post) => ({
        "@type": "BlogPosting",
        headline: post.title,
        url: `${SITE_ORIGIN}/blog/${post.slug}`,
        datePublished: post.date,
        dateModified: post.date,
        description: post.description,
        author: {
          "@type": "Person",
          name: post.author.name,
          url: post.author.url,
        },
      })),
    }),
    [],
  );

  useSeoMeta({
    title: "IAPKit Blog",
    description: BLOG_DESCRIPTION,
    canonicalPath: "/blog",
    ogType: "website",
    keywords: [
      "IAPKit blog",
      "OpenIAP",
      "receipt validation",
      "in-app purchases",
      "IAP news",
    ],
    jsonLd,
    jsonLdId: "blog-collection",
  });

  return (
    <div>
      <header className="mb-12 pb-10 border-b border-border">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          IAPKit Blog
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Announcements, roadmap, and engineering notes from the team behind
          IAPKit.
        </p>
      </header>

      <ul className="space-y-10">
        {POSTS.map((post) => (
          <li key={post.slug}>
            <Link to={`/blog/${post.slug}`} className="group block">
              <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground mb-3">
                <time dateTime={post.date}>{post.date}</time>
                <span className="text-border">·</span>
                <span>{post.readingTime}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight group-hover:text-primary transition-colors">
                {post.title}
              </h2>
              <p className="mt-3 text-base text-muted-foreground leading-relaxed">
                {post.excerpt}
              </p>
              <span className="mt-4 inline-block text-sm font-medium text-primary">
                Read →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
