export type BlogPost = {
  slug: string;
  title: string;
  date: string;
  readingTime: string;
  excerpt: string;
  description: string;
  keywords: string[];
  author: {
    name: string;
    url?: string;
  };
};

export const BLOG_AUTHOR = {
  name: "Hyo",
  url: "https://github.com/hyochan",
};

export const POSTS: BlogPost[] = [
  {
    slug: "iapkit-joins-openiap",
    title: "IAPKit joins OpenIAP. The API is now free for everyone.",
    date: "2026-04-22",
    readingTime: "4 min read",
    excerpt:
      "We're moving IAPKit under OpenIAP and dropping every paywall. Receipt validation is the ground floor of IAP — it shouldn't be a tier you pay for.",
    description:
      "IAPKit is joining OpenIAP and going completely free. No paywall, no plans, no usage limits on App Store, Google Play, and Meta Horizon receipt validation.",
    keywords: [
      "IAPKit",
      "OpenIAP",
      "receipt validation",
      "in-app purchases",
      "App Store",
      "Google Play",
      "Meta Horizon",
      "free IAP",
    ],
    author: BLOG_AUTHOR,
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return POSTS.find((post) => post.slug === slug);
}
