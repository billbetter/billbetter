/**
 * The prompt that asks the model for an invoice's line items. `fileUrl` set
 * means a photo is attached, and the receipt-transcription rules apply.
 */
export const lineItemsPrompt = ({ country, currency, userSpecialty, jobDescription, fileUrl }) =>
  `You are a pricing expert for contracting services in ${country}. Based on this job description, suggest invoice line items with realistic market rates for ${country}.

Job: ${jobDescription || "(no written description - work from the attached photo)"}
Location: ${country}
Currency: ${currency}
Specialty: ${userSpecialty}

CRITICAL PRICING REQUIREMENTS:
- Use REALISTIC ${currency} market rates for ${country} (Canada rates are typically 15-25% higher than US)
- Research current 2025 market rates for the specialty: ${userSpecialty}
- Account for labor costs, materials, overhead, and profit margins typical in ${country}
- For labor: ${country === "Canada" ? "$60-$150/hr" : "$50-$120/hr"} depending on complexity
- For materials: Add 20-30% markup over wholesale cost

EXACT PRICE EXTRACTION - HIGHEST PRIORITY:
- If the user specifies a price for an item (e.g., "lock removal $50", "furnace repair for $200"), USE THAT EXACT PRICE as the rate
- Extract prices from patterns like: "$50", "for $200", "at $75", "costs $100"
- When a price is explicitly stated, DO NOT modify it based on market rates
- If no price is specified, then use realistic market rates
- If user mentions a total amount for the entire job, distribute it across line items proportionally

CRITICAL CALCULATION RULES:
- quantity × rate MUST equal the line item total
- For "10 hours @ $75/hr" → quantity=10, rate=75 (NOT rate=750)
- The "rate" field is the per-unit price, NOT the total
- Double-check your math: quantity × rate = correct total
- Example: 5 items @ $20 each → quantity=5, rate=20, total=100
- Example: "lock removal $50" → quantity=1, rate=50, total=50

${
  fileUrl
    ? `THE ATTACHED PHOTO OUTRANKS EVERY PRICING RULE ABOVE.

If it is a RECEIPT, supplier invoice or order confirmation, you are
TRANSCRIBING it, not estimating:
- Output exactly one line per item printed on it -- no more. Three items on the
  receipt means three lines out. The "2-4 line items" guidance below does NOT
  apply to a receipt.
- Never invent a line. No accessories, delivery, labour, cleanup or contingency
  unless the receipt itself prints one.
- ALWAYS use quantity=1, and put the line's printed money amount -- the one at
  the right-hand edge of that line -- in "rate". Do not split it into a unit
  price, and do not carry over a quantity like "2@" or "3@" from the receipt.
  Measured, splitting is where this goes wrong: a line reading "2@36.55" with
  73.10 at the edge came back as quantity=2 with rate=73.10 in three runs out
  of four, billing 146.20 for 73.10 of goods. Quantity 1 at the printed amount
  cannot make that mistake, and the contractor can split it afterwards.
- Skip SUBTOTAL, SALES TAX, TOTAL, DEBIT, card and auth lines. Not items.

If it shows a JOB SITE instead, price the work visible in it as normal.

`
    : ""
}FORMATTING REQUIREMENTS:
- Keep descriptions SHORT and CLEAR (e.g., "HVAC System Inspection" NOT "Inspection of heating and cooling system")
- Use professional service names without explanations
- Be direct and to the point
- Provide 2-4 line items
- Rates should reflect ${currency} pricing

Provide line items in this format.`;
