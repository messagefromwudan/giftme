import { SITE } from "./catalog";

// Links in emails (tracking, approval, QR recorder, "open in admin") must point to the site
// the order was placed on: production orders → www.giftme.site, preview test orders → that
// preview. The request's origin is only trusted if it is one of our own hosts, so a forged
// Host header can never put a foreign link into our emails.

const OWN_HOSTS = ["www.giftme.site", "giftme.site"];

function deploymentHosts(): string[] {
  return [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL].filter(
    (h): h is string => Boolean(h),
  );
}

export function trustedOrigin(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return undefined;
  }
  const host = u.host.toLowerCase();
  if (u.protocol === "https:" && (OWN_HOSTS.includes(host) || deploymentHosts().includes(host))) return u.origin;
  if (process.env.NODE_ENV !== "production" || !process.env.VERCEL_ENV) {
    if (u.protocol === "http:" && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return u.origin;
  }
  return undefined;
}

/** Base URL for links about an order: where it was placed, else the configured site. */
export const orderBaseUrl = (siteOrigin?: string) =>
  (siteOrigin && trustedOrigin(siteOrigin)) || process.env.SITE_URL || SITE.url;
