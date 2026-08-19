import React, { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertTriangle,
  Info,
} from "lucide-react";

export default function PriceResultsTable({ results, country }) {
  const [expandedRows, setExpandedRows] = useState([]);

  const toggleRow = (index) => {
    setExpandedRows((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  const getStoreLogo = (storeName) => {
    const logos = {
      "Home Depot": "🏠",
      "Home Depot Canada": "🏠",
      "Canadian Tire": "🚗",
      "Home Hardware": "🔨",
      RONA: "🔩",
      "Lowe's": "🏗️",
      "Lowe's Canada": "🏗️",
      Walmart: "🛒",
      "Walmart Canada": "🛒",
      Amazon: "📦",
      "Amazon.ca": "📦",
    };

    for (const [key, logo] of Object.entries(logos)) {
      if (storeName.toLowerCase().includes(key.toLowerCase())) {
        return logo;
      }
    }
    return "🏪";
  };

  const getConfidenceBadge = (confidence) => {
    const configs = {
      verified: {
        icon: CheckCircle,
        color: "bg-positive-100 text-positive-800 border-positive-300",
        text: "✓ Verified",
      },
      high: {
        icon: CheckCircle,
        color: "bg-info-100 text-info-800 border-info-300",
        text: "High Confidence",
      },
      medium: {
        icon: Info,
        color: "bg-caution-100 text-caution-800 border-caution-300",
        text: "Medium Confidence",
      },
      low: {
        icon: AlertTriangle,
        color: "bg-danger-100 text-danger-800 border-danger-300",
        text: "⚠ Low Confidence",
      },
    };

    const config = configs[confidence] || configs["low"];
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} border gap-1 text-xs`}>
        <Icon className="w-3 h-3" />
        {config.text}
      </Badge>
    );
  };

  const getQualityIndicator = (qualityScore) => {
    if (qualityScore >= 3)
      return {
        color: "text-positive-600",
        text: "Excellent Match",
        icon: "🎯",
      };
    if (qualityScore === 2)
      return { color: "text-info-600", text: "Good Match", icon: "✓" };
    if (qualityScore === 1)
      return { color: "text-caution-600", text: "Fair Match", icon: "⚠" };
    return {
      color: "text-danger-600",
      text: "Verify Before Purchase",
      icon: "⚠️",
    };
  };

  const currency = country === "Canada" ? "CAD" : "USD";

  return (
    <div className="space-y-4">
      {results.map((item, index) => {
        const quality = getQualityIndicator(item.quality_score || 0);

        return (
          <div key={index} className="border rounded-lg overflow-hidden">
            {/* Main Result */}
            <div className="bg-success-50 p-4 dark:bg-success-900/20">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-content text-lg mb-1 dark:text-content-inverted">
                    {item.material}
                  </h3>
                  <p className="text-sm text-ink-700 mb-2 dark:text-ink-300">
                    {item.best_price.product_name}
                  </p>
                  {item.best_price.sku && (
                    <p className="text-xs text-content-muted mb-2">
                      SKU: {item.best_price.sku}
                    </p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-2xl">
                      {getStoreLogo(item.best_price.store)}
                    </span>
                    <Badge className="bg-success-700 text-content-inverted border-success-700">
                      Best Price
                    </Badge>
                    <span className="font-semibold text-content dark:text-content-inverted">
                      {item.best_price.store}
                    </span>
                    {getConfidenceBadge(item.best_price.confidence)}
                    <Badge
                      variant="outline"
                      className={`gap-1 ${quality.color}`}
                    >
                      {quality.icon} {quality.text}
                    </Badge>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className="text-3xl font-bold text-success-600 mb-1">
                    ${item.best_price.price.toFixed(2)}
                  </div>
                  <div className="text-sm text-content-body mb-2 dark:text-ink-300">
                    {currency}
                  </div>
                  {item.best_price.availability && (
                    <Badge variant="outline" className="text-xs">
                      {item.best_price.availability}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Notes/Warnings */}
              {item.best_price.notes && (
                <div className="mb-3 p-2 bg-info-50 border border-info-200 rounded text-sm text-info-800 dark:bg-info-900/20 dark:border-info-800/50 dark:text-info-300">
                  <Info className="w-4 h-4 inline mr-1" />
                  {item.best_price.notes}
                </div>
              )}

              {/* Price Range */}
              {item.price_range && (
                <div className="mb-3 p-2 bg-surface rounded border text-sm dark:bg-surface-inverted">
                  <span className="font-medium text-ink-700 dark:text-ink-300">
                    Market Range:{" "}
                  </span>
                  ${item.price_range.lowest?.toFixed(2)} - $
                  {item.price_range.highest?.toFixed(2)}
                  <span className="text-content-muted ml-2">
                    (Avg: ${item.price_range.average?.toFixed(2)})
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <Button
                  asChild
                  size="sm"
                  className="bg-aqua-600 hover:bg-aqua-700"
                  disabled={!item.best_price.url || item.best_price.url === ""}
                >
                  <a
                    href={item.best_price.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Product
                  </a>
                </Button>

                {item.alternatives && item.alternatives.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleRow(index)}
                    className="gap-2"
                  >
                    {expandedRows.includes(index) ? (
                      <>
                        Hide Alternatives <ChevronUp className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        Show {item.alternatives.length} Alternatives{" "}
                        <ChevronDown className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Alternatives */}
            {expandedRows.includes(index) && item.alternatives && (
              <div className="bg-surface-sunken p-4 space-y-3 dark:bg-ink-800">
                <h4 className="font-medium text-content text-sm mb-3 dark:text-content-inverted">
                  Alternative Options:
                </h4>
                {item.alternatives.map((alt, altIndex) => (
                  <div
                    key={altIndex}
                    className="flex items-center justify-between p-3 bg-surface rounded-lg border dark:bg-surface-inverted"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-2xl">
                        {getStoreLogo(alt.store)}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium text-content dark:text-content-inverted">
                          {alt.store}
                        </div>
                        <div className="text-sm text-content-body dark:text-ink-300">
                          {alt.product_name}
                        </div>
                        {alt.sku && (
                          <div className="text-xs text-content-muted">
                            SKU: {alt.sku}
                          </div>
                        )}
                        {alt.notes && (
                          <div className="text-xs text-info-600 mt-1">
                            {alt.notes}
                          </div>
                        )}
                        <div className="flex gap-2 mt-1">
                          {alt.availability && (
                            <Badge variant="outline" className="text-xs">
                              {alt.availability}
                            </Badge>
                          )}
                          {alt.confidence && getConfidenceBadge(alt.confidence)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xl font-bold text-content dark:text-content-inverted">
                          ${alt.price.toFixed(2)}
                        </div>
                        <div className="text-xs text-content-muted">
                          {currency}
                        </div>
                      </div>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        disabled={!alt.url || alt.url === ""}
                      >
                        <a
                          href={alt.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
