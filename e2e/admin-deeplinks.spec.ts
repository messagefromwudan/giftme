import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN_PASSWORD } from "../playwright.config";

const OK = "http://localhost:3300";
const DOWN = "http://localhost:3301";

const date = () => {
  const d = new Date(Date.now() + 7 * 86_400_000); // past GM-09's 5-day minimum in any time zone
  return d.toISOString().slice(0, 10);
};

const order = (over: Record<string, unknown> = {}) => ({
  lang: "ro",
  items: [{ boxId: "GM-01", quantity: 1 }],
  buyer: { name: "E2E Test", email: `e2e.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@example.com`, phone: "068000000" },
  recipient: { name: "Ion" },
  personalization: { occasion: "Test" },
  delivery: { zone: "chisinau", address: "str. Test 1", date: date() },
  payment: "cash",
  acceptTerms: true,
  ...over,
});

// One order of each type, created through the public APIs.
const ids: Record<string, string> = {};
test.beforeAll(async ({ request }) => {
  const web = await request.post(`${OK}/api/orders`, { data: { ...order(), startedAt: Date.now() - 10_000 } });
  ids.catalog = (await web.json()).order.id;
  const gm09 = await request.post(`${OK}/api/orders`, {
    data: { ...order({ items: [{ boxId: "GM-09", quantity: 1 }], customGift: { idea: "o bijuterie" }, acceptCustomTerms: true }), startedAt: Date.now() - 10_000 },
  });
  ids.gm09 = (await gm09.json()).order.id;
  const agent = await request.post(`${OK}/api/agent/order`, { data: order(), headers: { "Idempotency-Key": `e2e-${Date.now()}` } });
  ids.agent = (await agent.json()).order.id;
  for (const id of Object.values(ids)) expect(id).toMatch(/^GM-\d{4,}$/);
});

function trackCrashes(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

async function login(page: Page, password = E2E_ADMIN_PASSWORD) {
  await expect(page.locator("#password")).toBeVisible();
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Intră" }).click();
}

for (const [kind, marker] of [
  ["catalog", "Schimbă statusul"],
  ["gm09", "YOUR BOX (GM-09): cadoul"],
  ["agent", "Comandă plasată de un asistent AI"],
] as const) {
  test(`deep link to a ${kind} order: login, then back on that order`, async ({ page }) => {
    const crashes = trackCrashes(page);
    await page.goto(`${OK}/admin/comenzi/${ids[kind]}/`);
    await login(page);
    await expect(page).toHaveURL(`${OK}/admin/comenzi/${ids[kind]}/`);
    await expect(page.getByRole("heading", { name: ids[kind] })).toBeVisible();
    await expect(page.getByText(marker)).toBeVisible();
    expect(crashes).toEqual([]);
  });
}

test("wrong password shows a message and stays on the deep link", async ({ page }) => {
  const crashes = trackCrashes(page);
  await page.goto(`${OK}/admin/comenzi/${ids.catalog}/`);
  await login(page, "definitely-wrong-password");
  await expect(page.getByText("Parolă greșită.")).toBeVisible();
  await expect(page).toHaveURL(`${OK}/admin/comenzi/${ids.catalog}/`);
  expect(crashes).toEqual([]);
});

test("unknown and malformed order numbers show a normal message", async ({ page }) => {
  const crashes = trackCrashes(page);
  await page.goto(`${OK}/admin/comenzi/GM-999999/`);
  await login(page);
  await expect(page.getByText("Comanda GM-999999 nu există")).toBeVisible();
  await page.goto(`${OK}/admin/comenzi/abc/`);
  await expect(page.getByText("Comanda ABC nu există")).toBeVisible();
  expect(crashes).toEqual([]);
});

test("storage unavailable: list and deep link show a message, never a crash", async ({ page }) => {
  const crashes = trackCrashes(page);
  await page.goto(`${DOWN}/admin/comenzi/GM-1001/`);
  await login(page);
  await expect(page.getByText("Baza de date nu răspunde")).toBeVisible();
  await page.goto(`${DOWN}/admin/`);
  await expect(page.getByText("Baza de date nu răspunde")).toBeVisible();
  expect(crashes).toEqual([]);
});
