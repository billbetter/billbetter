import React from "react";
import { ChevronRight, Download, ExternalLink, FileText, Loader2, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import MobileActionSheet from "@/components/documentList/MobileActionSheet";
import { createPageUrl } from "@/utils";

/** The phone layout's per-quote actions (view, PDF, edit, delete). */
export default function QuoteActionSheet({
  filteredQuotes,
  handleEdit,
  mobileMenuOpen,
  setDeleteDialog,
  setMobileMenuOpen,
}) {
  return (
    <MobileActionSheet
      open={mobileMenuOpen}
      onClose={() => setMobileMenuOpen(false)}
      title="Quote Actions"
      subtitle={filteredQuotes.find((q) => q.id === mobileMenuOpen) ?.quote_number}
    >

      <div className="flex-1 overflow-y-auto p-4 space-y-1 pb-24">
        <Link
          to={
            createPageUrl("QuoteDetail") + `?id=${mobileMenuOpen}`
          }
          className="block w-full"
          onClick={() => setMobileMenuOpen(false)}
        >
          <button className="w-full flex items-center gap-4 px-4 py-4 text-base font-semibold text-ink-700 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-700 rounded-2xl transition-all active:scale-[0.98]">
            <div className="w-10 h-10 rounded-xl bg-ink-100 dark:bg-ink-700 flex items-center justify-center flex-shrink-0">
              <ExternalLink className="w-5 h-5 text-content-body dark:text-content-subtle" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="font-bold">View Details</p>
              <p className="text-xs text-content-muted dark:text-content-subtle font-medium mt-0.5 truncate">
                See full quote information
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-content-subtle dark:text-content-muted flex-shrink-0" />
          </button>
        </Link>

        {filteredQuotes.find((q) => q.id === mobileMenuOpen)
          ?.pdf_url ? (
          <a
            href={
              filteredQuotes.find((q) => q.id === mobileMenuOpen)
                ?.pdf_url
            }
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full"
          >
            <button className="w-full flex items-center gap-4 px-4 py-4 text-base font-semibold text-ink-700 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-700 rounded-2xl transition-all active:scale-[0.98]">
              <div className="w-10 h-10 rounded-xl bg-ink-100 dark:bg-ink-700 flex items-center justify-center flex-shrink-0">
                <Download className="w-5 h-5 text-content-body dark:text-content-subtle" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="font-bold">Download PDF</p>
                <p className="text-xs text-content-muted dark:text-content-subtle font-medium mt-0.5 truncate">
                  Save quote to device
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-content-subtle dark:text-content-muted flex-shrink-0" />
            </button>
          </a>
        ) : (
          <button
            disabled
            className="w-full flex items-center gap-4 px-4 py-4 text-base font-semibold text-content-subtle dark:text-content-body rounded-2xl opacity-50 cursor-not-allowed dark:dark:text-ink-300"
          >
            <div className="w-10 h-10 rounded-xl bg-ink-100 dark:bg-ink-700 flex items-center justify-center flex-shrink-0">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="font-bold">Generating PDF...</p>
            </div>
          </button>
        )}

        <button
          className="w-full flex items-center gap-4 px-4 py-4 text-base font-semibold text-ink-700 dark:text-ink-300 hover:bg-info-50 dark:hover:bg-info-900/20 hover:text-info-700 dark:hover:text-info-400 rounded-2xl transition-all active:scale-[0.98]"
          onClick={() => {
            handleEdit(mobileMenuOpen);
            setMobileMenuOpen(false);
          }}
        >
          <div className="w-10 h-10 rounded-xl bg-info-100 dark:bg-info-900/30 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-brand-700 dark:text-brand-400" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="font-bold">Edit Quote</p>
            <p className="text-xs text-content-muted dark:text-content-subtle font-medium mt-0.5 truncate">
              Modify quote details
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-content-subtle dark:text-content-muted flex-shrink-0" />
        </button>

        <button
          className="w-full flex items-center gap-4 px-4 py-4 text-base font-semibold text-danger-700 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-2xl transition-all active:scale-[0.98]"
          onClick={() => {
            setDeleteDialog({
              open: true,
              quote: filteredQuotes.find(
                (q) => q.id === mobileMenuOpen,
              ),
            });
            setMobileMenuOpen(false);
          }}
        >
          <div className="w-10 h-10 rounded-xl bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5 text-danger-600 dark:text-danger-400" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="font-bold">Delete Quote</p>
            <p className="text-xs text-content-muted dark:text-content-subtle font-medium mt-0.5 truncate">
              Remove permanently
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-content-subtle dark:text-content-muted flex-shrink-0" />
        </button>
      </div>
    </MobileActionSheet>
  );
}
