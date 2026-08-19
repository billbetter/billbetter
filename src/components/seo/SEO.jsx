import React from "react";
import { Helmet } from "react-helmet";

export default function SEO({
  title,
  description,
  keywords,
  canonical,
  ogImage,
  ogType = "website",
  noindex = false,
  jsonLd = null,
}) {
  const siteUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://invoicium.ca";
  const currentUrl =
    typeof window !== "undefined" ? window.location.href : siteUrl;

  const fullTitle = title
    ? `${title} | Invoicium`
    : "Invoicium – AI Invoicing & Quotes for Contractors";
  const defaultDescription =
    description ||
    "Create invoices and quotes in seconds with AI. Built for contractors and trades. Send, track, and get paid faster.";
  const defaultOgImage = ogImage || `${siteUrl}/og-image.png`;
  const canonicalUrl = canonical || currentUrl;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={defaultDescription} />
      {keywords && <meta name="keywords" content={keywords} />}

      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />

      {/* Robots */}
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={defaultDescription} />
      <meta property="og:image" content={defaultOgImage} />
      <meta property="og:site_name" content="Invoicium" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={currentUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={defaultDescription} />
      <meta name="twitter:image" content={defaultOgImage} />

      {/* Additional Meta */}
      <meta name="author" content="Invoicium" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
      <meta name="language" content="English" />

      {/* JSON-LD Structured Data */}
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
