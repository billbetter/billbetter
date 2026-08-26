/**
 * What to tell the contractor when an AI draft could not be produced.
 *
 * Never a fallback draft. The function this replaced returned invented line
 * items to every caller and every caller believed them, which is how "AI
 * invoicing" shipped without an AI. An honest missing answer beats a plausible
 * wrong one, especially on a document that asks someone for money.
 *
 * @param {Error & {notConfigured?: boolean, rateLimited?: boolean}} error
 * @param {string} what  what the user was trying to draft, e.g. "line items"
 */
export function aiFailureMessage(error, what = "this") {
  if (error?.notConfigured) {
    return `AI drafting isn't set up on this deployment yet. Add ${what} manually for now.`;
  }
  if (error?.rateLimited) {
    return "That's a lot of AI requests in a short time. Wait a minute, then try again.";
  }
  return `The AI couldn't draft ${what}. Please write it manually.`;
}
