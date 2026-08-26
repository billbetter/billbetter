/**
 * The app's public base URL, in one place.
 *
 * -- Why this is a module and not a const in each function -----------------
 *
 * scripts/deploy-functions.py does not bundle with a module system. It
 * CONCATENATES each _shared file into the entry file's top-level scope and
 * strips the import lines, deduplicating by filename. So two files that each
 * declare `const APP_URL` become two `const APP_URL` declarations in one scope,
 * which is a SyntaxError, and the function fails to start.
 *
 * That is exactly what happened when send-invoice-email and send-invoice-sms
 * started importing stripe-session.ts: all three declared APP_URL, both send
 * functions 503'd with BOOT_ERROR, and the deploy script printed "OK" for both
 * because the UPLOAD succeeded. Nothing in the pipeline distinguishes a
 * function that deployed from one that runs -- which is why
 * scripts/test-function-boots.py now exists and is the thing that caught it.
 *
 * Declaring a shared value once, in a file the deduplicator knows about, makes
 * the collision impossible rather than merely absent today.
 */
export const APP_URL = Deno.env.get('APP_BASE_URL') || 'https://www.invoicium.ca';
