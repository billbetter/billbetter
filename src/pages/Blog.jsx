import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight, Clock, User } from "lucide-react";
import SEO from "@/components/seo/SEO";
import {
  PageHero,
  Section,
  SectionHeading,
} from "@/components/marketing";

export default function Blog() {
  const blogPosts = [
    {
      slug: "how-to-invoice-as-electrician",
      title: "How to Invoice as an Electrician (Free Template)",
      excerpt:
        "Complete guide to creating professional electrical invoices. Includes free template, pricing strategies, and payment best practices for electricians.",
      category: "Electricians",
      readTime: "8 min read",
      date: "Jan 15, 2025",
      author: "Invoicium Team",
    },
    {
      slug: "best-invoicing-software-plumbers",
      title: "Best Invoicing Software for Plumbers in 2025",
      excerpt:
        "Compare the top invoicing solutions designed for plumbing contractors. Features, pricing, and recommendations to help you choose the right tool.",
      category: "Plumbers",
      readTime: "10 min read",
      date: "Jan 12, 2025",
      author: "Invoicium Team",
    },
    {
      slug: "invoice-vs-quote-contractors",
      title: "Invoice vs Quote: What Contractors Should Use",
      excerpt:
        "Understand the difference between invoices and quotes. Learn when to use each, legal requirements, and how to convert quotes to invoices.",
      category: "Business Tips",
      readTime: "6 min read",
      date: "Jan 10, 2025",
      author: "Invoicium Team",
    },
    {
      slug: "recurring-invoices-for-contractors",
      title: "How to Set Up Recurring Invoices for Maintenance Contracts",
      excerpt:
        "Automate your maintenance contract billing with recurring invoices. Step-by-step guide for HVAC, plumbing, and electrical service contracts.",
      category: "Business Tips",
      readTime: "7 min read",
      date: "Jan 8, 2025",
      author: "Invoicium Team",
    },
    {
      slug: "hvac-invoice-template-guide",
      title: "HVAC Invoice Template & Billing Best Practices",
      excerpt:
        "Professional HVAC invoice template with seasonal service plans, equipment quotes, and customer payment terms that protect your business.",
      category: "HVAC",
      readTime: "9 min read",
      date: "Jan 5, 2025",
      author: "Invoicium Team",
    },
    {
      slug: "get-paid-faster-contractor-tips",
      title: "10 Ways Contractors Can Get Paid Faster",
      excerpt:
        "Practical strategies to reduce payment delays and improve cash flow. Online payments, invoice timing, and client communication tactics that work.",
      category: "Business Tips",
      readTime: "11 min read",
      date: "Jan 3, 2025",
      author: "Invoicium Team",
    },
  ];

  const categories = [
    "All",
    "Electricians",
    "Plumbers",
    "HVAC",
    "Business Tips",
  ];
  const [activeCategory, setActiveCategory] = React.useState("All");

  const filteredPosts =
    activeCategory === "All"
      ? blogPosts
      : blogPosts.filter((post) => post.category === activeCategory);

  return (
    <>
      <SEO
        title="Contractor Invoicing Blog – Tips, Templates & Best Practices"
        description="Free guides, templates, and expert advice for contractor invoicing, quoting, and billing. Learn how electricians, plumbers, and HVAC pros get paid faster."
        keywords="contractor invoicing tips, electrician invoice template, plumber invoicing guide, hvac billing, contractor payment tips, invoice best practices"
      />

      <div className="min-h-screen bg-surface-sunken">
        {/* Hero Section */}
        <PageHero
          eyebrow="Contractor Business Resources"
          eyebrowIcon={FileText}
          title="Invoicing & Business Tips"
          accent="for Contractors"
          subtitle="Free templates, expert guides, and proven strategies to help electricians, plumbers, HVAC technicians, and contractors streamline billing and get paid faster."
        >
          <div className="mt-10">
            <Link to={createPageUrl("Features")}>
              <Button variant="brand" size="brand">
                Explore AI Invoicing Features
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </PageHero>

        {/* Category Filter */}
        <section className="pb-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-wrap gap-3 justify-center">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    activeCategory === category
                      ? "bg-brand text-content-inverted"
                      : "bg-surface text-content-body border border-line hover:bg-surface-sunken hover:text-content"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Blog Posts Grid */}
        <section className="py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredPosts.map((post) => (
                <Link
                  key={post.slug}
                  to={createPageUrl(`BlogPost?slug=${post.slug}`)}
                >
                  <Card className="h-full rounded-2xl border border-line hover:border-brand-300 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer group">
                    <CardContent className="p-6">
                      <div className="mb-4">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-brand-50 border border-brand-200 text-brand-700">
                          {post.category}
                        </span>
                      </div>

                      <h2 className="text-xl font-black text-content mb-3 group-hover:text-brand-700 transition-colors">
                        {post.title}
                      </h2>

                      <p className="text-content-body text-sm leading-relaxed mb-4 line-clamp-3">
                        {post.excerpt}
                      </p>

                      <div className="flex items-center justify-between text-sm text-content-muted pt-4 border-t border-line-subtle">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {post.readTime}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {post.author}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center text-brand-700 font-semibold text-sm group-hover:gap-2 transition-all">
                        Read Article
                        <ArrowRight className="w-4 h-4 ml-1 group-hover:ml-0 transition-all" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Newsletter CTA */}
        <Section tone="dark" pad="lg" width="3xl" ambient="emerald">
          <div className="text-center">
            <SectionHeading
              invert
              title="Want More Invoicing & Business Tips?"
              subtitle="Get weekly tips, templates, and strategies delivered to your inbox. Join 1,000+ contractors growing their businesses with Invoicium."
              className="mb-10"
            />
            <Link to={createPageUrl("Pricing")}>
              <Button variant="brandOnDark" size="brandLg">
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </Section>
      </div>
    </>
  );
}
