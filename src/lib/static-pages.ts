/** True for the GitHub Pages static build (`VITE_STATIC_PAGES=true`). */
export const isStaticPages = import.meta.env.VITE_STATIC_PAGES === "true";

export const PAGES_USER_ID = "pages-user";

export const PAGES_LOOKUP_MESSAGE =
  "Listing lookup, wrapper scan, and Grok notes need a hosted server. This GitHub Pages copy keeps the cellar on this browser.";

export const PAGES_SHARE_MESSAGE =
  "Household sharing needs the hosted app. This GitHub Pages copy stays on this device.";

/** Prefix a public path with Vite's base (needed on project GitHub Pages). */
export function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}${path.replace(/^\//, "")}`;
}
