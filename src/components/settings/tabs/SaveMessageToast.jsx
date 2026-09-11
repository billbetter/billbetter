import React from "react";

/** The page's transient status message; red when it reports a failure. */
export default function SaveMessageToast({
  saveMessage,
}) {
  return <>
    {saveMessage && (
      <div
        className={`fixed bottom-24 lg:bottom-6 right-4 left-4 sm:left-auto sm:w-80 p-4 rounded-xl shadow-2xl text-content-inverted z-50 text-sm font-medium ${
          saveMessage.includes("Failed") ||
          saveMessage.includes("Error") ||
          saveMessage.includes("unknown")
            ? "bg-danger-500"
            : "bg-success-600"
        }`}
      >
        {saveMessage}
      </div>
    )}
    </>;
}
