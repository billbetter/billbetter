"use client";

import React, { useState } from "react";
import { Calendar, Clock, Video, CheckCircle, ArrowRight, Star, Users, Zap, Sparkles, Shield, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Clock, title: "30 Minutes", description: "A focused, no-fluff walkthrough tailored to your business needs." },
  { icon: Video, title: "Live & Personal", description: "1-on-1 with a real person — not a pre-recorded video or chatbot." },
  { icon: Zap, title: "See Everything", description: "Invoicing, AI tools, payments, crew management, and more — live." }
];

const coverItems = [
  "Creating and sending professional invoices",
  "AI-powered quote & invoice generation",
  "Online payment setup with Stripe",
  "Job tracking & photo documentation",
  "Recurring invoices & automations",
  "Crew management & permissions",
  "Analytics & business insights",
  "Your specific questions & use case"
];

const testimonials = [
  {
    quote: "The demo showed me exactly how AxisBill would work for my roofing business. Signed up right after!",
    author: "Mike R.",
    role: "Roofing Contractor"
  },
  {
    quote: "30 minutes saved me hours of figuring things out on my own. Highly recommend booking one.",
    author: "Sarah T.",
    role: "HVAC Business Owner"
  }
];

export default function BookDemo() {
  const [isHovered, setIsHovered] = useState(false);

  const handleBooking = () => {
    window.open("https://calendar.app.google/oMcQbdWok7g1wYrm9", "_blank");
  };

  return (
    <section className="relative overflow-hidden">
      {/* Background with gradient and patterns */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900" />
      
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-400/5 rounded-full blur-3xl" />
      </div>

      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />

      <div className="relative z-10">
        {/* Hero Section */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 lg:pt-32 pb-12 sm:pb-16 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-6 sm:mb-8 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 backdrop-blur-sm">
            <Sparkles className="w-4 h-4" />
            100% Free · No Commitment · Instant Confirmation
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white mb-6 leading-[1.1]">
            See AxisBill in Action
            <span className="block text-emerald-400 mt-2">Just for You</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed">
            Book a free 30-minute 1-on-1 demo. We'll show you exactly how AxisBill can transform your contractor business and answer all your questions live.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <Button
              onClick={handleBooking}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              size="xl"
              className="group w-full sm:w-auto"
            >
              <Calendar className="w-5 h-5 mr-2" />
              Book My Free Demo
              <ArrowRight className={`w-5 h-5 ml-2 transition-transform duration-200 ${isHovered ? 'translate-x-1' : ''}`} />
            </Button>
            
            <Button
              variant="outline"
              size="xl"
              className="w-full sm:w-auto"
              onClick={() => window.open("/quotes", "_self")}
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Contact Sales
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-slate-400 text-sm">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-emerald-400" />
              <span>Rated 4.9/5 by contractors</span>
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {features.map((item, i) => (
              <div 
                key={i} 
                className="group bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 hover:border-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/10"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <item.icon className="w-7 h-7 text-emerald-400" />
                </div>
                <h3 className="text-white font-bold text-xl mb-3">{item.title}</h3>
                <p className="text-slate-400 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* What We'll Cover + Demo Preview Grid */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            {/* What We'll Cover */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-10 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-6 sm:mb-8">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                  <Users className="w-6 h-6 text-emerald-400" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white">What We'll Cover</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {coverItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 group">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-emerald-500/30 transition-colors">
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                    </div>
                    <span className="text-slate-300 text-sm leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Testimonials / Social Proof */}
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-3xl p-6 sm:p-8">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  Loved by Contractors
                </h3>
                
                <div className="space-y-4">
                  {testimonials.map((t, i) => (
                    <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/5">
                      <p className="text-slate-300 text-sm italic mb-3">"{t.quote}"</p>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <span className="text-emerald-400 text-xs font-bold">{t.author[0]}</span>
                        </div>
                        <div>
                          <p className="text-white text-sm font-semibold">{t.author}</p>
                          <p className="text-slate-500 text-xs">{t.role}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-2xl sm:text-3xl font-bold text-emerald-400">500+</p>
                  <p className="text-slate-400 text-xs sm:text-sm">Demos Given</p>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-2xl sm:text-3xl font-bold text-emerald-400">30</p>
                  <p className="text-slate-400 text-xs sm:text-sm">Minutes</p>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-2xl sm:text-3xl font-bold text-emerald-400">$0</p>
                  <p className="text-slate-400 text-xs sm:text-sm">Cost</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <div className="bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-emerald-500/20 border border-emerald-500/30 rounded-3xl p-8 sm:p-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to transform your business?
            </h2>
            <p className="text-slate-300 text-lg mb-8 max-w-xl mx-auto">
              Join hundreds of contractors who streamlined their invoicing with AxisBill. Your free demo is just one click away.
            </p>
            <Button
              onClick={handleBooking}
              size="xl"
              className="group"
            >
              <Calendar className="w-5 h-5 mr-2" />
              Schedule My Free Demo
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
