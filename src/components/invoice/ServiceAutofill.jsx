import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { sdk } from "@/api/sdk";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Plus } from "lucide-react";
import { SPECIALTIES } from "../onboarding/SpecialtySelector";

const ServiceAutofill = React.memo(
  ({
    value,
    onChange,
    onServiceSelect,
    userSpecialty = "general",
    placeholder = "Type to search services... (e.g., 'HVAC', 'drain', 'outlet')",
  }) => {
    const [searchTerm, setSearchTerm] = useState(value || "");
    const [suggestions, setSuggestions] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
      setSearchTerm(value || "");
    }, [value]);

    useEffect(() => {
      const handleClickOutside = (event) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target)
        ) {
          setShowDropdown(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
      const fetchSuggestions = async () => {
        if (searchTerm.length < 2) {
          setSuggestions([]);
          setShowDropdown(false);
          return;
        }

        setLoading(true);
        try {
          // Fetch all presets and custom templates
          const [systemPresets, customTemplates] = await Promise.all([
            sdk.entities.ServicePreset.filter({ is_system: true }),
            sdk.entities.CustomServiceTemplate.list(),
          ]);

          // Combine and filter
          const searchLower = searchTerm.toLowerCase();

          const filteredSystem = systemPresets.filter(
            (preset) =>
              preset.name.toLowerCase().includes(searchLower) ||
              preset.description.toLowerCase().includes(searchLower) ||
              (preset.keywords &&
                preset.keywords.some((k) =>
                  k.toLowerCase().includes(searchLower),
                )),
          );

          const filteredCustom = customTemplates.filter(
            (template) =>
              template.name.toLowerCase().includes(searchLower) ||
              template.description.toLowerCase().includes(searchLower),
          );

          // Rank results
          const rankedSystem = filteredSystem.map((preset) => ({
            ...preset,
            isCustom: false,
            score: calculateScore(preset, searchTerm, userSpecialty),
          }));

          const rankedCustom = filteredCustom.map((template) => ({
            ...template,
            isCustom: true,
            score: calculateScore(template, searchTerm, userSpecialty) + 50, // Boost custom templates
          }));

          // Combine and sort by score
          const combined = [...rankedSystem, ...rankedCustom]
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

          setSuggestions(combined);
          setShowDropdown(combined.length > 0);
        } catch (error) {
          console.error("Error fetching suggestions:", error);
        } finally {
          setLoading(false);
        }
      };

      const debounce = setTimeout(fetchSuggestions, 300);
      return () => clearTimeout(debounce);
    }, [searchTerm, userSpecialty]);

    const calculateScore = (item, search, specialty) => {
      let score = 0;
      const searchLower = search.toLowerCase();
      const nameLower = item.name.toLowerCase();

      // Exact match bonus
      if (nameLower === searchLower) score += 100;

      // Starts with search term
      if (nameLower.startsWith(searchLower)) score += 50;

      // Contains search term
      if (nameLower.includes(searchLower)) score += 30;

      // Keyword match
      if (
        item.keywords &&
        item.keywords.some((k) => k.toLowerCase().includes(searchLower))
      ) {
        score += 20;
      }

      // Specialty boost
      if (item.sector === specialty) score += 40;

      // Popularity score
      score += (item.popularity_score || 0) * 0.3;

      // Custom template usage boost
      if (item.use_count) score += item.use_count * 2;

      return score;
    };

    const handleSelectService = useCallback(
      (service) => {
        const lineItem = {
          description: service.name,
          quantity: service.default_quantity || 1,
          rate: service.default_rate || 0,
          amount: (service.default_quantity || 1) * (service.default_rate || 0),
          unit: service.unit || "each",
          is_taxable:
            service.is_taxable !== undefined ? service.is_taxable : true,
        };

        onServiceSelect(lineItem, service);
        setSearchTerm("");
        setSuggestions([]);
        setShowDropdown(false);

        // Increment use count for custom templates
        if (service.isCustom) {
          sdk.entities.CustomServiceTemplate.update(service.id, {
            use_count: (service.use_count || 0) + 1,
          }).catch(console.error);
        }
      },
      [onServiceSelect],
    );

    const handleInputChange = useCallback(
      (e) => {
        const newValue = e.target.value;
        setSearchTerm(newValue);
        onChange(newValue);
      },
      [onChange],
    );

    const getSectorBadgeColor = useCallback((sector) => {
      const specialty = SPECIALTIES.find((s) => s.id === sector);
      return specialty ? specialty.color : "bg-ink-100 text-ink-700";
    }, []);

    return (
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <Input
            value={searchTerm}
            onChange={handleInputChange}
            onFocus={() =>
              searchTerm.length >= 2 &&
              suggestions.length > 0 &&
              setShowDropdown(true)
            }
            placeholder={placeholder}
            className="pr-10"
          />
          <Search className="absolute right-3 top-3 w-4 h-4 text-content-subtle" />
        </div>

        {showDropdown && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-surface border border-line rounded-lg shadow-lg max-h-96 overflow-y-auto dark:bg-surface-inverted dark:border-ink-700">
            <div className="p-2 border-b border-line-subtle bg-surface-sunken dark:border-ink-800 dark:bg-ink-800">
              <p className="text-xs text-content-body dark:text-ink-300">
                {suggestions.length} services found • Sorted by relevance
              </p>
            </div>

            {suggestions.map((service, index) => (
              <button
                key={`${service.isCustom ? "custom" : "preset"}-${service.id}`}
                onClick={() => handleSelectService(service)}
                className="w-full text-left px-4 py-3 hover:bg-success-50 border-b border-line-subtle last:border-b-0 transition-colors dark:border-ink-800 dark:hover:bg-success-900/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-content truncate dark:text-content-inverted">
                        {service.name}
                      </p>
                      {service.isCustom && (
                        <Badge className="bg-brand-100 text-brand-700 text-xs dark:bg-brand-900/30 dark:text-brand-400">
                          My Template
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-content-body line-clamp-2 dark:text-ink-300">
                      {service.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge
                        className={`text-xs ${getSectorBadgeColor(service.sector)}`}
                      >
                        {SPECIALTIES.find((s) => s.id === service.sector)
                          ?.name || service.sector}
                      </Badge>
                      <span className="text-xs text-content-muted">
                        {service.default_quantity} {service.unit} × $
                        {service.default_rate.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-success-600">
                      $
                      {(
                        (service.default_quantity || 1) * service.default_rate
                      ).toFixed(2)}
                    </p>
                    <Plus className="w-4 h-4 text-content-subtle ml-auto mt-1" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },
);

export default ServiceAutofill;
