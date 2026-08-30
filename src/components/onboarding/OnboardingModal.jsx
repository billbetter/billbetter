import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { sdk } from "@/api/sdk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Building2,
  MapPin,
  DollarSign,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  FileText,
  Users,
  Calendar,
  BarChart3,
  Rocket,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import FeatureTour from "./FeatureTour";

const TOTAL_STEPS = 5;

export default function OnboardingModal({ isOpen, onClose, user, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showFeatureTour, setShowFeatureTour] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState(null);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [formData, setFormData] = useState({
    business_name: "",
    email: "",
    phone: "",
    address: "",
    hourly_rate: "",
    tax_rate: "",
  });

  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        email: user.email || "",
        phone: user.phone || "",
        business_name: user.full_name ? `${user.full_name}'s Business` : "",
      }));
    }
  }, [user]);

  const steps = [
    {
      id: "welcome",
      title: "Welcome to Invoicium! 🎉",
      subtitle: "Let's get your business set up in just a few minutes",
      icon: Sparkles,
      content: (
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-success-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Sparkles className="w-8 h-8 text-content-inverted" />
          </div>
          <h3 className="text-xl font-bold text-content dark:text-content-inverted mb-2">
            Hi {user?.full_name?.split(" ")[0] || "there"}!
          </h3>
          <p className="text-content-body dark:text-ink-300 mb-5 text-sm leading-relaxed">
            Let's get your business set up in just a few steps so you can start
            creating professional invoices and getting paid faster.
          </p>
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { icon: FileText, label: "Invoices" },
              { icon: Users, label: "Clients" },
              { icon: Calendar, label: "Scheduling" },
              { icon: BarChart3, label: "Analytics" },
            ].map((item, i) => (
              <div
                key={i}
                className="flex flex-col items-center p-3 bg-ink-100 dark:bg-ink-700 rounded-xl border border-line dark:border-ink-600"
              >
                <item.icon className="w-5 h-5 text-success-500 mb-1.5" />
                <span className="text-xs text-ink-700 dark:text-ink-200 font-medium">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 p-4 bg-ink-100 dark:bg-ink-700 rounded-xl border border-line dark:border-ink-600 text-left">
            <Checkbox
              id="tos-accept"
              checked={tosAccepted}
              onCheckedChange={setTosAccepted}
              className="flex-shrink-0"
            />
            <label
              htmlFor="tos-accept"
              className="text-sm text-ink-700 dark:text-ink-200 cursor-pointer leading-snug"
            >
              I agree to the{" "}
              <Link
                to={createPageUrl("TermsOfService")}
                target="_blank"
                className="text-success-500 hover:text-success-400 underline font-medium"
              >
                Terms of Service
              </Link>
            </label>
          </div>
        </div>
      ),
    },
    {
      id: "business",
      title: "Your Business Info",
      subtitle: "This will appear on your invoices and quotes",
      icon: Building2,
      content: (
        <div className="space-y-4 py-4">
          {[
            {
              label: "Business Name *",
              key: "business_name",
              placeholder: "e.g., Smith Plumbing Services",
              type: "text",
            },
            {
              label: "Business Email",
              key: "email",
              placeholder: "your@business.com",
              type: "email",
            },
            {
              label: "Phone Number *",
              key: "phone",
              placeholder: "+1 (555) 123-4567",
              type: "text",
            },
          ].map(({ label, key, placeholder, type }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-ink-700 dark:text-ink-200 mb-1">
                {label}
              </label>
              <Input
                type={type}
                placeholder={placeholder}
                value={formData[key]}
                onChange={(e) =>
                  setFormData({ ...formData, [key]: e.target.value })
                }
                className="h-12 bg-surface dark:bg-ink-700 border-line-strong dark:border-ink-600 text-content dark:text-content-inverted placeholder-ink-500 dark:placeholder-ink-500"
              />
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "address",
      title: "Business Address",
      subtitle: "Where your business is located",
      icon: MapPin,
      content: (
        <div className="space-y-4 py-4">
          <div>
            <label className="block text-sm font-medium text-ink-700 dark:text-ink-200 mb-1">
              Street Address
            </label>
            <Input
              placeholder="123 Main Street, Suite 100"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              className="h-12 bg-surface dark:bg-ink-700 border-line-strong dark:border-ink-600 text-content dark:text-content-inverted placeholder-ink-500 dark:placeholder-ink-500"
            />
            <p className="text-xs text-content-muted dark:text-content-subtle mt-1">
              Include city, state/province, and postal code
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "rates",
      title: "Default Rates",
      subtitle: "Set your standard pricing (you can change these anytime)",
      icon: DollarSign,
      content: (
        <div className="space-y-4 py-4">
          {[
            {
              label: "Hourly Rate ($)",
              key: "hourly_rate",
              placeholder: "75",
              hint: "Your standard hourly labor rate",
            },
            {
              label: "Default Tax Rate (%)",
              key: "tax_rate",
              placeholder: "13",
              hint: "Applied automatically to new invoices",
            },
          ].map(({ label, key, placeholder, hint }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-ink-700 dark:text-ink-200 mb-1">
                {label}
              </label>
              <Input
                type="number"
                placeholder={placeholder}
                value={formData[key]}
                onChange={(e) =>
                  setFormData({ ...formData, [key]: e.target.value })
                }
                className="h-12 bg-surface dark:bg-ink-700 border-line-strong dark:border-ink-600 text-content dark:text-content-inverted placeholder-ink-500 dark:placeholder-ink-500"
              />
              <p className="text-xs text-content-muted dark:text-content-subtle mt-1">
                {hint}
              </p>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "complete",
      title: "You're All Set! 🚀",
      subtitle: "Your business profile is ready",
      icon: Rocket,
      content: (
        <div className="text-center py-6">
          <div className="w-20 h-20 bg-success-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <CheckCircle2 className="w-10 h-10 text-content-inverted" />
          </div>
          <h3 className="text-xl font-bold text-content dark:text-content-inverted mb-3">
            Welcome aboard!
          </h3>
          <p className="text-content-body dark:text-ink-300 mb-6 max-w-md mx-auto">
            Your business profile has been saved. Would you like a quick tour of
            all features?
          </p>
          <div className="space-y-3 max-w-sm mx-auto">
            <button
              onClick={() => setShowFeatureTour(true)}
              className="w-full flex items-center gap-3 p-4 bg-success-900/30 border-2 border-success-600 rounded-xl hover:border-success-400 hover:bg-success-900/50 transition-colors text-left"
            >
              <div className="w-10 h-10 bg-success-700 rounded-lg flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-success-100" />
              </div>
              <div className="flex-1">
                <span className="font-medium text-content dark:text-content-inverted">
                  Take the Feature Tour
                </span>
                <p className="text-xs text-content-muted dark:text-content-subtle">
                  Learn all features in 5 minutes
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-success-400" />
            </button>
            <p className="text-xs text-content-muted dark:text-content-subtle">
              Or skip and explore on your own
            </p>
          </div>
        </div>
      ),
    },
  ];

  const handleNext = async () => {
    if (currentStep === TOTAL_STEPS - 1) {
      await saveSettings();
      onComplete();
      onClose();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const existingSettings = await sdk.entities.BusinessSettings.filter({
        user_id: user.id,
      });
      const settingsData = {
        user_id: user.id,
        business_name: formData.business_name || `${user.full_name}'s Business`,
        email: formData.email || user.email,
        phone: formData.phone || "",
        address: formData.address || "",
        hourly_rate: parseFloat(formData.hourly_rate) || 0,
        tax_rate: parseFloat(formData.tax_rate) || 0,
      };
      if (formData.phone) await sdk.auth.updateMe({ phone: formData.phone });
      if (existingSettings.length > 0) {
        await sdk.entities.BusinessSettings.update(
          existingSettings[0].id,
          settingsData,
        );
      } else {
        await sdk.entities.BusinessSettings.create(settingsData);
      }
      if (selectedSpecialty) {
        const existingSpecialty = await sdk.entities.UserSpecialty.filter({
          user_id: user.id,
        });
        if (existingSpecialty.length > 0) {
          await sdk.entities.UserSpecialty.update(existingSpecialty[0].id, {
            primary_specialty: selectedSpecialty,
            onboarding_completed: true,
          });
        } else {
          await sdk.entities.UserSpecialty.create({
            user_id: user.id,
            primary_specialty: selectedSpecialty,
            onboarding_completed: true,
          });
        }
      }
      await sdk.auth.updateMe({ onboarding_completed: true });
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const currentStepData = steps[currentStep];
  const StepIcon = currentStepData.icon;

  return (
    <>
      <FeatureTour
        isOpen={showFeatureTour}
        onClose={() => {
          setShowFeatureTour(false);
          onComplete();
          onClose();
        }}
        onComplete={() => {
          onComplete();
          onClose();
        }}
      />
      <Dialog open={isOpen && !showFeatureTour} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg p-0 bg-surface dark:bg-surface-inverted border border-line dark:border-ink-700 max-h-[90vh] flex flex-col overflow-hidden">
          {/* Progress Bar */}
          <div className="h-1 bg-ink-200 dark:bg-ink-700">
            <div
              className="h-full bg-success-500 transition-all duration-300"
              style={{ width: `${((currentStep + 1) / TOTAL_STEPS) * 100}%` }}
            />
          </div>

          <div className="flex flex-col flex-1 min-h-0">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-success-100 dark:bg-success-900/50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <StepIcon className="w-5 h-5 text-success-600 dark:text-success-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-content dark:text-content-inverted">
                    {currentStepData.title}
                  </h2>
                  <p className="text-sm text-content-muted dark:text-content-subtle">
                    {currentStepData.subtitle}
                  </p>
                </div>
              </div>
            </div>

            {/* Step Content - scrollable */}
            <div className="flex-1 overflow-y-auto px-6">
              {currentStepData.content}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-line dark:border-ink-700 flex-shrink-0">
              <div>
                {currentStep > 0 && currentStep < TOTAL_STEPS - 1 && (
                  <Button
                    variant="ghost"
                    onClick={handleBack}
                    className="gap-1 text-ink-700 dark:text-ink-300 hover:text-content dark:hover:text-content-inverted hover:bg-ink-100 dark:hover:bg-ink-800"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1 mr-4">
                  {steps.map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        i === currentStep
                          ? "bg-success-500"
                          : i < currentStep
                            ? "bg-success-400"
                            : "bg-ink-300 dark:bg-ink-600"
                      }`}
                    />
                  ))}
                </div>
                <Button
                  onClick={handleNext}
                  disabled={
                    loading ||
                    (currentStep === 0 && !tosAccepted) ||
                    (currentStep === 1 &&
                      (!formData.business_name || !formData.phone))
                  }
                  className="bg-brand hover:bg-brand-hover text-content-inverted gap-1"
                >
                  {loading ? (
                    "Saving..."
                  ) : currentStep === TOTAL_STEPS - 1 ? (
                    "Go to Dashboard"
                  ) : currentStep === 0 ? (
                    <>
                      Let's Go <ChevronRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Continue <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
