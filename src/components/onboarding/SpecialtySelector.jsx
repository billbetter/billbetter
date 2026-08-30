import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Wind,
  Droplets,
  Zap,
  Paintbrush,
  Hammer,
  Home,
  DoorOpen,
  Sparkles,
  Trees,
  Wrench,
} from "lucide-react";

const SPECIALTIES = [
  {
    id: "general",
    name: "General / Handyman",
    icon: Wrench,
    color: "bg-ink-600 text-ink-100",
    description: "Jack of all trades",
  },
  {
    id: "hvac",
    name: "HVAC",
    icon: Wind,
    color: "bg-info-700 text-info-100",
    description: "Heating & cooling systems",
  },
  {
    id: "plumbing",
    name: "Plumbing",
    icon: Droplets,
    color: "bg-aqua-700 text-aqua-100",
    description: "Pipes, drains & fixtures",
  },
  {
    id: "electrical",
    name: "Electrical",
    icon: Zap,
    color: "bg-caution-600 text-caution-100",
    description: "Wiring & electrical systems",
  },
  {
    id: "drywall_painting",
    name: "Drywall / Painting",
    icon: Paintbrush,
    color: "bg-brand text-brand-100",
    description: "Walls, ceilings & paint",
  },
  {
    id: "flooring",
    name: "Flooring",
    icon: Hammer,
    color: "bg-warning-700 text-warning-100",
    description: "Floor installation & repair",
  },
  {
    id: "roofing",
    name: "Roofing / Exterior",
    icon: Home,
    color: "bg-danger-700 text-danger-100",
    description: "Roofs, gutters & siding",
  },
  {
    id: "windows_doors",
    name: "Windows / Doors",
    icon: DoorOpen,
    color: "bg-brand text-brand-100",
    description: "Windows & door service",
  },
  {
    id: "cleaning",
    name: "Cleaning",
    icon: Sparkles,
    color: "bg-magenta-700 text-magenta-100",
    description: "Professional cleaning",
  },
  {
    id: "landscaping",
    name: "Landscaping / Snow",
    icon: Trees,
    color: "bg-positive-700 text-positive-100",
    description: "Outdoor & seasonal work",
  },
];

export default function SpecialtySelector({ onSelect, onSkip }) {
  const [selectedSpecialty, setSelectedSpecialty] = useState(null);

  const handleConfirm = () => {
    if (selectedSpecialty) onSelect(selectedSpecialty);
  };

  return (
    <div className="w-full">
      <p className="text-sm text-content-muted dark:text-content-subtle text-center mb-4">
        Select your primary trade to get tailored invoice templates and autofill
        suggestions.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {SPECIALTIES.map((specialty) => {
          const Icon = specialty.icon;
          const isSelected = selectedSpecialty === specialty.id;
          return (
            <button
              key={specialty.id}
              onClick={() => setSelectedSpecialty(specialty.id)}
              className={`p-3 rounded-xl border-2 transition-all text-left ${
                isSelected
                  ? "border-success-500 bg-success-900/30 shadow-lg scale-[1.02]"
                  : "border-line-strong dark:border-ink-600 bg-surface dark:bg-ink-800 hover:border-ink-400 dark:hover:border-ink-500 hover:bg-surface-sunken dark:hover:bg-ink-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-9 h-9 rounded-lg ${specialty.color} flex items-center justify-center flex-shrink-0`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p
                    className={`font-semibold text-xs truncate ${isSelected ? "text-success-400" : "text-content dark:text-content-inverted"}`}
                  >
                    {specialty.name}
                  </p>
                  <p className="text-[10px] text-content-muted dark:text-content-subtle line-clamp-1">
                    {specialty.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {onSkip && onSelect && (
        <div className="flex gap-2 pt-4">
          <Button
            variant="outline"
            onClick={onSkip}
            className="flex-1 border-line-strong dark:border-ink-600 text-ink-700 dark:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-700"
          >
            Skip for Now
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedSpecialty}
            className="flex-1 bg-brand hover:bg-brand-hover text-content-inverted text-sm"
          >
            {selectedSpecialty
              ? `Continue with ${SPECIALTIES.find((s) => s.id === selectedSpecialty)?.name.split(" ")[0]}`
              : "Confirm"}
          </Button>
        </div>
      )}
    </div>
  );
}

export { SPECIALTIES };
