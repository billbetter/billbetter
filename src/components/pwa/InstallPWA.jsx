import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Download, Share, Plus } from "lucide-react";

export default function InstallPWA({ className = "" }) {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone
    ) {
      setIsInstalled(true);
      return;
    }

    // Detect platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iOS = /iphone|ipad|ipod/.test(userAgent);
    const android = /android/.test(userAgent);

    setIsIOS(iOS);
    setIsAndroid(android);

    // Listen for beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Listen for app installed event
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      // Show iOS instructions
      setShowIOSModal(true);
    } else if (installPrompt) {
      // Trigger native install prompt (Android/Chrome)
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;

      if (outcome === "accepted") {
        setIsInstalled(true);
      }
      setInstallPrompt(null);
    } else {
      // Fallback for browsers that don't support PWA install
      setShowIOSModal(true);
    }
  };

  // Don't show button if already installed
  if (isInstalled) {
    return null;
  }

  return (
    <>
      <Button
        onClick={handleInstallClick}
        className={`bg-brand hover:bg-brand-hover text-content-inverted shadow-lg hover:shadow-xl transition-all px-8 ${className}`}
        size="lg"
      >
        <Download className="w-5 h-5 mr-2" />
        <span className="font-semibold">Download App</span>
      </Button>

      {/* iOS Instructions Modal */}
      <Dialog open={showIOSModal} onOpenChange={setShowIOSModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-success-600" />
              Install Invoicium
            </DialogTitle>
            <DialogDescription className="text-left pt-4">
              To add Invoicium to your home screen:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 p-3 bg-success-50 rounded-lg dark:bg-success-900/20">
              <div className="w-8 h-8 rounded-full bg-success-700 text-content-inverted flex items-center justify-center flex-shrink-0 font-bold">
                1
              </div>
              <div>
                <p className="font-medium text-content mb-1 dark:text-content-inverted">
                  Tap the Share button
                </p>
                <div className="flex items-center gap-2 text-sm text-content-body dark:text-ink-300">
                  <Share className="w-4 h-4" />
                  <span>Look for the share icon in Safari</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-success-50 rounded-lg dark:bg-success-900/20">
              <div className="w-8 h-8 rounded-full bg-success-700 text-content-inverted flex items-center justify-center flex-shrink-0 font-bold">
                2
              </div>
              <div>
                <p className="font-medium text-content mb-1 dark:text-content-inverted">
                  Select "Add to Home Screen"
                </p>
                <div className="flex items-center gap-2 text-sm text-content-body dark:text-ink-300">
                  <Plus className="w-4 h-4" />
                  <span>Scroll down in the menu to find it</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-success-50 rounded-lg dark:bg-success-900/20">
              <div className="w-8 h-8 rounded-full bg-success-700 text-content-inverted flex items-center justify-center flex-shrink-0 font-bold">
                3
              </div>
              <div>
                <p className="font-medium text-content mb-1 dark:text-content-inverted">
                  Tap "Add"
                </p>
                <p className="text-sm text-content-body dark:text-ink-300">
                  Invoicium will appear on your home screen!
                </p>
              </div>
            </div>
          </div>

          <div className="bg-info-50 border border-info-200 rounded-lg p-3 text-sm text-info-900 dark:bg-info-900/20 dark:border-info-800/50 dark:text-info-300">
            <p className="font-medium mb-1">💡 Pro Tip</p>
            <p>
              Once installed, Invoicium will work like a native app with offline
              support!
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
