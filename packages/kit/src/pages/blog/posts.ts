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
    title: "IAPKit joins OpenIAP. Validation is now free.",
    date: "2026-04-22",
    readingTime: "4 min read",
    excerpt:
      "We're moving IAPKit under OpenIAP and making receipt validation and analytics free. Receipt validation is the ground floor of IAP — it shouldn't be a tier you pay for.",
    description:
      "IAPKit is joining OpenIAP. App Store, Google Play, Meta Horizon, and Amazon Appstore receipt validation and analytics are free, while future AI-assisted workflows may use separate usage-based pricing.",
    keywords: [
      "IAPKit",
      "OpenIAP",
      "receipt validation",
      "in-app purchases",
      "App Store",
      "Google Play",
      "Meta Horizon",
      "Amazon Appstore",
      "Fire OS",
      "free IAP",
    ],
    author: BLOG_AUTHOR,
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return POSTS.find((post) => post.slug === slug);
}
