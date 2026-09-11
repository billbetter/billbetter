import React from "react";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, Play, RefreshCw, Shield, Sparkles, Users } from "lucide-react";
import SimCard from "@/components/onboarding/tour/SimCard";
import StepRow from "@/components/onboarding/tour/StepRow";
import { createPageUrl } from "@/utils";

/** The mocked-up screen a slide is describing -- an invoice being built,
 * a quote going out, the calendar. Nothing here is real data. */
export default function TourSimulation({
  handleTryItNow,
  navigate,
  onClose,
  slide,
}) {
  return <>
    {slide.simulation && (
      <div className="mb-4 rounded-xl border border-ink-700 bg-ink-800 p-4">
        {slide.simulation.type === "invoice_form" && (
          <div className="space-y-2">
            {slide.simulation.steps.map((step, idx) => (
              <StepRow
                key={idx}
                icon={step.icon}
                label={step.label}
              />
            ))}
            <Button
              onClick={() => handleTryItNow("invoice")}
              className="w-full mt-2 bg-brand hover:bg-brand-hover text-content-inverted gap-2"
            >
              <Play className="w-3.5 h-3.5" /> Try Interactive Demo
            </Button>
          </div>
        )}

        {slide.simulation.type === "ai_demo" && (
          <div className="space-y-3">
            <SimCard>
              <p className="text-xs font-bold text-content-muted uppercase tracking-wider mb-1.5">
                You say:
              </p>
              <p className="text-sm text-ink-100 italic">
                "{slide.simulation.example.input}"
              </p>
            </SimCard>
            <div className="flex justify-center">
              <Sparkles className="w-5 h-5 text-success-400" />
            </div>
            <SimCard>
              <p className="text-xs font-bold text-content-muted uppercase tracking-wider mb-2">
                AI creates:
              </p>
              <div className="space-y-1.5">
                {slide.simulation.example.output.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-sm py-1 border-b border-ink-700 last:border-0"
                  >
                    <span className="text-ink-300">
                      {item.description}
                    </span>
                    <span className="font-semibold text-content-inverted">
                      ${item.amount}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm font-bold pt-2 border-t border-ink-600 mt-1">
                  <span className="text-content-inverted">Total</span>
                  <span className="text-success-400 text-base">
                    ${slide.simulation.example.total}
                  </span>
                </div>
              </div>
            </SimCard>
          </div>
        )}

        {slide.simulation.type === "payment_flow" && (
          <div className="flex items-center gap-2.5 p-3 bg-success-900/30 border border-success-700 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-success-400 flex-shrink-0" />
            <p className="text-sm font-medium text-success-300">
              {slide.simulation.result}
            </p>
          </div>
        )}

        {slide.simulation.type === "recurring_schedule" && (
          <SimCard>
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw className="w-4 h-4 text-brand-400" />
              <span className="text-sm font-semibold text-content-inverted">
                {slide.simulation.example.service}
              </span>
            </div>
            {[
              {
                label: "Client",
                value: slide.simulation.example.client,
              },
              {
                label: "Amount",
                value: `$${slide.simulation.example.amount}/mo`,
              },
              {
                label: "Next Invoice",
                value: slide.simulation.example.nextInvoice,
              },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex justify-between text-sm py-1.5 border-b border-ink-700 last:border-0"
              >
                <span className="text-content-subtle">{label}</span>
                <span className="font-semibold text-content-inverted">
                  {value}
                </span>
              </div>
            ))}
          </SimCard>
        )}

        {slide.simulation.type === "quote_camera" && (
          <div className="space-y-2">
            {slide.simulation.steps.map((step, idx) => (
              <StepRow
                key={idx}
                icon={step.icon}
                label={step.label}
                iconBg="bg-warning-800"
                iconColor="text-warning-300"
              />
            ))}
            <Button
              onClick={() => handleTryItNow("quote")}
              className="w-full mt-2 bg-warning-500 hover:bg-warning-600 text-content gap-2"
            >
              <Play className="w-3.5 h-3.5" /> Try Interactive Demo
            </Button>
          </div>
        )}

        {slide.simulation.type === "client_card" && (
          <SimCard>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-aqua-800 flex items-center justify-center">
                <Users className="w-4 h-4 text-aqua-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-content-inverted">
                  {slide.simulation.example.name}
                </p>
                <p className="text-xs text-content-subtle">
                  {slide.simulation.example.email}
                </p>
              </div>
            </div>
            {[
              {
                label: "Phone",
                value: slide.simulation.example.phone,
              },
              {
                label: "Total Invoiced",
                value: slide.simulation.example.totalInvoiced,
              },
              {
                label: "Last Invoice",
                value: slide.simulation.example.lastInvoice,
              },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex justify-between text-sm py-1.5 border-b border-ink-700 last:border-0"
              >
                <span className="text-content-subtle">{label}</span>
                <span className="font-semibold text-content-inverted">
                  {value}
                </span>
              </div>
            ))}
          </SimCard>
        )}

        {slide.simulation.type === "crew_roles" && (
          <div className="space-y-2">
            {slide.simulation.example.map((role, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 bg-ink-700 rounded-lg border border-ink-600"
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-brand-400" />
                  <span className="text-sm font-semibold text-content-inverted">
                    {role.role}
                  </span>
                </div>
                <span className="text-xs text-content-subtle">
                  {role.permissions}
                </span>
              </div>
            ))}
          </div>
        )}

        {slide.simulation.type === "analytics_chart" && (
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                label: "Monthly Revenue",
                value: slide.simulation.data.monthlyRevenue,
                color: "text-success-400",
              },
              {
                label: "Avg Invoice",
                value: slide.simulation.data.avgInvoice,
                color: "text-info-400",
              },
              {
                label: "Top Client",
                value: slide.simulation.data.topClient,
                color: "text-content-inverted",
              },
              {
                label: "Growth",
                value: `↗ ${slide.simulation.data.trend}`,
                color: "text-blush-400",
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="p-3 bg-ink-700 rounded-lg border border-ink-600"
              >
                <p className="text-xs text-content-subtle mb-1">
                  {label}
                </p>
                <p
                  className={`text-sm font-bold leading-tight ${color}`}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>
        )}

        {slide.simulation.type === "google_calendar_connect" && (
          <div className="space-y-2">
            {slide.simulation.steps.map((step, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-2.5 bg-ink-700 rounded-lg border border-ink-600"
              >
                <div className="w-5 h-5 rounded-full bg-positive-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-positive-300">
                    {idx + 1}
                  </span>
                </div>
                <span className="text-sm text-ink-200">{step}</span>
              </div>
            ))}
            <Button
              onClick={() => {
                onClose();
                navigate(createPageUrl("Settings") + "?tab=calendar");
              }}
              className="w-full mt-1 bg-positive-700 hover:bg-positive-700 text-content-inverted gap-2"
            >
              <Calendar className="w-3.5 h-3.5" /> Go to Calendar
              Settings
            </Button>
          </div>
        )}
      </div>
    )}
    </>;
}
