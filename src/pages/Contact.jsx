import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { sdk } from "@/api/sdk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Mail,
  MessageSquare,
  Send,
  CheckCircle,
  Loader2,
  Clock,
  Zap,
  Shield,
  ArrowRight,
} from "lucide-react";
import SEO from "@/components/seo/SEO";

export default function Contact() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [linkWarning, setLinkWarning] = useState(false);

  const containsLink = (text) =>
    /https?:\/\/|www\.|\.com|\.net|\.org|\.io/i.test(text);

  const handleMessageChange = (e) => {
    const val = e.target.value;
    setFormData({ ...formData, message: val });
    setLinkWarning(containsLink(val));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (containsLink(formData.message)) {
      setLinkWarning(true);
      return;
    }
    setLoading(true);
    try {
      await sdk.functions.invoke("sendContactEmail", formData);
      setSuccess(true);
      setFormData({ name: "", email: "", subject: "", message: "" });
      setTimeout(() => setSuccess(false), 6000);
    } catch (error) {
      console.error("Error sending message:", error);
      alert(
        "Failed to send message. Please try again or email us directly at support@invoicium.ca",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEO
        title="Contact Invoicium – Contractor Invoicing Support"
        description="Questions about AI invoicing for contractors? Contact Invoicium support for help with invoicing, quotes, payments, and account setup."
        keywords="contractor invoicing support, invoice software help, electrician invoicing contact, plumber invoicing support, hvac billing help"
      />

      <div className="min-h-screen bg-surface-sunken">
        {/* Hero Banner */}
        <div className="relative overflow-hidden bg-surface border-b border-line py-16 sm:py-24 px-4">
          {/* Background decorations */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-brand-300/25 rounded-full blur-[160px]" />
          </div>

          <div className="relative max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-200 text-brand-700 rounded-full px-4 py-2 text-sm font-bold mb-8">
              <Zap className="w-4 h-4 flex-shrink-0" />
              Typically reply within a few hours
            </div>
            <h1 className="text-[clamp(2.5rem,7vw,4.5rem)] font-black text-content mb-6 leading-[0.9] tracking-tight">
              We're Here to <span className="text-brand-700">Help You</span>
            </h1>
            <p className="text-lg sm:text-xl text-content-body max-w-xl mx-auto leading-relaxed">
              Got a question or need support? Send us a message and our team
              will get back to you quickly.
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
          <div className="grid lg:grid-cols-5 gap-8 sm:gap-12 items-start">
            {/* Left: Info Panel */}
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h2 className="text-2xl font-black text-content mb-3">
                  Contact Support
                </h2>
                <p className="text-content-body leading-relaxed">
                  Whether you're having trouble with invoicing, need help
                  setting up payments, or have a billing question — we're ready
                  to help.
                </p>
              </div>

              {/* Info cards */}
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-surface rounded-2xl border border-line shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-brand-700" />
                  </div>
                  <div>
                    <p className="font-semibold text-content text-sm">
                      Email Us Directly
                    </p>
                    <a
                      href="mailto:support@invoicium.ca"
                      className="text-brand-700 hover:text-brand-800 text-sm font-medium transition-colors"
                    >
                      support@invoicium.ca
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-surface rounded-2xl border border-line shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-ink-100 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-content-body" />
                  </div>
                  <div>
                    <p className="font-semibold text-content text-sm">
                      Response Time
                    </p>
                    <p className="text-content-muted text-sm">
                      Usually within a few hours on business days
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-surface rounded-2xl border border-line shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5 text-brand-700" />
                  </div>
                  <div>
                    <p className="font-semibold text-content text-sm">
                      Your data is safe
                    </p>
                    <p className="text-content-muted text-sm">
                      We never share your information with third parties
                    </p>
                  </div>
                </div>
              </div>

              {/* CTA block */}
              <div className="p-5 bg-brand rounded-2xl text-content-inverted">
                <p className="font-semibold mb-1">New to Invoicium?</p>
                <p className="text-sm text-brand-100 mb-4">
                  Try it free — no credit card required.
                </p>
                <button
                  onClick={() => navigate(createPageUrl("Pricing"))}
                  className="inline-flex items-center gap-2 bg-surface text-brand-700 hover:bg-brand-50 transition-colors text-sm font-semibold px-4 py-2 rounded-xl"
                >
                  Get Started Free <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Right: Contact Form */}
            <div className="lg:col-span-3">
              {success ? (
                <div className="bg-surface rounded-2xl sm:rounded-3xl shadow-xl border border-line-subtle p-8 sm:p-12 text-center">
                  <div className="w-20 h-20 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-success-600" />
                  </div>
                  <h3 className="text-2xl font-black text-content mb-2">
                    Message Sent!
                  </h3>
                  <p className="text-content-body mb-6">
                    Thanks for reaching out. We'll get back to you as soon as
                    possible.
                  </p>
                  <button
                    onClick={() => setSuccess(false)}
                    className="text-success-600 hover:text-success-700 font-medium text-sm underline"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <div className="bg-surface rounded-3xl shadow-xl border border-line-subtle overflow-hidden">
                  {/* Form header */}
                  <div className="px-5 sm:px-8 pt-5 sm:pt-8 pb-4 sm:pb-6 border-b border-line-subtle">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-success-500 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-content-inverted" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-content">
                          Send a Message
                        </h3>
                        <p className="text-sm text-content-muted">
                          Fill in the details below
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Form body */}
                  <form
                    onSubmit={handleSubmit}
                    className="px-5 sm:px-8 py-5 sm:py-8 space-y-4 sm:space-y-6"
                  >
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="name"
                          className="text-sm font-semibold text-ink-700"
                        >
                          Full Name <span className="text-danger-400">*</span>
                        </Label>
                        <Input
                          id="name"
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                          placeholder="John Smith"
                          className="h-11 rounded-xl border-line focus:border-success-400 focus:ring-success-400/20"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="email"
                          className="text-sm font-semibold text-ink-700"
                        >
                          Email Address{" "}
                          <span className="text-danger-400">*</span>
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          placeholder="john@example.com"
                          className="h-11 rounded-xl border-line focus:border-success-400 focus:ring-success-400/20"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="subject"
                        className="text-sm font-semibold text-ink-700"
                      >
                        Subject <span className="text-danger-400">*</span>
                      </Label>
                      <Input
                        id="subject"
                        type="text"
                        required
                        value={formData.subject}
                        onChange={(e) =>
                          setFormData({ ...formData, subject: e.target.value })
                        }
                        placeholder="How can we help?"
                        className="h-11 rounded-xl border-line focus:border-success-400 focus:ring-success-400/20"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="message"
                        className="text-sm font-semibold text-ink-700"
                      >
                        Message <span className="text-danger-400">*</span>
                      </Label>
                      <Textarea
                        id="message"
                        required
                        value={formData.message}
                        onChange={handleMessageChange}
                        rows={5}
                        placeholder="Describe your question or issue in detail..."
                        className={`rounded-xl border-line resize-none focus:border-success-400 focus:ring-success-400/20 ${linkWarning ? "border-danger-400" : ""}`}
                      />
                      {linkWarning && (
                        <p className="text-sm text-danger-500 font-medium">
                          ⚠️ Links are not allowed in messages. Please remove
                          any URLs before sending.
                        </p>
                      )}
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate(createPageUrl("Home"))}
                        className="flex-1 h-11 rounded-xl border-line text-content-body hover:bg-surface-sunken"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={loading || linkWarning}
                        className="flex-1 h-11 rounded-xl bg-brand hover:bg-brand-hover text-content-inverted font-semibold shadow-lg shadow-brand-600/25 disabled:opacity-50"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Send Message
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
