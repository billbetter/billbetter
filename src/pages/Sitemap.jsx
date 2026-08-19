import React, { useEffect } from "react";

export default function Sitemap() {
  useEffect(() => {
    // Generate XML sitemap
    const baseUrl = window.location.origin;
    const currentDate = new Date().toISOString().split("T")[0];

    const pages = [
      { url: "/", changefreq: "weekly", priority: "1.0" },
      { url: "/home", changefreq: "weekly", priority: "1.0" },
      { url: "/features", changefreq: "monthly", priority: "0.9" },
      { url: "/pricing", changefreq: "monthly", priority: "0.9" },
      { url: "/blog", changefreq: "weekly", priority: "0.8" },
      { url: "/contact", changefreq: "monthly", priority: "0.7" },
      { url: "/terms-of-service", changefreq: "yearly", priority: "0.5" },
      // Blog posts
      {
        url: "/blog-post?slug=how-to-invoice-as-electrician",
        changefreq: "monthly",
        priority: "0.7",
      },
      {
        url: "/blog-post?slug=best-invoicing-software-plumbers",
        changefreq: "monthly",
        priority: "0.7",
      },
      {
        url: "/blog-post?slug=invoice-vs-quote-contractors",
        changefreq: "monthly",
        priority: "0.7",
      },
      {
        url: "/blog-post?slug=recurring-invoices-for-contractors",
        changefreq: "monthly",
        priority: "0.6",
      },
      {
        url: "/blog-post?slug=hvac-invoice-template-guide",
        changefreq: "monthly",
        priority: "0.6",
      },
      {
        url: "/blog-post?slug=get-paid-faster-contractor-tips",
        changefreq: "monthly",
        priority: "0.6",
      },
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (page) => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

    // Create download link
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sitemap.xml";

    // Auto-download
    link.click();

    // Clean up
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-sunken px-4">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-black text-content mb-4">
          Sitemap Generated
        </h1>
        <p className="text-lg text-content-body mb-6">
          Your sitemap.xml has been generated and downloaded. Upload it to your
          website root directory.
        </p>
        <div className="bg-surface rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-black text-content mb-4">
            Invoicium Pages:
          </h2>
          <ul className="text-left space-y-2 text-ink-700">
            <li>✓ Homepage (AI invoicing for contractors)</li>
            <li>✓ Features (invoicing and quoting features)</li>
            <li>✓ Pricing (contractor invoicing pricing)</li>
            <li>✓ Blog (contractor invoicing tips and guides)</li>
            <li>✓ Contact (support and inquiries)</li>
            <li>✓ Terms of Service</li>
            <li>✓ 6 Blog Posts (electrician, plumber, HVAC guides)</li>
          </ul>
        </div>
        <p className="text-sm text-content-muted mt-6">
          Submit your sitemap to Google Search Console for better SEO indexing.
        </p>
      </div>
    </div>
  );
}
