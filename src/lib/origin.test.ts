import { afterEach, describe, expect, it, vi } from "vitest";
import { orderBaseUrl, trustedOrigin } from "./origin";

afterEach(() => vi.unstubAllEnvs());

describe("email link host", () => {
  it("links back to production or to this deployment, never to a foreign host", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "giftme-abc123-messagefromwudans-projects.vercel.app");
    expect(trustedOrigin("https://www.giftme.site/api/orders")).toBe("https://www.giftme.site");
    expect(trustedOrigin("https://giftme-abc123-messagefromwudans-projects.vercel.app/x")).toBe(
      "https://giftme-abc123-messagefromwudans-projects.vercel.app",
    );
    expect(trustedOrigin("https://evil.example/x")).toBeUndefined();
    expect(trustedOrigin("https://giftme-other-messagefromwudans-projects.vercel.app")).toBeUndefined();
    expect(trustedOrigin("http://www.giftme.site")).toBeUndefined();
  });

  it("falls back to the configured site when the origin is unknown or untrusted", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(orderBaseUrl(undefined)).toBe("https://www.giftme.site");
    expect(orderBaseUrl("https://evil.example")).toBe("https://www.giftme.site");
    expect(orderBaseUrl("https://www.giftme.site")).toBe("https://www.giftme.site");
  });
});
