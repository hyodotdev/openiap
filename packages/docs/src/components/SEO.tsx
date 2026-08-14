import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  path?: string;
  keywords?: string;
  type?: 'website' | 'article';
  image?: string;
  includeAppSchema?: boolean;
}

const BASE_URL = 'https://openiap.dev';
const DEFAULT_TITLE = 'OpenIAP - Unified Specification for In-App Purchases';
const DEFAULT_DESCRIPTION =
  'OpenIAP is a unified specification for in-app purchases across platforms, frameworks, and emerging technologies. Standardizing IAP implementations to reduce fragmentation.';
const DEFAULT_IMAGE = '/og-image.webp';

function SEO({
  title,
  description,
  path = '',
  keywords,
  type = 'website',
  image,
  includeAppSchema = false,
}: SEOProps) {
  const pageTitle = title ? `${title} | OpenIAP` : DEFAULT_TITLE;
  const pageDescription = description || DEFAULT_DESCRIPTION;
  const canonicalUrl = `${BASE_URL}${path}`;
  const imageUrl = `${BASE_URL}${image || DEFAULT_IMAGE}`;

  useEffect(() => {
    const upsertMeta = (
      attribute: 'name' | 'property',
      key: string,
      content: string
    ): void => {
      const alternateAttribute = attribute === 'name' ? 'property' : 'name';
      let element = document.head.querySelector<HTMLMetaElement>(
        `meta[${attribute}="${key}"], meta[${alternateAttribute}="${key}"]`
      );

      if (!element) {
        element = document.createElement('meta');
        document.head.appendChild(element);
      }

      element.removeAttribute(alternateAttribute);
      element.setAttribute(attribute, key);
      element.content = content;
      element.dataset.openiapSeo = 'true';
    };

    const upsertCanonical = (): void => {
      let element = document.head.querySelector<HTMLLinkElement>(
        'link[rel="canonical"]'
      );

      if (!element) {
        element = document.createElement('link');
        element.rel = 'canonical';
        document.head.appendChild(element);
      }

      element.href = canonicalUrl;
      element.dataset.openiapSeo = 'true';
    };

    upsertMeta('name', 'title', pageTitle);
    upsertMeta('name', 'description', pageDescription);
    if (keywords) {
      upsertMeta('name', 'keywords', keywords);
    } else {
      const staleKeywords = document.head.querySelector<HTMLMetaElement>(
        'meta[name="keywords"], meta[property="keywords"]'
      );

      if (staleKeywords?.dataset.openiapSeo === 'true') {
        staleKeywords.remove();
      }
    }
    upsertMeta('property', 'og:type', type);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:title', pageTitle);
    upsertMeta('property', 'og:description', pageDescription);
    upsertMeta('property', 'og:image', imageUrl);
    upsertMeta('property', 'og:site_name', 'OpenIAP');
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:url', canonicalUrl);
    upsertMeta('name', 'twitter:title', pageTitle);
    upsertMeta('name', 'twitter:description', pageDescription);
    upsertMeta('name', 'twitter:image', imageUrl);
    upsertCanonical();
  }, [canonicalUrl, imageUrl, keywords, pageDescription, pageTitle, type]);

  // Schema.org structured data for SoftwareApplication
  const schemaOrg = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'OpenIAP',
    description: pageDescription,
    url: canonicalUrl,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'iOS, Android, visionOS, Horizon OS, Fire OS, Vega OS',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    author: {
      '@type': 'Organization',
      name: 'OpenIAP',
      url: BASE_URL,
    },
  };

  return (
    <>
      <title>{pageTitle}</title>
      {includeAppSchema && (
        <script type="application/ld+json">{JSON.stringify(schemaOrg)}</script>
      )}
    </>
  );
}

export default SEO;
