import React from "react";
import { Button } from "@/components/ui/button";
import { Camera, CheckCircle2, Play, Send, Sparkles, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** The interactive demo: a walk through building an invoice or sending a
 * quote, with nothing saved at the end of it. */
export default function TourDemoOverlay({
  demoAiInput,
  demoClient,
  demoItems,
  demoStep,
  handleDemoAiSubmit,
  handleDemoClose,
  handleQuotePhotoUpload,
  handleQuoteSend,
  quotePhotoUploaded,
  quoteSending,
  quoteSent,
  section,
  setDemoAiInput,
  setDemoClient,
  setDemoStep,
  showInteractiveDemo,
}) {
  return <>
    {showInteractiveDemo && (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <div className="bg-surface-inverted rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl border border-ink-700 flex flex-col">
          <div className="px-5 py-4 bg-success-700 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-surface/20 flex items-center justify-center dark:bg-surface-inverted/20">
                <Play className="w-4 h-4 text-content-inverted" />
              </div>
              <div>
                <h3 className="font-bold text-content-inverted text-sm">
                  Interactive Demo
                </h3>
                <p className="text-xs text-success-200">Try it yourself</p>
              </div>
            </div>
            <button
              onClick={handleDemoClose}
              className="text-content-inverted/70 hover:text-content-inverted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 bg-surface-inverted">
            {section.id === "invoices" && (
              <div className="space-y-4">
                {demoStep === 0 && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📝</div>
                      <h3 className="text-lg font-bold text-content-inverted">
                        Create Your First Invoice
                      </h3>
                      <p className="text-sm text-content-subtle mt-1">
                        Walk through each step together
                      </p>
                    </div>
                    <div className="p-4 rounded-xl border border-ink-700 bg-ink-800">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-full bg-info-600 flex items-center justify-center">
                          <span className="text-content-inverted text-xs font-bold">
                            1
                          </span>
                        </div>
                        <h4 className="font-semibold text-content-inverted text-sm">
                          Select a Client
                        </h4>
                      </div>
                      <Label className="text-xs font-semibold text-ink-300 mb-1.5 block">
                        Client *
                      </Label>
                      <select
                        value={demoClient}
                        onChange={(e) => {
                          setDemoClient(e.target.value);
                          if (e.target.value)
                            setTimeout(() => setDemoStep(1), 500);
                        }}
                        className="w-full p-2.5 rounded-lg border border-ink-600 bg-ink-700 text-sm text-content-inverted focus:outline-none focus:ring-2 focus:ring-success-500"
                      >
                        <option value="">Select a client...</option>
                        <option value="client1">
                          ABC Construction Co.
                        </option>
                        <option value="client2">
                          John's Property Management
                        </option>
                        <option value="client3">Smith Renovations</option>
                      </select>
                      {!demoClient && (
                        <p className="text-xs text-success-400 mt-1.5 font-medium">
                          ↑ Try selecting a client
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {demoStep === 1 && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-ink-700 bg-ink-800">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center">
                          <span className="text-content-inverted text-xs font-bold">
                            2
                          </span>
                        </div>
                        <h4 className="font-semibold text-content-inverted text-sm">
                          Use AI Assistant (Optional)
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-brand-400" />
                        <span className="text-sm font-medium text-ink-200">
                          Describe the work
                        </span>
                      </div>
                      <Input
                        value={demoAiInput}
                        onChange={(e) => setDemoAiInput(e.target.value)}
                        placeholder="e.g., I want $2,500 for kitchen cabinets"
                        className="mb-2 text-sm bg-ink-700 border-ink-600 text-content-inverted placeholder-ink-500"
                      />
                      <Button
                        onClick={handleDemoAiSubmit}
                        disabled={!demoAiInput}
                        className="w-full bg-brand-700 hover:bg-brand text-content-inverted gap-2 text-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Generate Items
                      </Button>
                      {!demoAiInput && (
                        <p className="text-xs text-brand-400 mt-1 font-medium">
                          ↑ Try typing a description
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setDemoStep(0)}
                        variant="outline"
                        className="flex-1 text-sm border-ink-600 text-ink-300 hover:bg-ink-800 hover:text-content-inverted"
                      >
                        Back
                      </Button>
                      <Button
                        onClick={() => setDemoStep(2)}
                        className="flex-1 bg-ink-600 hover:bg-ink-500 text-content-inverted text-sm"
                      >
                        Skip AI →
                      </Button>
                    </div>
                  </div>
                )}
                {demoStep === 2 && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-ink-700 bg-ink-800">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-full bg-success-600 flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 text-content-inverted" />
                        </div>
                        <h4 className="font-semibold text-content-inverted text-sm">
                          Review & Send
                        </h4>
                      </div>
                      <div className="space-y-1.5 mb-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-content-subtle">
                            Client:
                          </span>
                          <span className="font-semibold text-content-inverted">
                            ABC Construction Co.
                          </span>
                        </div>
                        {demoItems.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between text-sm border-t border-ink-700 pt-1.5"
                          >
                            <span className="text-ink-300 truncate flex-1">
                              {item.description || "Service"}
                            </span>
                            <span className="font-semibold text-content-inverted ml-2">
                              ${item.rate}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-bold pt-2 border-t border-ink-600">
                          <span className="text-content-inverted">
                            Total
                          </span>
                          <span className="text-success-400">
                            $
                            {demoItems
                              .reduce((s, i) => s + i.rate, 0)
                              .toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <Button className="w-full bg-brand hover:bg-brand-hover text-content-inverted gap-2 text-sm">
                        <Send className="w-3.5 h-3.5" /> Create & Send
                        Invoice
                      </Button>
                      <p className="text-xs text-center text-content-muted mt-2">
                        ✅ Sent via email & SMS to client
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setDemoStep(1)}
                        variant="outline"
                        className="flex-1 text-sm border-ink-600 text-ink-300 hover:bg-ink-800 hover:text-content-inverted"
                      >
                        Back
                      </Button>
                      <Button
                        onClick={handleDemoClose}
                        className="flex-1 bg-brand hover:bg-brand-hover text-content-inverted text-sm"
                      >
                        Finish Demo
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {section.id === "quotes" && (
              <div className="space-y-4">
                {demoStep === 0 && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📋</div>
                      <h3 className="text-lg font-bold text-content-inverted">
                        Create a Quote
                      </h3>
                      <p className="text-sm text-content-subtle mt-1">
                        AI camera analysis for instant estimates
                      </p>
                    </div>
                    <div className="p-4 rounded-xl border border-ink-700 bg-ink-800">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-full bg-warning-500 flex items-center justify-center">
                          <span className="text-content-inverted text-xs font-bold">
                            1
                          </span>
                        </div>
                        <h4 className="font-semibold text-content-inverted text-sm">
                          Upload Job Site Photo
                        </h4>
                      </div>
                      {!quotePhotoUploaded ? (
                        <button
                          onClick={handleQuotePhotoUpload}
                          className="w-full aspect-video rounded-lg border-2 border-dashed border-warning-600 bg-ink-700 flex items-center justify-center hover:bg-ink-600 transition-colors cursor-pointer"
                        >
                          <div className="text-center p-4">
                            <Camera className="w-10 h-10 text-warning-400 mx-auto mb-2" />
                            <p className="text-sm font-medium text-ink-200">
                              Click to Upload Photo
                            </p>
                            <p className="text-xs text-warning-400 mt-1">
                              Try the demo!
                            </p>
                          </div>
                        </button>
                      ) : (
                        <div className="relative">
                          <img
                            src="https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&q=80"
                            alt="Bathroom"
                            className="w-full aspect-video object-cover rounded-lg"
                          />
                          <div className="absolute top-2 right-2 bg-success-700 text-content-inverted text-xs px-2 py-1 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Ready
                          </div>
                        </div>
                      )}
                    </div>
                    {quotePhotoUploaded && (
                      <Button
                        onClick={() => setDemoStep(1)}
                        className="w-full bg-warning-500 hover:bg-warning-600 text-content gap-2 text-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Analyze with AI
                        →
                      </Button>
                    )}
                  </div>
                )}
                {demoStep === 1 && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <Sparkles className="w-10 h-10 text-brand-400 mx-auto mb-2" />
                      <h3 className="text-lg font-bold text-content-inverted">
                        AI Analyzing...
                      </h3>
                      <p className="text-sm text-content-subtle">
                        Computer vision detecting work scope
                      </p>
                    </div>
                    <div className="p-4 rounded-xl border border-ink-700 bg-ink-800 space-y-2">
                      {[
                        "🛁 Detecting bathroom fixtures...",
                        "🔧 Identifying work needed...",
                        "📦 Finding materials & prices...",
                        "⏱️ Estimating labor hours...",
                      ].map((step, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 bg-ink-700 rounded-lg border border-ink-600"
                        >
                          <span className="text-sm text-ink-200">
                            {step}
                          </span>
                          {idx < 3 ? (
                            <CheckCircle2 className="w-4 h-4 text-success-400" />
                          ) : (
                            <div className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                          )}
                        </div>
                      ))}
                    </div>
                    <Button
                      onClick={() => setDemoStep(2)}
                      className="w-full bg-brand-700 hover:bg-brand text-content-inverted gap-2 text-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> View Results
                      →
                    </Button>
                  </div>
                )}
                {demoStep === 2 && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-4xl mb-2">✨</div>
                      <h3 className="text-lg font-bold text-content-inverted">
                        Quote Generated!
                      </h3>
                    </div>
                    <div className="p-4 rounded-xl border border-ink-700 bg-ink-800">
                      <p className="text-sm font-bold text-content-inverted mb-3">
                        Bathroom Renovation
                      </p>
                      <div className="space-y-1.5">
                        {[
                          ["Porcelain tile (120 sq ft)", "$680"],
                          ["Vanity & sink combo", "$850"],
                          ["Toilet, fixtures & supplies", "$720"],
                          ["Labor (24hrs @ $75/hr)", "$1,800"],
                        ].map(([item, price]) => (
                          <div
                            key={item}
                            className="flex justify-between text-sm py-1.5 border-b border-ink-700 last:border-0"
                          >
                            <span className="text-ink-300">{item}</span>
                            <span className="font-semibold text-content-inverted">
                              {price}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-bold pt-2 border-t border-ink-600">
                          <span className="text-content-inverted">
                            Total
                          </span>
                          <span className="text-success-400 text-base">
                            $4,050
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setDemoStep(1)}
                        variant="outline"
                        className="flex-1 text-sm border-ink-600 text-ink-300 hover:bg-ink-800 hover:text-content-inverted"
                      >
                        Back
                      </Button>
                      <Button
                        onClick={() => setDemoStep(3)}
                        className="flex-1 bg-brand hover:bg-brand-hover text-content-inverted text-sm"
                      >
                        Send Quote →
                      </Button>
                    </div>
                  </div>
                )}
                {demoStep === 3 && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📧</div>
                      <h3 className="text-lg font-bold text-content-inverted">
                        Send to Client
                      </h3>
                    </div>
                    <div className="p-4 rounded-xl border border-ink-700 bg-ink-800 space-y-2">
                      {[
                        "📧 Email with PDF attachment",
                        "📱 SMS with approval link",
                        "✅ One-click approval button",
                        "📅 Google Calendar booking link",
                      ].map((item) => (
                        <div
                          key={item}
                          className="flex items-center gap-2 text-sm py-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-success-400 flex-shrink-0" />
                          <span className="text-ink-200">{item}</span>
                        </div>
                      ))}
                    </div>
                    {!quoteSending && !quoteSent && (
                      <Button
                        onClick={handleQuoteSend}
                        className="w-full bg-brand hover:bg-brand-hover text-content-inverted gap-2 text-sm"
                      >
                        <Send className="w-3.5 h-3.5" /> Send Quote to
                        Client
                      </Button>
                    )}
                    {quoteSending && (
                      <div className="flex items-center justify-center gap-2 p-3 rounded-lg border border-ink-700 bg-ink-800">
                        <div className="w-4 h-4 border-2 border-info-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-ink-200">
                          Sending...
                        </span>
                      </div>
                    )}
                    {quoteSent && (
                      <div className="flex items-center gap-2 p-3 rounded-lg border border-success-700 bg-success-900/30">
                        <CheckCircle2 className="w-4 h-4 text-success-400" />
                        <span className="text-sm font-medium text-success-300">
                          Quote sent successfully!
                        </span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setDemoStep(2)}
                        variant="outline"
                        className="flex-1 text-sm border-ink-600 text-ink-300 hover:bg-ink-800 hover:text-content-inverted"
                      >
                        Back
                      </Button>
                      <Button
                        onClick={handleDemoClose}
                        className="flex-1 bg-brand hover:bg-brand-hover text-content-inverted text-sm"
                      >
                        Finish
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>;
}
