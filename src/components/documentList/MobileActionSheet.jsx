import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

/**
 * The phone layout's actions sheet for one row of a document list: a dimmed
 * backdrop, a panel that springs up from the bottom, a grab handle, and a
 * header naming the document. `children` are the actions.
 *
 * `open` is whatever the page tracks the open row by (its id) -- truthy while
 * the sheet is up. AnimatePresence stays in here, directly around the
 * conditional, so the slide-down still plays when it closes.
 */
export default function MobileActionSheet({ open, onClose, title, subtitle, children }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface dark:bg-ink-800 rounded-t-3xl z-50 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
          >
            <div className="w-full flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-12 h-1.5 bg-ink-300 dark:bg-ink-600 rounded-full"></div>
            </div>

            <div className="px-6 py-4 border-b border-line-subtle dark:border-ink-700 flex items-center justify-between bg-surface-sunken/50 dark:bg-ink-800/50 flex-shrink-0">
              <div>
                <h3 className="font-black text-content dark:text-content-inverted text-lg">
                  {title}
                </h3>
                <p className="text-sm text-content-muted dark:text-content-subtle font-medium">
                  {subtitle}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-ink-100 dark:bg-ink-700 flex items-center justify-center hover:bg-ink-200 dark:hover:bg-ink-600 active:scale-95 transition-all"
              >
                <X className="w-5 h-5 text-content-body dark:text-content-subtle" />
              </button>
            </div>

            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
