import { defineConfig } from "@playwright/test";

// End-to-end tests against production builds (`npm run e2e` builds first).
// Two servers: a healthy one (in-memory store) and one whose storage is unavailable.
export const E2E_ADMIN_PASSWORD = "e2e-admin-password-123";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  workers: 1,
  reporter: [["list"]],
  use: {
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
    viewport: { width: 1280, height: 900 },
  },
  webServer: [
    {
      command: "npx next start -p 3300",
      url: "http://localhost:3300/",
      reuseExistingServer: false,
      env: { CHECKOUT_OPEN: "true", ADMIN_PASSWORD: E2E_ADMIN_PASSWORD },
    },
    {
      // VERCEL_ENV=production without Supabase: storage refuses to start, as on a misconfigured deploy.
      command: "npx next start -p 3301",
      url: "http://localhost:3301/",
      reuseExistingServer: false,
      env: { VERCEL_ENV: "production", ADMIN_PASSWORD: E2E_ADMIN_PASSWORD },
    },
  ],
});
