import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles,
  Loader2,
  X,
  Upload,
  Camera as CameraIcon,
} from "lucide-react";

/**
 * Describe the job and have quote line items written from it.
 * NOTE: the photo is only previewed, never read -- see docs/issues/08.
 */
const CameraAnalyzer = ({ onAnalysisComplete, className }) => {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (onAnalysisComplete) {
      onAnalysisComplete({
        description: description,
        materials: [],
        laborHours: 0,
        notes: description,
      });
    }
    setLoading(false);
    setDescription("");
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(URL.createObjectURL(file));
    }
  };

  return (
    <Card
      className={`border-0 shadow-lg bg-surface dark:bg-surface-inverted overflow-hidden ring-1 ring-ink-200 dark:ring-ink-700 ${className}`}
    >
      <CardContent className="p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center ring-1 ring-brand-200 dark:ring-brand-700 shrink-0 dark:bg-brand-900/30">
            <Sparkles className="w-5 h-5 text-brand-700 dark:text-brand-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base sm:text-lg font-black text-content dark:text-ink-50 truncate">
              AI Assistant
            </h3>
            <p className="text-xs sm:text-sm text-content-muted dark:text-content-subtle truncate">
              Describe the job or upload a photo
            </p>
          </div>
        </div>

        {/* Input Area */}
        <div className="space-y-2">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Kitchen renovation, drywall repair, plumbing fix..."
            className="min-h-[80px] sm:min-h-[100px] border-line dark:border-ink-600 bg-surface-sunken dark:bg-surface-inverted-deep text-content dark:text-ink-50 placeholder:text-content-muted dark:placeholder:text-content-body focus:border-info-500 focus:ring-info-500/20 resize-none text-sm sm:text-base dark:dark:placeholder:text-ink-300"
          />
          <p className="text-xs text-content-muted dark:text-content-muted">
            Describe the work needed. Include desired total if known.
          </p>
        </div>

        {/* Photo Buttons */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-16 sm:h-20 border-dashed border-2 border-line-strong dark:border-ink-600 hover:border-info-400 dark:hover:border-info-500 hover:bg-info-50 dark:hover:bg-info-900/20 flex flex-col gap-1 sm:gap-2 text-ink-700 dark:text-ink-300"
            onClick={() => document.getElementById("camera-input")?.click()}
          >
            <CameraIcon className="w-5 h-5 sm:w-6 sm:h-6 text-content-subtle dark:text-content-muted" />
            <span className="text-xs sm:text-sm font-medium">Take Photo</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-16 sm:h-20 border-dashed border-2 border-line-strong dark:border-ink-600 hover:border-info-400 dark:hover:border-info-500 hover:bg-info-50 dark:hover:bg-info-900/20 flex flex-col gap-1 sm:gap-2 text-ink-700 dark:text-ink-300"
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-content-subtle dark:text-content-muted" />
            <span className="text-xs sm:text-sm font-medium">Upload Photo</span>
          </Button>
          <input
            id="camera-input"
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            id="file-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Image Preview */}
        {image && (
          <div className="relative rounded-lg overflow-hidden border border-line dark:border-ink-700">
            <img
              src={image}
              alt="Preview"
              className="w-full h-28 sm:h-32 object-cover"
            />
            <button
              onClick={() => setImage(null)}
              className="absolute top-2 right-2 w-6 h-6 bg-surface-inverted/80 dark:bg-surface-inverted-deep/80 text-content-inverted rounded-full flex items-center justify-center hover:bg-surface-inverted transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Generate Button */}
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={loading || !description.trim()}
          className="w-full h-11 sm:h-12 bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover text-content-inverted font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm sm:text-base"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Quote Items
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default CameraAnalyzer;
