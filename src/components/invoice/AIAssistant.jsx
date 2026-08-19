import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, Mic } from "lucide-react";
import ServiceAutofill from "./ServiceAutofill";

export default function AIAssistant({
  onSuggest,
  onServiceSelect,
  loading,
  userSpecialty = "general",
}) {
  const [jobDescription, setJobDescription] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState(null);

  // Initialize speech recognition
  React.useEffect(() => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = "en-US";

      recognitionInstance.onresult = (event) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setJobDescription(transcript);
      };

      recognitionInstance.onend = () => {
        setIsRecording(false);
      };

      recognitionInstance.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);
      };

      setRecognition(recognitionInstance);

      return () => {
        if (recognitionInstance) {
          recognitionInstance.stop();
        }
      };
    }
  }, []);

  const toggleRecording = () => {
    if (!recognition) {
      alert("Speech recognition is not supported in your browser");
      return;
    }

    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
    } else {
      setJobDescription(""); // Clear previous text when starting new recording
      recognition.start();
      setIsRecording(true);
    }
  };

  const handleSubmit = () => {
    if (jobDescription.trim()) {
      onSuggest(jobDescription);
      setJobDescription("");
    }
  };

  return (
    <Card className="border-none shadow-lg bg-success-50 dark:bg-surface-inverted">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-success-600 dark:bg-success-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-content-inverted" />
            </div>
            <h3 className="text-lg font-semibold text-content dark:text-content-inverted">
              AI Assistant
            </h3>
          </div>
          <Button
            type="button"
            variant={isRecording ? "destructive" : "outline"}
            size="sm"
            onClick={toggleRecording}
            className={`gap-2 ${isRecording ? "animate-pulse" : "border-success-300 dark:border-success-700 hover:border-success-400 dark:hover:border-success-600 dark:bg-ink-800 dark:text-ink-200"}`}
          >
            <Mic className="w-4 h-4" />
            {isRecording ? "Stop" : "Voice"}
          </Button>
        </div>
        <p className="text-sm text-content-body dark:text-content-subtle mb-4">
          {isRecording
            ? "Listening... Speak now to describe your work"
            : 'Describe the work and specify exact prices (e.g., "lock removal $50"). AI will use your exact prices or suggest market rates if not specified.'}
        </p>
        <div className="mb-3">
          <ServiceAutofill
            value={jobDescription}
            onChange={setJobDescription}
            onServiceSelect={(lineItem, service) => {
              // Add service directly without AI generation
              if (onServiceSelect) {
                onServiceSelect(lineItem);
              }
              setJobDescription("");
            }}
            userSpecialty={userSpecialty}
            placeholder="e.g., Replaced furnace filter and fixed duct in living room"
          />
        </div>
        <Button
          onClick={handleSubmit}
          disabled={loading || !jobDescription.trim()}
          className="w-full bg-brand hover:bg-brand-hover dark:bg-success-700 dark:hover:bg-success-600"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Invoice Items
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
