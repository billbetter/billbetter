import React, { useState, useEffect } from "react";
import { sdk } from "@/api/sdk";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { canAccessFeature } from "@/components/utils/permissions";
import { isFeatureDormant } from "@/config/dormantFeatures";
import { ALL_TOUR_SECTIONS } from "@/components/onboarding/tour/tourSections";
import TourProgressBar from "@/components/onboarding/tour/TourProgressBar";
import TourSidebar from "@/components/onboarding/tour/TourSidebar";
import TourSlideHeader from "@/components/onboarding/tour/TourSlideHeader";
import TourSlideContent from "@/components/onboarding/tour/TourSlideContent";
import TourSimulation from "@/components/onboarding/tour/TourSimulation";
import TourStripePanel from "@/components/onboarding/tour/TourStripePanel";
import TourTips from "@/components/onboarding/tour/TourTips";
import TourFooter from "@/components/onboarding/tour/TourFooter";
import TourDemoOverlay from "@/components/onboarding/tour/TourDemoOverlay";

export default function FeatureTour({ isOpen, onClose, onComplete }) {
  const [currentSection, setCurrentSection] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [showInteractiveDemo, setShowInteractiveDemo] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const [demoClient, setDemoClient] = useState("");
  const [demoItems, setDemoItems] = useState([
    { description: "", quantity: 1, rate: 0 },
  ]);
  const [demoAiInput, setDemoAiInput] = useState("");
  const [quotePhotoUploaded, setQuotePhotoUploaded] = useState(false);
  const [quoteSending, setQuoteSending] = useState(false);
  const [quoteSent, setQuoteSent] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        const user = await sdk.auth.me();
        const subscriptionData = await sdk.entities.Subscription.filter({
          user_id: user.id,
        });
        if (subscriptionData.length > 0) setSubscription(subscriptionData[0]);
        const settings = await sdk.entities.BusinessSettings.filter({
          user_id: user.id,
        });
        if (
          settings.length > 0 &&
          settings[0].stripe_account_status === "active"
        )
          setStripeConnected(true);
      } catch (error) {}
    };
    if (isOpen) loadData();
  }, [isOpen]);

  // Dormant sections are removed before either split. canAccessFeature already
  // refuses them, but that alone would only move them into LOCKED_SECTIONS --
  // where they would be advertised as "upgrade to unlock", which is the one
  // thing a switched-off feature must never do.
  const LIVE_TOUR_SECTIONS = ALL_TOUR_SECTIONS.filter(
    (s) => !isFeatureDormant(s.requiredFeature),
  );
  const TOUR_SECTIONS = LIVE_TOUR_SECTIONS.filter(
    (s) =>
      !s.requiredFeature || canAccessFeature(subscription, s.requiredFeature),
  );
  const LOCKED_SECTIONS = LIVE_TOUR_SECTIONS.filter(
    (s) =>
      s.requiredFeature && !canAccessFeature(subscription, s.requiredFeature),
  );

  const section = TOUR_SECTIONS[currentSection];
  const slide = section?.slides[currentSlide];
  const SectionIcon = section?.icon;

  if (!section || !slide) return null;

  const totalSlides = TOUR_SECTIONS.reduce(
    (acc, s) => acc + s.slides.length,
    0,
  );
  const currentTotalSlide =
    TOUR_SECTIONS.slice(0, currentSection).reduce(
      (acc, s) => acc + s.slides.length,
      0,
    ) +
    currentSlide +
    1;
  const isFirstSlide = currentSection === 0 && currentSlide === 0;
  const isLastSlide =
    currentSection === TOUR_SECTIONS.length - 1 &&
    currentSlide === section.slides.length - 1;
  const progress = (currentTotalSlide / totalSlides) * 100;

  const handleNext = () => {
    if (currentSlide < section.slides.length - 1)
      setCurrentSlide(currentSlide + 1);
    else if (currentSection < TOUR_SECTIONS.length - 1) {
      setCurrentSection(currentSection + 1);
      setCurrentSlide(0);
    } else handleComplete();
  };
  const handleBack = () => {
    if (currentSlide > 0) setCurrentSlide(currentSlide - 1);
    else if (currentSection > 0) {
      const prev = TOUR_SECTIONS[currentSection - 1];
      setCurrentSection(currentSection - 1);
      setCurrentSlide(prev.slides.length - 1);
    }
  };
  const handleSkip = async () => {
    try {
      await sdk.auth.updateMe({ feature_tour_completed: true });
    } catch (e) {}
    onClose();
  };
  const handleComplete = async () => {
    try {
      await sdk.auth.updateMe({ feature_tour_completed: true });
    } catch (e) {}
    onComplete?.();
    onClose();
  };
  const jumpToSection = (i) => {
    setCurrentSection(i);
    setCurrentSlide(0);
  };

  const handleTryItNow = () => {
    setShowInteractiveDemo(true);
    setDemoStep(0);
    setDemoClient("");
    setDemoItems([{ description: "", quantity: 1, rate: 0 }]);
    setDemoAiInput("");
    setQuotePhotoUploaded(false);
    setQuoteSending(false);
    setQuoteSent(false);
  };
  const handleDemoClose = () => {
    setShowInteractiveDemo(false);
    setDemoStep(0);
  };
  const handleDemoAiSubmit = () => {
    if (
      demoAiInput.toLowerCase().includes("2500") ||
      demoAiInput.toLowerCase().includes("2,500") ||
      demoAiInput.toLowerCase().includes("cabinet")
    ) {
      setDemoItems([
        { description: "Cabinet installation labor", quantity: 1, rate: 1200 },
        {
          description: "Hardware and mounting supplies",
          quantity: 1,
          rate: 800,
        },
        { description: "Finishing and cleanup", quantity: 1, rate: 500 },
      ]);
    } else if (demoAiInput.toLowerCase().includes("bathroom")) {
      setDemoItems([
        { description: "Bathroom renovation labor", quantity: 1, rate: 1500 },
        { description: "Materials and fixtures", quantity: 1, rate: 800 },
        { description: "Plumbing work", quantity: 1, rate: 600 },
      ]);
    } else {
      setDemoItems([
        { description: "Labor", quantity: 1, rate: 500 },
        { description: "Materials", quantity: 1, rate: 300 },
      ]);
    }
    setDemoStep(demoStep + 1);
  };
  const handleQuotePhotoUpload = () => {
    setQuotePhotoUploaded(true);
  };
  const handleQuoteSend = () => {
    setQuoteSending(true);
    setTimeout(() => {
      setQuoteSending(false);
      setQuoteSent(true);
    }, 2000);
  };
  const handleConnectStripe = async () => {
    setConnectingStripe(true);
    try {
      const response = await sdk.functions.invoke(
        "createStripeConnectAccount",
        { return_url: window.location.href, refresh_url: window.location.href },
      );
      if (response.data?.url) window.open(response.data.url, "_blank");
    } catch (error) {
      alert("Failed to connect Stripe. Please try again.");
    } finally {
      setConnectingStripe(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden max-h-[90vh] shadow-2xl bg-surface-inverted border border-ink-700">
        {/* The dialog's accessible name. The visible heading is in TourSlideHeader,
            styled to this screen's own design -- and DialogTitle brings
            its own size and weight classes, which would fight with it. So
            the same words go here instead, for screen readers: a
            DialogContent with no DialogTitle is announced as just
            "dialog", and Radix logs that on every open. */}
        <DialogTitle className="sr-only">{section.title}</DialogTitle>
        <DialogDescription className="sr-only">
          {section.subtitle}
        </DialogDescription>
        <TourProgressBar
          progress={progress}
        />

        <div className="flex flex-col sm:flex-row overflow-hidden">
          <TourSidebar
            LOCKED_SECTIONS={LOCKED_SECTIONS}
            TOUR_SECTIONS={TOUR_SECTIONS}
            currentSection={currentSection}
            jumpToSection={jumpToSection}
          />

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 max-h-[calc(90vh-60px)]">
              <TourSlideHeader
                SectionIcon={SectionIcon}
                handleSkip={handleSkip}
                section={section}
              />

              <TourSlideContent
                slide={slide}
              />

              <TourSimulation
                handleTryItNow={handleTryItNow}
                navigate={navigate}
                onClose={onClose}
                slide={slide}
              />

              <TourStripePanel
                connectingStripe={connectingStripe}
                handleConnectStripe={handleConnectStripe}
                slide={slide}
                stripeConnected={stripeConnected}
              />

              <TourTips
                slide={slide}
              />
            </div>

            <TourFooter
              currentTotalSlide={currentTotalSlide}
              handleBack={handleBack}
              handleNext={handleNext}
              handleSkip={handleSkip}
              isFirstSlide={isFirstSlide}
              isLastSlide={isLastSlide}
              totalSlides={totalSlides}
            />
          </div>
        </div>

        <TourDemoOverlay
          demoAiInput={demoAiInput}
          demoClient={demoClient}
          demoItems={demoItems}
          demoStep={demoStep}
          handleDemoAiSubmit={handleDemoAiSubmit}
          handleDemoClose={handleDemoClose}
          handleQuotePhotoUpload={handleQuotePhotoUpload}
          handleQuoteSend={handleQuoteSend}
          quotePhotoUploaded={quotePhotoUploaded}
          quoteSending={quoteSending}
          quoteSent={quoteSent}
          section={section}
          setDemoAiInput={setDemoAiInput}
          setDemoClient={setDemoClient}
          setDemoStep={setDemoStep}
          showInteractiveDemo={showInteractiveDemo}
        />
      </DialogContent>
    </Dialog>
  );
}
