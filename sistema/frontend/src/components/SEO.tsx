import { Helmet } from 'react-helmet-async';

const SITE_NAME = 'Antenor & Filhos';
const SITE_ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'https://antenorecivilhos.com.br';

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  type?: string;
  image?: string | null;
  noindex?: boolean;
  keywords?: string;
}

export function SEO({
  title,
  description = 'Antenor & Filhos - Qualidade, Tradição e Elegância. Açougue, Adega e Padaria Artesanal.',
  canonical,
  type = 'website',
  image = '/og-image.png',
  noindex = false,
  keywords,
}: SEOProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} | Mercado Premium`;
  const resolvedCanonical = canonical
    ? (canonical.startsWith('http') ? canonical : `${SITE_ORIGIN}${canonical}`)
    : (typeof window !== 'undefined' ? window.location.href : undefined);
  const safeImage = image || '/og-image.png';
  const ogImage = safeImage.startsWith('http') ? safeImage : `${SITE_ORIGIN}${safeImage}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      {resolvedCanonical && <link rel="canonical" href={resolvedCanonical} />}
      {noindex ? (
        <meta name="robots" content="noindex,nofollow" />
      ) : (
        <meta name="robots" content="index,follow" />
      )}

      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content={SITE_NAME} />
      {resolvedCanonical && <meta property="og:url" content={resolvedCanonical} />}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      <meta name="theme-color" content="#5D082A" />
    </Helmet>
  );
}

export function StructuredData({ data }: { data: object }) {
  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(data)}
      </script>
    </Helmet>
  );
}
