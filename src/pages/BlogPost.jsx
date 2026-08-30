import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Clock,
  User,
  Calendar,
  ArrowRight,
} from "lucide-react";
import SEO from "@/components/seo/SEO";

export default function BlogPost() {
  const location = useLocation();
  const [post, setPost] = useState(null);

  const blogPosts = {
    "how-to-invoice-as-electrician": {
      title: "How to Invoice as an Electrician (Free Template)",
      description:
        "Complete guide to creating professional electrical invoices with free template, pricing strategies, and payment best practices for electricians.",
      category: "Electricians",
      readTime: "8 min read",
      date: "January 15, 2025",
      author: "Invoicium Team",
      content: `
 <p>As an electrician, sending professional invoices is crucial for maintaining cash flow and building trust with clients. Whether you're handling residential service calls, commercial installations, or emergency repairs, a well-structured invoice ensures you get paid on time and keeps your business organized.</p>

 <h2>What to Include in an Electrical Invoice</h2>
 
 <p>Every professional electrician invoice should include these essential elements:</p>
 
 <ul>
 <li><strong>Your business information:</strong> Company name, license number, address, phone, and email</li>
 <li><strong>Client details:</strong> Customer name, service address, and contact information</li>
 <li><strong>Invoice number:</strong> Sequential numbering for record-keeping</li>
 <li><strong>Date of service:</strong> When the work was completed</li>
 <li><strong>Itemized services:</strong> Detailed breakdown of labor and materials</li>
 <li><strong>Labor costs:</strong> Hours worked and hourly rate for electrical work</li>
 <li><strong>Materials & parts:</strong> Electrical supplies, fixtures, and equipment used</li>
 <li><strong>Subtotal and taxes:</strong> Pre-tax amount and applicable sales tax</li>
 <li><strong>Total amount due:</strong> Final amount the client owes</li>
 <li><strong>Payment terms:</strong> Due date and accepted payment methods</li>
 </ul>

 <h2>Pricing Strategies for Electrical Work</h2>
 
 <p>Electricians typically use one of three pricing models:</p>
 
 <h3>1. Hourly Rate Billing</h3>
 <p>Charge by the hour for service calls, troubleshooting, and repairs. Most residential electricians charge between $50-$150 per hour depending on location and experience. Include a minimum service charge (usually 1-2 hours) to cover travel time and initial assessment.</p>

 <h3>2. Flat-Rate Pricing</h3>
 <p>Offer fixed prices for common tasks like outlet installation, light fixture replacement, or panel upgrades. Clients appreciate knowing the cost upfront, and it often leads to higher profits for straightforward jobs.</p>

 <h3>3. Project-Based Pricing</h3>
 <p>For larger jobs like whole-house rewiring or commercial installations, provide a comprehensive quote that covers all labor, materials, and permits. Break down the project into phases or milestones for progress payments.</p>

 <h2>Payment Terms & Best Practices</h2>
 
 <p>To ensure timely payment and maintain healthy cash flow:</p>
 
 <ul>
 <li><strong>Net 30 terms:</strong> Standard for commercial work, giving clients 30 days to pay</li>
 <li><strong>Payment upon completion:</strong> Common for residential service calls under $1,000</li>
 <li><strong>Deposit required:</strong> Request 25-50% upfront for projects over $2,000</li>
 <li><strong>Late fees:</strong> Clearly state penalties for overdue payments (typically 1.5-2% per month)</li>
 <li><strong>Multiple payment options:</strong> Accept credit cards, bank transfers, checks, and online payments</li>
 </ul>

 <h2>Free Electrical Invoice Template</h2>
 
 <p>Use professional invoicing software like Invoicium to automatically generate electrical invoices in seconds. Our AI-powered system suggests line items based on your description of the work, calculates totals, applies tax rates, and creates branded PDFs instantly.</p>

 <h2>Tips for Faster Payment</h2>
 
 <ul>
 <li>Send invoices immediately after completing the job</li>
 <li>Include online payment links for one-click checkout</li>
 <li>Follow up on overdue invoices with one-tap reminders</li>
 <li>Offer early payment discounts (2% off if paid within 7 days)</li>
 <li>Use clear, professional language and itemize all charges</li>
 </ul>

 <h2>Common Electrical Invoice Mistakes to Avoid</h2>
 
 <p>Don't fall into these common traps that delay payment:</p>
 
 <ul>
 <li>Vague descriptions like "electrical work" instead of specific tasks performed</li>
 <li>Missing license numbers or permits required in your jurisdiction</li>
 <li>Unclear payment terms or missing due dates</li>
 <li>Handwritten invoices that look unprofessional</li>
 <li>Not sending invoices promptly after job completion</li>
 </ul>

 <h2>How Invoicium Helps Electricians</h2>
 
 <p>Invoicium's AI invoicing software is designed specifically for trades like electricians. Create professional electrical invoices in under 60 seconds using voice input or text descriptions. Our platform handles:</p>
 
 <ul>
 <li>Automatic invoice numbering and organization</li>
 <li>Custom pricing for electrical services and materials</li>
 <li>Instant PDF generation with your branding</li>
 <li>One-click payment links for faster collections</li>
 <li>One-tap payment reminders and follow-ups</li>
 <li>Mobile app for invoicing from job sites</li>
 </ul>
 `,
    },
    "best-invoicing-software-plumbers": {
      title: "Best Invoicing Software for Plumbers in 2025",
      description:
        "Compare top invoicing solutions for plumbing contractors. Features, pricing, and recommendations to help you choose the right tool for your business.",
      category: "Plumbers",
      readTime: "10 min read",
      date: "January 12, 2025",
      author: "Invoicium Team",
      content: `
 <p>Choosing the right invoicing software can transform your plumbing business. Whether you're a solo plumber handling service calls or running a team of technicians, the right tool streamlines billing, speeds up payments, and keeps your business organized.</p>

 <h2>What Plumbers Need in Invoicing Software</h2>
 
 <p>Unlike generic invoicing tools, plumbing contractors need specific features:</p>
 
 <ul>
 <li><strong>Mobile-first design:</strong> Create invoices on-site from your phone or tablet</li>
 <li><strong>Voice input:</strong> Speak your invoice details while your hands are dirty</li>
 <li><strong>Parts & materials tracking:</strong> Easily add plumbing fixtures, pipes, and supplies</li>
 <li><strong>Service call templates:</strong> Quick invoicing for common jobs like drain cleaning, leak repairs, water heater installation</li>
 <li><strong>Emergency pricing:</strong> Different rates for after-hours and weekend service calls</li>
 <li><strong>Photo attachments:</strong> Include before/after photos of plumbing work</li>
 <li><strong>Online payments:</strong> Let customers pay immediately with credit cards</li>
 <li><strong>Recurring billing:</strong> Automate invoices for maintenance contracts</li>
 </ul>

 <h2>Top Invoicing Software for Plumbers</h2>

 <h3>1. Invoicium (Recommended)</h3>
 <p><strong>Best for:</strong> Solo plumbers and small plumbing teams who want AI-powered simplicity</p>
 <p>Invoicium uses AI to generate plumbing invoices in seconds. Just describe the job ("replaced kitchen faucet and fixed leaking P-trap") and the software suggests line items with pricing. Voice-to-text input means you can create invoices hands-free from the job site.</p>
 <p><strong>Pricing:</strong> Starting at $24/month with 7-day free trial</p>
 <p><strong>Key features:</strong> AI invoice generation, voice input, online payments, recurring billing, mobile app</p>

 <h3>2. Jobber</h3>
 <p><strong>Best for:</strong> Larger plumbing companies with scheduling needs</p>
 <p>Full-featured field service management with invoicing, scheduling, dispatch, and client management. More complex but powerful for teams.</p>
 <p><strong>Pricing:</strong> Starting at $49/month</p>

 <h3>3. FreshBooks</h3>
 <p><strong>Best for:</strong> Plumbers who need accounting integration</p>
 <p>Traditional invoicing with strong accounting features. Good if you need detailed financial reporting.</p>
 <p><strong>Pricing:</strong> Starting at $19/month</p>

 <h2>Essential Features Comparison</h2>
 
 <table style="width:100%; border-collapse: collapse; margin: 20px 0;">
 <tr style="background: #f9fafb;">
 <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Feature</th>
 <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Invoicium</th>
 <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Jobber</th>
 <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">FreshBooks</th>
 </tr>
 <tr>
 <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">AI Invoice Generation</td>
 <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e5e7eb;">✓</td>
 <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e5e7eb;">✗</td>
 <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e5e7eb;">✗</td>
 </tr>
 <tr>
 <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Voice Input</td>
 <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e5e7eb;">✓</td>
 <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e5e7eb;">✗</td>
 <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e5e7eb;">✗</td>
 </tr>
 <tr>
 <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Mobile App</td>
 <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e5e7eb;">✓</td>
 <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e5e7eb;">✓</td>
 <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e5e7eb;">✓</td>
 </tr>
 <tr>
 <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Online Payments</td>
 <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e5e7eb;">✓</td>
 <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e5e7eb;">✓</td>
 <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e5e7eb;">✓</td>
 </tr>
 <tr>
 <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Starting Price</td>
 <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e5e7eb;">$24/mo</td>
 <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e5e7eb;">$49/mo</td>
 <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e5e7eb;">$19/mo</td>
 </tr>
 </table>

 <h2>How to Choose the Right Software</h2>
 
 <p>Consider these factors when selecting invoicing software for your plumbing business:</p>
 
 <h3>Business Size</h3>
 <ul>
 <li><strong>Solo plumber:</strong> Simple, affordable tools like Invoicium are perfect</li>
 <li><strong>2-5 technicians:</strong> Invoicium or Jobber work well</li>
 <li><strong>6+ employees:</strong> Consider Jobber for advanced scheduling and dispatch</li>
 </ul>

 <h3>Job Types</h3>
 <ul>
 <li><strong>Service calls & repairs:</strong> Need fast mobile invoicing (Invoicium excels here)</li>
 <li><strong>Installation projects:</strong> Need detailed quoting and progress billing</li>
 <li><strong>Maintenance contracts:</strong> Require recurring billing automation</li>
 </ul>

 <h3>Budget</h3>
 <p>Most plumbing invoicing software costs $20-$100/month depending on features and team size. Factor in payment processing fees (usually 1-3% per transaction) when comparing total costs.</p>

 <h2>Implementation Tips</h2>
 
 <p>Once you've chosen software, follow these steps for smooth adoption:</p>
 
 <ol>
 <li>Start with a free trial before committing</li>
 <li>Import your existing client database</li>
 <li>Create templates for your most common plumbing services</li>
 <li>Train your team on mobile invoicing from job sites</li>
 <li>Send payment reminders in one tap</li>
 <li>Enable online payment links to get paid faster</li>
 </ol>

 <h2>Why Invoicium is Perfect for Plumbers</h2>
 
 <p>Invoicium was designed with trades like plumbing in mind. Our AI understands plumbing terminology and can instantly create professional invoices from simple descriptions like:</p>
 
 <ul>
 <li>"Cleared main sewer line with hydro jetting, replaced toilet wax ring"</li>
 <li>"Emergency water heater replacement, 50 gallon gas"</li>
 <li>"Fixed leaking shower valve, installed new cartridge"</li>
 </ul>
 
 <p>The AI suggests appropriate line items, pricing, and materials automatically. You can edit anything before sending, and clients receive a professional PDF invoice with online payment links.</p>
 `,
    },
    "invoice-vs-quote-contractors": {
      title: "Invoice vs Quote: What Contractors Should Use",
      description:
        "Understand the difference between invoices and quotes for contractors. Learn when to use each, legal requirements, and how to convert quotes to invoices.",
      category: "Business Tips",
      readTime: "6 min read",
      date: "January 10, 2025",
      author: "Invoicium Team",
      content: `
 <p>As a contractor, understanding when to send a quote versus an invoice is crucial for proper business operations, legal protection, and client relationships. Using the wrong document at the wrong time can lead to payment disputes, legal issues, and lost revenue.</p>

 <h2>What is a Quote (Estimate)?</h2>
 
 <p>A quote (also called an estimate) is a document sent <strong>before</strong> work begins that outlines the expected cost of a project. It's your professional proposal for what the work will cost based on your assessment.</p>
 
 <h3>Key Characteristics of Quotes:</h3>
 <ul>
 <li>Sent before work starts</li>
 <li>Shows projected costs, not final charges</li>
 <li>Can be negotiated or modified</li>
 <li>May have an expiration date</li>
 <li>Requires client approval to proceed</li>
 <li>Not a demand for payment</li>
 </ul>

 <h3>When Contractors Should Use Quotes:</h3>
 <ul>
 <li>New client projects where scope needs approval</li>
 <li>Large jobs requiring materials procurement</li>
 <li>Commercial contracts with bid processes</li>
 <li>Projects with uncertain variables (hidden issues, permit delays)</li>
 <li>Any job where client wants cost comparison before committing</li>
 </ul>

 <h2>What is an Invoice?</h2>
 
 <p>An invoice is a formal request for payment sent <strong>after</strong> work is completed (or for progress payments during long projects). It's a legally binding document demanding payment for services rendered.</p>

 <h3>Key Characteristics of Invoices:</h3>
 <ul>
 <li>Sent after work is done</li>
 <li>Shows actual costs for completed work</li>
 <li>Non-negotiable once agreed upon</li>
 <li>Has specific payment terms and due date</li>
 <li>Legal document for collections if unpaid</li>
 <li>Required for business accounting and taxes</li>
 </ul>

 <h3>When Contractors Should Use Invoices:</h3>
 <ul>
 <li>After completing any paid work</li>
 <li>For service calls with agreed-upon rates</li>
 <li>Following quote approval when work is done</li>
 <li>Progress billing on long-term projects</li>
 <li>Recurring maintenance contracts</li>
 </ul>

 <h2>Key Differences at a Glance</h2>
 
 <table style="width:100%; border-collapse: collapse; margin: 20px 0;">
 <tr style="background: #f9fafb;">
 <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Aspect</th>
 <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Quote</th>
 <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Invoice</th>
 </tr>
 <tr>
 <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>Timing</strong></td>
 <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Before work starts</td>
 <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">After work completed</td>
 </tr>
 <tr>
 <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>Purpose</strong></td>
 <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Propose cost estimate</td>
 <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Request payment</td>
 </tr>
 <tr>
 <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>Binding</strong></td>
 <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Not binding until approved</td>
 <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Legally binding</td>
 </tr>
 <tr>
 <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>Negotiable</strong></td>
 <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Yes, can be revised</td>
 <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">No, final amount</td>
 </tr>
 <tr>
 <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>Payment Terms</strong></td>
 <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">May mention deposit</td>
 <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Specific due date</td>
 </tr>
 <tr>
 <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>Client Action</strong></td>
 <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Approve or decline</td>
 <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Make payment</td>
 </tr>
 </table>

 <h2>The Proper Workflow: Quote to Invoice</h2>
 
 <p>For most contractor projects, follow this process:</p>
 
 <h3>Step 1: Site Visit & Assessment</h3>
 <p>Visit the job site, assess the work required, measure, and note any special conditions.</p>

 <h3>Step 2: Send Quote</h3>
 <p>Create and send a detailed quote showing:</p>
 <ul>
 <li>Itemized labor costs</li>
 <li>Materials and supplies needed</li>
 <li>Project timeline</li>
 <li>Payment terms (deposit, progress payments)</li>
 <li>Quote expiration date (typically 30 days)</li>
 </ul>

 <h3>Step 3: Client Approval</h3>
 <p>Get written approval of the quote before starting work. This protects both you and the client.</p>

 <h3>Step 4: Complete Work</h3>
 <p>Perform the agreed-upon services according to the quote specifications.</p>

 <h3>Step 5: Send Invoice</h3>
 <p>Create an invoice for the completed work. If the job matched the quote exactly, the invoice total should match. Document any approved changes that affected pricing.</p>

 <h2>What if the Final Cost Differs from the Quote?</h2>
 
 <p>Sometimes actual costs deviate from quoted amounts due to:</p>
 <ul>
 <li>Hidden problems discovered during work</li>
 <li>Client-requested changes or upgrades</li>
 <li>Material price increases</li>
 <li>Additional labor required</li>
 </ul>

 <p><strong>Best Practice:</strong> Always get client approval in writing before performing additional work that will increase costs. Send a revised quote or change order, wait for approval, then proceed.</p>

 <h2>Legal Requirements</h2>
 
 <h3>For Quotes:</h3>
 <ul>
 <li>Some states require written quotes for jobs over certain dollar amounts ($500-$1,000 typically)</li>
 <li>Must clearly state if it's an estimate vs. firm quote</li>
 <li>Should include contractor license number</li>
 </ul>

 <h3>For Invoices:</h3>
 <ul>
 <li>Required for all paid work (tax documentation)</li>
 <li>Must include business tax ID</li>
 <li>Should state payment terms and late fees</li>
 <li>Necessary for collections if client doesn't pay</li>
 </ul>

 <h2>Invoicium's Quote-to-Invoice System</h2>
 
 <p>Invoicium streamlines the entire quote-to-invoice process for contractors:</p>
 
 <ul>
 <li><strong>Create quotes in seconds:</strong> Use AI to generate professional quotes from job descriptions</li>
 <li><strong>Client approval workflow:</strong> Send quotes with approval links that clients can accept online</li>
 <li><strong>One-click conversion:</strong> Convert approved quotes to invoices instantly</li>
 <li><strong>Change orders:</strong> Easy to modify quotes and get re-approval for scope changes</li>
 <li><strong>Automatic numbering:</strong> Separate numbering for quotes (QTE-0001) and invoices (INV-0001)</li>
 <li><strong>Status tracking:</strong> See which quotes are pending, approved, or declined</li>
 </ul>

 <h2>Common Contractor Mistakes</h2>
 
 <p>Avoid these pitfalls:</p>
 
 <ul>
 <li><strong>Starting work without approval:</strong> Always get quote approval in writing first</li>
 <li><strong>Using only verbal quotes:</strong> Put everything in writing to avoid disputes</li>
 <li><strong>Not documenting changes:</strong> Track and approve all scope changes that affect pricing</li>
 <li><strong>Sending invoices without quotes:</strong> For larger jobs, always quote first</li>
 <li><strong>Unclear quote language:</strong> Be specific about what's included and excluded</li>
 </ul>
 `,
    },
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const slug = params.get("slug");
    if (slug && blogPosts[slug]) {
      setPost({ slug, ...blogPosts[slug] });
    }
  }, [location]);

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-black text-content mb-4 tracking-tight">
            Post Not Found
          </h1>
          <Link to={createPageUrl("Blog")}>
            <Button variant="brand" size="brand">
              Back to Blog
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title={post.title}
        description={post.description}
        keywords={`contractor ${post.category.toLowerCase()}, invoicing tips, ${post.category.toLowerCase()} business, contractor billing, invoice best practices`}
        ogType="article"
      />

      <div className="min-h-screen bg-surface">
        {/* Article Header */}
        <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Link to={createPageUrl("Blog")}>
            <Button variant="ghost" className="mb-8 hover:bg-ink-100">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Blog
            </Button>
          </Link>

          <div className="mb-8">
            <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold bg-brand-50 border border-brand-200 text-brand-700 mb-6">
              {post.category}
            </span>

            <h1 className="text-[clamp(2.5rem,7vw,4.5rem)] font-black text-content mb-6 leading-[0.9] tracking-tight">
              {post.title}
            </h1>

            <div className="flex flex-wrap items-center gap-6 text-content-body text-sm">
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {post.date}
              </span>
              <span className="flex items-center gap-2">
                <User className="w-4 h-4" />
                {post.author}
              </span>
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {post.readTime}
              </span>
            </div>
          </div>

          {/* Article Content */}
          <div
            className="prose prose-lg max-w-none prose-headings:font-black prose-headings:text-content prose-headings:tracking-tight prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-6 prose-h3:text-2xl prose-h3:mt-8 prose-h3:mb-4 prose-p:text-content-body prose-p:leading-relaxed prose-li:text-content-body prose-strong:text-content prose-a:text-brand-700 prose-a:font-semibold prose-a:no-underline hover:prose-a:underline"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* CTA Card */}
          <Card className="mt-16 bg-surface-inverted text-content-inverted border-none rounded-2xl overflow-hidden">
            <CardContent className="p-8 text-center">
              <h3 className="text-2xl sm:text-3xl font-black mb-4 leading-tight">
                Ready to Streamline Your Invoicing?
              </h3>
              <p className="text-lg text-ink-300 mb-8 leading-relaxed">
                Join hundreds of contractors using Invoicium's AI-powered
                invoicing. Create professional invoices in seconds, not minutes.
              </p>
              <Link to={createPageUrl("Pricing")}>
                <Button variant="brandOnDark" size="brand">
                  Start Free Trial
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Internal Links */}
          <div className="mt-16 grid md:grid-cols-2 gap-6">
            <Link to={createPageUrl("Features")}>
              <Card className="rounded-2xl border border-line hover:border-brand-300 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer h-full">
                <CardContent className="p-6">
                  <h4 className="text-lg font-semibold text-content mb-2">
                    Explore AI Invoicing Features
                  </h4>
                  <p className="text-content-body mb-3">
                    See how voice-to-text, recurring billing, and professional
                    PDFs can transform your contractor business.
                  </p>
                  <span className="text-success-600 font-medium flex items-center">
                    Learn More
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </span>
                </CardContent>
              </Card>
            </Link>

            <Link to={createPageUrl("Pricing")}>
              <Card className="rounded-2xl border border-line hover:border-brand-300 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer h-full">
                <CardContent className="p-6">
                  <h4 className="text-lg font-semibold text-content mb-2">
                    View Contractor Invoicing Pricing
                  </h4>
                  <p className="text-content-body mb-3">
                    Plans starting at $24/month. All plans include unlimited
                    clients, online payments, and mobile access.
                  </p>
                  <span className="text-success-600 font-medium flex items-center">
                    See Plans
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          </div>
        </article>
      </div>
    </>
  );
}
