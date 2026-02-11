import { Helmet } from 'react-helmet-async';

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
const DEFAULT_IMAGE = '/og-image.png';

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

  // Schema.org structured data for SoftwareApplication
  const schemaOrg = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'OpenIAP',
    description: pageDescription,
    url: canonicalUrl,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'iOS, Android, visionOS, Horizon OS',
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
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="title" content={pageTitle} />
      <meta name="description" content={pageDescription} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:site_name" content="OpenIAP" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />
      <meta name="twitter:image" content={imageUrl} />

      {/* Schema.org JSON-LD */}
      {includeAppSchema && (
        <script type="application/ld+json">{JSON.stringify(schemaOrg)}</script>
      )}
    </Helmet>
  );
}

export default SEO;
