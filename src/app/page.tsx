"use client";

import { useRouter } from "next/navigation";
import BookDemo from "@/components/BookDemo";

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="bg-white overflow-x-hidden">

      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <svg width="16" height="16" fill="white" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </div>
            <span className="text-white font-black text-xl">AxisBill</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/login")} className="text-gray-300 hover:text-white text-sm font-medium transition-colors">
              Sign In
            </button>
            <button onClick={() => router.push("/signup")} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors">
              Start Free Trial
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative bg-gray-900 pt-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-emerald-950" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-emerald-500/10 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-full text-sm font-bold mb-6 shadow-lg">
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                Rated #1 for Contractors
              </div>

              <h1 className="text-4xl sm:text-6xl lg:text-8xl font-black text-white leading-[0.95] mb-6 tracking-tight">
                GET PAID<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">TODAY.</span>
              </h1>

              <p className="text-xl text-gray-300 mb-8 leading-relaxed max-w-xl">
                Create professional invoices in <span className="text-emerald-400 font-bold">30 seconds</span>, get paid instantly — register for a free trial today.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-8">
                <button
                  onClick={() => router.push("/signup")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 h-14 rounded-2xl text-lg font-black shadow-2xl transition-all hover:-translate-y-0.5"
                >
                  START FREE TRIAL →
                </button>
                <button
                  onClick={() => document.getElementById('demo-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="bg-white/10 text-white border-2 border-white/30 hover:bg-white hover:text-gray-900 px-8 h-14 rounded-2xl text-lg font-bold transition-all"
                >
                  Book a Demo
                </button>
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                {["No credit card required", "7 days free", "Cancel anytime"].map((item) => (
                  <div key={item} className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-white/10">
                <p className="text-gray-400 text-xs mb-3 font-semibold uppercase tracking-wider">Trusted by pros in:</p>
                <div className="flex flex-wrap gap-2">
                  {["Electrical", "HVAC", "Plumbing", "Carpentry", "Landscaping", "Roofing"].map((trade) => (
                    <span key={trade} className="text-gray-300 text-sm bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
                      {trade}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Invoice mockup */}
            <div className="hidden lg:block relative">
              <div className="transform rotate-2 hover:rotate-0 transition-transform duration-500">
                <div className="absolute -top-6 -right-6 bg-emerald-500 text-white p-4 rounded-2xl shadow-2xl z-20 animate-pulse">
                  <div className="flex items-center gap-3">
                    <svg width="28" height="28" fill="currentColor" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23" stroke="white" strokeWidth="2"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" fill="none" stroke="white" strokeWidth="2"/></svg>
                    <div>
                      <p className="text-xs font-semibold opacity-90">Payment Received</p>
                      <p className="text-2xl font-black">$4,550.00</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between">
                    <span className="text-white font-bold text-lg">Invoice #1042</span>
                    <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">PAID</span>
                  </div>
                  <div className="p-8">
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <h3 className="text-3xl font-black text-gray-900 mb-1">INVOICE</h3>
                        <p className="text-gray-500">AxisBill Professional</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Due Date</p>
                        <p className="font-bold text-gray-900">Paid Today</p>
                      </div>
                    </div>
                    <div className="space-y-3 border-t border-b border-gray-100 py-4 mb-6">
                      {[
                        { label: "Electrical Panel Upgrade", amount: "$2,800.00" },
                        { label: "Materials & Parts", amount: "$950.00" },
                        { label: "Labor (8 hrs)", amount: "$800.00" },
                      ].map((item) => (
                        <div key={item.label} className="flex justify-between py-1">
                          <span className="text-gray-600">{item.label}</span>
                          <span className="font-semibold text-gray-900">{item.amount}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center mb-6">
                      <span className="text-lg font-bold text-gray-900">Total</span>
                      <span className="text-3xl font-black text-emerald-600">$4,550.00</span>
                    </div>
                    <div className="flex gap-3">
                      <button className="flex-1 bg-emerald-600 text-white h-12 rounded-xl font-bold">Pay Now</button>
                      <button className="flex-1 border border-gray-200 text-gray-700 h-12 rounded-xl font-bold">Download PDF</button>
                    </div>
                  </div>
                </div>

                <div className="absolute -bottom-4 -left-4 bg-gray-900 text-white px-4 py-2 rounded-xl shadow-xl flex items-center gap-2 border border-gray-700">
                  <svg width="18" height="18" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
                  <span className="font-bold text-sm">Created in 28 seconds</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PAIN POINTS */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl lg:text-5xl font-black text-gray-900 mb-6">Tired of Waiting to Get Paid?</h2>
            <p className="text-xl text-gray-600">You did the work. You deserve to get paid immediately.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-red-600 mb-6">Without AxisBill:</h3>
              {[
                { title: "Working Late", text: "Writing invoices at 11 PM after a 12-hour shift" },
                { title: "Chasing Checks", text: "'The check is in the mail' - for 3 weeks" },
                { title: "Paper Mess", text: "Lost receipts, scribbled notes, forgotten billable hours" },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-4 p-6 rounded-2xl bg-red-50 border-2 border-red-100">
                  <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                    <svg width="20" height="20" fill="none" stroke="#dc2626" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">{item.title}</h4>
                    <p className="text-gray-600">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-emerald-600 mb-6">With AxisBill:</h3>
              {[
                { title: "Invoice in Seconds", text: "Create and send from your phone before leaving the job site" },
                { title: "Instant Payments", text: "Clients pay by card, Apple Pay, or Google Pay with one tap" },
                { title: "Auto-Reminders", text: "System chases late payments so you don't have to" },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-4 p-6 rounded-2xl bg-emerald-50 border-2 border-emerald-100">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <svg width="20" height="20" fill="none" stroke="#059669" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">{item.title}</h4>
                    <p className="text-gray-600">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-bold">Everything You Need</span>
            <h2 className="text-4xl lg:text-5xl font-black text-gray-900 mt-4 mb-6">Built for the Field,<br />Not the Office</h2>
            <p className="text-xl text-gray-600">Professional invoicing that works where you work.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { title: "Invoice in 30 Seconds", desc: "Create and send professional invoices from your truck before you leave the job site." },
              { title: "Get Paid Today", desc: "Integrated payment links mean clients pay instantly with card, Apple Pay, or Google Pay." },
              { title: "One-Click Approvals", desc: "Send quotes that convert to invoices automatically when client approves." },
              { title: "Set It & Forget It", desc: "Recurring invoices for maintenance contracts. Auto-send, auto-remind, auto-get-paid." },
              { title: "Know Your Numbers", desc: "See which jobs are profitable and who owes you money — all from your phone." },
              { title: "Look Professional", desc: "Branded invoices and quotes that make you look like the established pro you are." },
            ].map((feature) => (
              <div key={feature.title} className="group bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-emerald-200">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-24 bg-emerald-600 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-black mb-6">Get Paid in 3 Steps</h2>
            <p className="text-xl text-emerald-100">No learning curve. No complicated setup. Just results.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 relative">
            <div className="hidden sm:block absolute top-14 left-[16%] right-[16%] h-1 bg-white/20" />
            {[
              { step: "1", title: "Create", desc: "Add line items in seconds. Auto-calculates taxes & totals." },
              { step: "2", title: "Send", desc: "Professional email with PDF & instant payment link." },
              { step: "3", title: "Get Paid", desc: "Money deposits to your account. Receipt sent automatically." },
            ].map((item) => (
              <div key={item.step} className="text-center relative">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white text-emerald-600 text-4xl font-black shadow-2xl mb-6 relative z-10">
                  {item.step}
                </div>
                <h3 className="text-3xl font-bold mb-3">{item.title}</h3>
                <p className="text-emerald-100 text-lg">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <button
              onClick={() => router.push("/signup")}
              className="bg-gray-900 text-white hover:bg-gray-800 px-10 h-14 text-xl font-black rounded-2xl shadow-2xl transition-all"
            >
              Start Getting Paid Today →
            </button>
          </div>
        </div>
      </section>

      {/* BOOK DEMO SECTION */}
      <div id="demo-section">
        <BookDemo />
      </div>

      {/* PRICING */}
      <section id="pricing-section" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-bold">Simple Pricing</span>
            <h2 className="text-4xl lg:text-5xl font-black text-gray-900 mt-4 mb-4">Choose Your Plan</h2>
            <p className="text-xl text-gray-600 mb-6">Start free, upgrade when you're ready.</p>
            <div className="inline-flex items-center gap-2 bg-emerald-500 text-white px-6 py-2 rounded-full font-bold shadow-lg">
              ⭐ Most Contractors Choose Professional ($79/mo)
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
            {[
              { name: "Free", price: 0, features: ["10 documents (lifetime)", "Manual invoices & quotes", "Client management", "Email support"], desc: "Try AxisBill risk-free" },
              { name: "Core", price: 24, features: ["30 transactions/mo", "AI assistance", "Online payments", "Photo attachments"], desc: "Perfect for freelancers" },
              { name: "Essential", price: 39, features: ["75 transactions/mo", "Analytics dashboard", "Recurring invoices", "Job tracking"], desc: "Best value for small businesses" },
              { name: "Professional", price: 79, features: ["250 transactions/mo", "Custom templates", "Priority support", "Advanced reporting"], desc: "Recommended for most", popular: true },
              { name: "Enterprise", price: 99, features: ["500 transactions/mo", "Crew management", "White-label options", "Dedicated support"], desc: "For larger operations" },
            ].map((plan: any) => (
              <div key={plan.name} className={`relative bg-white rounded-3xl p-6 transition-all hover:shadow-xl hover:-translate-y-1 ${plan.popular ? "ring-4 ring-emerald-500 shadow-2xl scale-105 z-10" : "border-2 border-gray-100 shadow-lg"}`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                    ⭐ MOST POPULAR
                  </div>
                )}
                <div className="pt-2 text-center">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{plan.name}</h3>
                  <p className="text-xs text-gray-500 mb-4 h-8 leading-tight">{plan.desc}</p>
                  <div className="mb-6">
                    <span className="text-4xl font-black text-gray-900">${plan.price}</span>
                    {plan.price > 0 && <span className="text-sm text-gray-500">/mo</span>}
                  </div>
                  <ul className="space-y-2 mb-6 text-xs text-left">
                    {plan.features.map((f: string) => (
                      <li key={f} className="flex items-start gap-2 text-gray-700">
                        <svg width="14" height="14" fill="none" stroke="#059669" strokeWidth="2" viewBox="0 0 24 24" className="mt-0.5 flex-shrink-0"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => router.push("/signup")}
                    className={`w-full h-11 rounded-xl text-sm font-bold transition-all ${plan.popular ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg" : "bg-gray-900 hover:bg-gray-800 text-white"}`}
                  >
                    {plan.price === 0 ? "Get Started Free" : `Choose ${plan.name}`}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative py-32 bg-gray-900 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-emerald-950 to-gray-900" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.15),transparent_70%)]" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-5xl lg:text-7xl font-black text-white mb-8 leading-tight">
            Stop Waiting.<br />
            <span className="text-emerald-400">Start Getting Paid.</span>
          </h2>
          <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            Join contractors who are getting paid in minutes, not months. Your first invoice is free.
          </p>
          <button
            onClick={() => router.push("/signup")}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-16 h-14 rounded-2xl text-xl font-black shadow-2xl transition-all hover:-translate-y-0.5"
          >
            CREATE FREE ACCOUNT →
          </button>
          <div className="flex flex-wrap justify-center gap-8 text-gray-400 font-semibold mt-10">
            {["Cancel Anytime", "No Credit Card Required", "Setup in 2 Minutes"].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <svg width="18" height="18" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white border-t border-gray-200 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                  <svg width="18" height="18" fill="white" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                </div>
                <span className="text-3xl font-black text-gray-900">AxisBill</span>
              </div>
              <p className="text-gray-600 max-w-sm">The invoicing app built for contractors who want to get paid faster.</p>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-4">Product</h4>
              <ul className="space-y-3 text-gray-600">
                <li><button onClick={() => document.getElementById('pricing-section')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-emerald-600 font-medium">Pricing</button></li>
                <li><button onClick={() => router.push("/features")} className="hover:text-emerald-600 font-medium">Features</button></li>
                <li><button onClick={() => document.getElementById('demo-section')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-emerald-600 font-medium">Book Demo</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-4">Support</h4>
              <ul className="space-y-3 text-gray-600">
                <li><button onClick={() => router.push("/contact")} className="hover:text-emerald-600 font-medium">Contact</button></li>
                <li><button onClick={() => router.push("/contact")} className="hover:text-emerald-600 font-medium">Help Center</button></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-200 flex justify-between items-center text-sm text-gray-500">
            <p>© 2025 AxisBill. All rights reserved.</p>
            <button onClick={() => router.push("/login")} className="hover:text-emerald-600 font-bold">Login</button>
          </div>
        </div>
      </footer>

    </div>
  );
}
