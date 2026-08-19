import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";

export default function VoiceInput({ onTranscript, onClose }) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef(null);
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = (event) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPart = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptPart + " ";
          } else {
            interimTranscript += transcriptPart;
          }
        }

        setTranscript((prev) => {
          const updated = prev + finalTranscript;
          return (updated + interimTranscript).trim();
        });
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startRecording = () => {
    if (recognitionRef.current && !isRecording) {
      hasProcessedRef.current = false;
      recognitionRef.current.start();
      setIsRecording(true);
      setTranscript("");
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSubmit = () => {
    if (transcript.trim() && !hasProcessedRef.current) {
      hasProcessedRef.current = true;
      onTranscript(transcript.trim());
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Voice Input</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center py-8">
            {isRecording ? (
              <button
                onClick={stopRecording}
                className="w-24 h-24 rounded-full bg-danger-500 hover:bg-danger-600 flex items-center justify-center transition-all animate-pulse shadow-lg"
              >
                <Square className="w-10 h-10 text-content-inverted" />
              </button>
            ) : (
              <button
                onClick={startRecording}
                className="w-24 h-24 rounded-full bg-brand hover:bg-brand-hover flex items-center justify-center transition-all shadow-lg hover:scale-105"
              >
                <Mic className="w-10 h-10 text-content-inverted" />
              </button>
            )}
            <p className="mt-4 text-sm text-content-body dark:text-ink-300">
              {isRecording
                ? "Listening... Click to stop"
                : "Click to start recording"}
            </p>
          </div>

          {transcript && (
            <div className="p-4 bg-surface-sunken rounded-lg dark:bg-ink-800">
              <p className="text-sm font-medium text-ink-700 mb-2 dark:text-ink-300">
                Transcript:
              </p>
              <p className="text-content dark:text-content-inverted">
                {transcript}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!transcript.trim() || hasProcessedRef.current}
              className="flex-1 bg-brand hover:bg-brand-hover"
            >
              Use This Description
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
