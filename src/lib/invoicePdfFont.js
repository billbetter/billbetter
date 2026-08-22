// Registers the Inter family with @react-pdf/renderer, once.
//
// All three invoice templates need it. Font.register keys by family name, so
// three modules each registering "Inter" would just overwrite each other -- and
// they had drifted apart (one omitted the italic face, which the Complex
// template's notes style asks for). Importing this module is the single path.
//
// Static TTFs live in public/fonts, so these resolve against the app origin at
// runtime. This is browser-side rendering; see src/lib/invoicePdf.js.

import { Font } from "@react-pdf/renderer";

let registered = false;

export function registerInvoiceFont() {
  if (registered) return;
  registered = true;

  Font.register({
    family: "Inter",
    fonts: [
      { src: "/fonts/Inter-Regular.ttf", fontWeight: "normal" },
      { src: "/fonts/Inter-Bold.ttf", fontWeight: "bold" },
      { src: "/fonts/Inter-Italic.ttf", fontWeight: "normal", fontStyle: "italic" },
    ],
  });

  // No hyphenation dictionary is loaded for Inter, and the default hyphenator
  // splits long line-item descriptions mid-word. Keep words intact instead.
  Font.registerHyphenationCallback((word) => [word]);
}

registerInvoiceFont();

export default registerInvoiceFont;
