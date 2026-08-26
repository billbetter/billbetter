import React, { useState, useEffect, useRef } from "react";
import { InvokeLLM } from "@/integrations/Core";
import { VOICE_COMMAND } from "@/lib/ai/schemas";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, MicOff, Sparkles, Loader2, Volume2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function GlobalVoiceAssistant({ onCommand }) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [showPanel, setShowPanel] = useState(false);

  const recognitionRef = useRef(null);
  const speechSynthRef = useRef(null);
  const isProcessingRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = (event) => {
        if (isProcessingRef.current) return;

        const finalTranscript = event.results[0][0].transcript;
        setTranscript(finalTranscript);
        setIsListening(false);
        isProcessingRef.current = true;
        processCommand(finalTranscript);
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        isProcessingRef.current = false;
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    speechSynthRef.current = window.speechSynthesis;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (speechSynthRef.current) {
        speechSynthRef.current.cancel();
      }
    };
  }, []);

  const startListening = () => {
    if (recognitionRef.current && !isListening && !isProcessing) {
      setShowPanel(true);
      setTranscript("");
      setAiResponse("");
      isProcessingRef.current = false;
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const speak = (text) => {
    if (speechSynthRef.current) {
      speechSynthRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;

      utterance.onstart = () => setIsResponding(true);
      utterance.onend = () => {
        setIsResponding(false);
        isProcessingRef.current = false;
      };

      speechSynthRef.current.speak(utterance);
    }
  };

  const processCommand = async (command) => {
    setIsProcessing(true);

    try {
      const response = await InvokeLLM({
        prompt: `You are a helpful AI assistant for an invoicing platform. The user said: "${command}"

Analyze this command and respond in this JSON format:
{
 "intent": "create_invoice" | "upload_receipt" | "view_dashboard" | "view_analytics" | "view_clients" | "view_invoices" | "view_pricing" | "help" | "unknown",
 "confirmation": "A friendly confirmation message to speak back to the user",
 "action": "The specific action to take",
 "data": {} // Any extracted data like client name, amounts, etc.
}

Current page: ${location.pathname}
Be conversational and helpful.`,
        response_json_schema: VOICE_COMMAND,
      });

      setAiResponse(response.confirmation);
      speak(response.confirmation);

      // Execute the action
      setTimeout(() => {
        executeAction(response.intent, response.data);
      }, 1000);
    } catch (error) {
      console.error("Error processing command:", error);
      // Was always "I had trouble understanding that", which blames the
      // speaker for what may be our missing API key. Say which it is.
      const errorMsg = error?.notConfigured
        ? "Voice commands aren't set up on this deployment yet."
        : error?.rateLimited
          ? "That's a lot of requests. Give me a minute and try again."
          : "I'm sorry, I had trouble understanding that. Could you try again?";
      setAiResponse(errorMsg);
      speak(errorMsg);
      isProcessingRef.current = false;
    }

    setIsProcessing(false);
  };

  const executeAction = (intent, data) => {
    switch (intent) {
      case "create_invoice":
        navigate(createPageUrl("CreateInvoice"));
        break;
      case "upload_receipt":
        navigate(createPageUrl("SmartPricing"));
        if (onCommand) onCommand("upload_receipt", data);
        break;
      case "view_dashboard":
        navigate(createPageUrl("Dashboard"));
        break;
      case "view_analytics":
        navigate(createPageUrl("Analytics"));
        break;
      case "view_clients":
        navigate(createPageUrl("Clients"));
        break;
      case "view_invoices":
        navigate(createPageUrl("Invoices"));
        break;
      case "view_pricing":
        navigate(createPageUrl("SmartPricing"));
        break;
      default:
        break;
    }
  };

  const closePanel = () => {
    stopListening();
    setShowPanel(false);
    setTranscript("");
    setAiResponse("");
    if (speechSynthRef.current) {
      speechSynthRef.current.cancel();
    }
  };

  return (
    <>
      {/* Voice Panel */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-44 right-6 z-50 w-80 lg:bottom-24"
          >
            <Card className="border-none shadow-2xl bg-surface dark:bg-surface-inverted">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        isResponding
                          ? "bg-brand-600 animate-pulse"
                          : isProcessing
                            ? "bg-caution-500 animate-pulse"
                            : isListening
                              ? "bg-danger-500 animate-pulse"
                              : "bg-ink-300"
                      }`}
                    />
                    <span className="text-sm font-medium text-ink-700 dark:text-ink-300">
                      {isResponding
                        ? "Speaking..."
                        : isProcessing
                          ? "Thinking..."
                          : isListening
                            ? "Listening..."
                            : "Ready"}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={closePanel}
                    className="h-8 w-8"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {transcript && (
                  <div className="mb-4 p-3 bg-surface-sunken rounded-lg dark:bg-ink-800">
                    <p className="text-sm text-content-body mb-1 dark:text-ink-300">
                      You said:
                    </p>
                    <p className="text-content dark:text-content-inverted">
                      {transcript}
                    </p>
                  </div>
                )}

                {aiResponse && (
                  <div className="p-3 bg-success-50 rounded-lg dark:bg-success-900/20">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-success-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-content-body mb-1 dark:text-ink-300">
                          Assistant:
                        </p>
                        <p className="text-content dark:text-content-inverted">
                          {aiResponse}
                        </p>
                      </div>
                      {isResponding && (
                        <Volume2 className="w-4 h-4 text-success-600 animate-pulse ml-auto flex-shrink-0" />
                      )}
                    </div>
                  </div>
                )}

                {!transcript && !aiResponse && isListening && (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse dark:bg-danger-900/30">
                      <Mic className="w-6 h-6 text-danger-600" />
                    </div>
                    <p className="text-content-body dark:text-ink-300">
                      Listening to your command...
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
