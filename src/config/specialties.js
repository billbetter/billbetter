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

/**
 * The trade specialties service presets are grouped by.
 *
 * `id` is the `sector` stored on each service preset, so these ids are data,
 * not labels -- renaming one orphans every preset saved under it. The name,
 * icon and colour are what the service autofill shows beside a suggestion.
 *
 * Not the same list as TRADES in ./trades.js: that one is marketing copy for
 * the homepage and demo form, and has no ids or presets behind it.
 */
export const SPECIALTIES = [
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
