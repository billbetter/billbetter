const DEFAULT_RETURN_PATH = "/Dashboard";

export function getSameOriginReturnPath(returnUrl, fallbackPath = DEFAULT_RETURN_PATH) {
  if (!returnUrl) return fallbackPath;

  if (typeof window === "undefined") {
    return returnUrl.startsWith("/") ? returnUrl : fallbackPath;
  }

  try {
    const parsedUrl = new URL(returnUrl, window.location.origin);
    if (parsedUrl.origin !== window.location.origin) return fallbackPath;

    const path = `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
    return path || fallbackPath;
  } catch {
    return returnUrl.startsWith("/") ? returnUrl : fallbackPath;
  }
}

export function buildLoginUrl(returnUrl) {
  const loginUrl = new URL("/Login", window.location.origin);
  loginUrl.searchParams.set("returnUrl", getSameOriginReturnPath(returnUrl));
  return loginUrl.toString();
}
