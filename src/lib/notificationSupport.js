/**
 * Central notification environment detection utility.
 * Use this before ANY call to Notification, Notification.requestPermission(), or new Notification().
 *
 * Detection strategy:
 *  - isWebViewAndroid: checks for Android WebView UA strings that indicate a wrapped APK
 *  - isStandaloneMode: checks if PWA is installed (runs outside browser chrome)
 *  - isBrowserNotificationSupported: final gate — only true when the Notification API exists AND we are NOT in a WebView wrapper
 */

/**
 * Returns true if we are running inside an Android WebView (APK wrapper).
 * These environments do NOT expose the Notification browser API.
 */
export function isAndroidWebView() {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // Standard WebView indicators
  return (
    /wv/.test(ua) ||                        // Chrome WebView flag
    /Android.*Version\/[\d.]+.*Mobile/.test(ua) ||  // Stock Android browser / WebView
    /; wv\)/.test(ua)                       // Explicit wv marker
  );
}

/**
 * Returns true if running as an installed PWA (standalone mode).
 */
export function isInstalledPWA() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

/**
 * Returns true if the browser Notification API is genuinely available and usable.
 * This is the ONLY safe gate you should use before calling any Notification API.
 */
export function isBrowserNotificationSupported() {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) return false;
  if (isAndroidWebView()) return false;     // WebView exposes Notification on some versions but it silently fails
  return true;
}

/**
 * Returns the current browser notification permission, or 'unsupported' if not available.
 */
export function getNotificationPermission() {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Safe wrapper around Notification.requestPermission().
 * Returns 'unsupported' instead of throwing when not available.
 */
export async function requestNotificationPermission() {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'unsupported';
  }
}

/**
 * Safely fire a browser notification — only when supported and permission is granted.
 */
export function showBrowserNotification(title, options = {}) {
  if (!isBrowserNotificationSupported()) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, options);
  } catch {
    // silently swallow — some environments partially support the API
  }
}

/**
 * Returns a human-readable description of the current environment.
 * Useful for debugging and for showing the right UI message.
 *
 * @returns {'webview' | 'pwa' | 'mobile-browser' | 'desktop-browser'}
 */
export function getEnvironmentType() {
  if (typeof window === 'undefined') return 'desktop-browser';
  if (isAndroidWebView()) return 'webview';
  if (isInstalledPWA()) return 'pwa';
  const ua = navigator.userAgent || '';
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile-browser';
  return 'desktop-browser';
}