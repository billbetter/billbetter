import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";

const COPIED_MS = 2000;

/**
 * Put text on the clipboard. The Clipboard API first; where it is missing or
 * refused (an older WebView, a page without focus), a hidden textarea and
 * execCommand, which still works in those places.
 */
export async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      el.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * A Copy button that answers for itself: for two seconds after a copy it reads
 * "Copied" with a check mark, in place of a separate "Link copied" pop-up.
 * Takes every Button prop (variant, size, className, disabled...).
 *
 * @param {{ text: string, children?: import("react").ReactNode,
 *   copiedLabel?: string, showIcon?: boolean }
 *   & import("react").ComponentProps<typeof Button>} props
 */
export function CopyButton({
  text,
  children = "Copy",
  copiedLabel = "Copied",
  showIcon = true,
  onClick,
  ...props
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const handleClick = async (event) => {
    onClick?.(event);
    if (!text) return;
    if (await writeClipboard(text)) {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_MS);
    } else {
      notify.error("Couldn't copy that", "Select the link and copy it by hand.");
    }
  };

  return (
    <Button type="button" {...props} onClick={handleClick}>
      {copied ? (
        <Check className="h-4 w-4 text-success-600 dark:text-success-400" aria-hidden="true" />
      ) : showIcon ? (
        <Copy className="h-4 w-4" aria-hidden="true" />
      ) : null}
      {copied ? copiedLabel : children}
      {/* Announced to screen readers, which do not see the label swap. */}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </Button>
  );
}

export default CopyButton;
