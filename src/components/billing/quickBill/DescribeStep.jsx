import React from "react";
import { Camera, Sparkles, Upload, X } from "lucide-react";
import { VISION_ACCEPT } from "@/lib/ai/schemas";

/** Step 1: a photo of the work, a sentence about it, or both. */
export default function DescribeStep({
  aiError,
  description,
  handleClearPhoto,
  handlePhotoSelect,
  photoPreview,
  setDescription,
}) {
  return (
    <div className="w-full flex-shrink-0 overflow-y-auto px-5 pb-6">
      <div className="flex items-center gap-2 mt-2">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-success-600 dark:text-success-400">
          <Sparkles className="w-3 h-3" />
          AI Builder
        </span>
      </div>
      <h1 className="text-3xl font-bold text-content dark:text-content-inverted tracking-tight mt-1">
        Describe the work
      </h1>
      <p className="text-content-muted dark:text-content-subtle mt-1.5 text-base">
        Snap a photo, write a sentence, or both. AI does the rest.
      </p>

      {/* Photo block */}
      <div className="mt-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-content-subtle mb-2">
          Photo
        </p>
        {photoPreview ? (
          <div className="relative rounded-2xl overflow-hidden bg-ink-100 dark:bg-surface-inverted border border-line dark:border-ink-800">
            <img
              src={photoPreview}
              alt="Job"
              className="w-full h-56 object-cover"
            />
            <button
              onClick={handleClearPhoto}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm text-content-inverted flex items-center justify-center active:scale-95 transition"
              aria-label="Remove photo"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <label className="cursor-pointer">
              <input
                type="file"
                accept={VISION_ACCEPT}
                capture="environment"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              <div className="h-28 rounded-2xl border-2 border-dashed border-line-strong dark:border-ink-700 bg-surface dark:bg-surface-inverted flex flex-col items-center justify-center gap-1.5 active:scale-[0.98] hover:border-success-400 dark:hover:border-success-600 hover:bg-success-50/40 dark:hover:bg-success-900/10 transition">
                <Camera className="w-6 h-6 text-success-600 dark:text-success-400" />
                <span className="text-xs font-semibold text-ink-700 dark:text-ink-300">
                  Take photo
                </span>
              </div>
            </label>
            <label className="cursor-pointer">
              <input
                type="file"
                accept={VISION_ACCEPT}
                onChange={handlePhotoSelect}
                className="hidden"
              />
              <div className="h-28 rounded-2xl border-2 border-dashed border-line-strong dark:border-ink-700 bg-surface dark:bg-surface-inverted flex flex-col items-center justify-center gap-1.5 active:scale-[0.98] hover:border-success-400 dark:hover:border-success-600 hover:bg-success-50/40 dark:hover:bg-success-900/10 transition">
                <Upload className="w-6 h-6 text-success-600 dark:text-success-400" />
                <span className="text-xs font-semibold text-ink-700 dark:text-ink-300">
                  Upload
                </span>
              </div>
            </label>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="mt-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-content-subtle mb-2">
          Description
        </p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder='e.g. "Replaced 12 ft of rotted deck boards with pressure-treated lumber, 3 hours labor"'
          rows={4}
          className="w-full resize-none px-4 py-3 rounded-2xl bg-surface dark:bg-surface-inverted border border-line dark:border-ink-800 text-base text-content dark:text-content-inverted placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-success-500/30 focus:border-success-500 transition"
        />
        <p className="mt-2 text-xs text-content-subtle dark:text-content-muted">
          The more detail (hours, materials, totals), the more accurate.
        </p>
      </div>

      {aiError && (
        <div className="mt-4 px-4 py-3 rounded-xl bg-danger-50 dark:bg-danger-900/20 border border-danger-100 dark:border-danger-900/40">
          <p className="text-sm text-danger-600 dark:text-danger-400">
            {aiError}
          </p>
        </div>
      )}
    </div>
  );
}
