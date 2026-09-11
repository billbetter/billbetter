import React from "react";
import { Badge } from "@/components/ui/badge";
import { Receipt, Zap } from "lucide-react";

/** The contractor's most-used saved services, as quick starting points. */
export default function FrequentServicesCard({
  recentServices,
}) {
  return (
    <div className="hidden lg:block">
      <div className="bg-surface dark:bg-ink-800 rounded-2xl border border-line dark:border-ink-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-line-subtle dark:border-ink-700 bg-surface-sunken/50 dark:bg-ink-800/50 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-info-50 dark:bg-info-900/30 flex items-center justify-center">
            <Zap className="w-4 h-4 text-brand-700 dark:text-brand-400" />
          </div>
          <h3 className="font-black text-content dark:text-content-inverted">
            Frequent Services
          </h3>
        </div>
        <div className="p-6">
          {recentServices.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {recentServices.slice(0, 3).map((service) => (
                <div
                  key={service.id}
                  className="flex flex-col justify-between py-3 px-4 rounded-xl bg-surface-sunken dark:bg-surface-inverted/50 border border-line-subtle dark:border-ink-700 hover:border-line dark:hover:border-ink-600 transition-colors"
                >
                  <div className="flex-1 min-w-0 mb-2">
                    <p className="font-bold text-sm text-content dark:text-content-inverted truncate">
                      {service.name}
                    </p>
                    <p className="text-xs text-content-muted dark:text-content-subtle font-medium">
                      ${service.default_rate.toFixed(2)}/{service.unit}
                    </p>
                  </div>
                  <Badge className="bg-surface dark:bg-ink-800 text-ink-700 dark:text-ink-300 border border-line dark:border-ink-700 text-xs font-bold px-2.5 py-1 w-fit">
                    {service.use_count || 0} uses
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-14 h-14 rounded-full bg-ink-100 dark:bg-ink-800 flex items-center justify-center mb-3 border border-line dark:border-ink-700">
                <Receipt className="w-6 h-6 text-content-subtle dark:text-content-muted" />
              </div>
              <p className="text-sm font-bold text-content dark:text-content-inverted mb-1">
                No services yet
              </p>
              <p className="text-xs text-content-muted dark:text-content-subtle">
                Create invoices to build your library
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
