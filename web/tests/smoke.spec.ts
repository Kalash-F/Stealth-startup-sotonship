import { expect, test, type Page } from "@playwright/test";

const routes = [
  "/",
  "/sign-in",
  "/request-demo",
  "/legal/privacy",
  "/legal/terms",
  "/app",
  "/app/investigations",
  "/app/investigations/CASE-0142",
  "/app/entities",
];

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("response", (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
  return errors;
}

for (const route of routes) {
  for (const width of [1440, 390]) {
    test(`${route} renders cleanly at ${width}px`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.setViewportSize({ width, height: 900 });
      const res = await page.goto(route);
      expect(res?.status()).toBe(200);
      await expect(page.locator("h1").first()).toBeVisible();
      await page.waitForTimeout(300);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth, "no horizontal overflow").toBeLessThanOrEqual(width);
      expect(errors).toEqual([]);
    });
  }
}

test("marketing CTAs reach the demo and the request form", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Explore the workspace" }).first().click();
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/");
  await page.getByRole("link", { name: "Request a demo" }).first().click();
  await expect(page).toHaveURL(/\/request-demo$/);
  await page.goto("/");
  await page.getByRole("link", { name: "Check an invoice" }).first().click();
  await expect(page).toHaveURL(/\/app\/checker$/);
});

test("sign-in never accepts credentials and offers the demo", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel(/email/i).fill("someone@example.com");
  await page.getByLabel(/password/i).fill("secret");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("status")).toContainText(/not available/i);
  await expect(page.getByLabel(/password/i)).toHaveValue("");
  await page.getByRole("link", { name: "Explore the workspace" }).click();
  await expect(page).toHaveURL(/\/app$/);
});

test("investigation list filters and opens a case", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/app/investigations");
  await page.getByRole("searchbox").or(page.getByPlaceholder(/search/i).last()).first().fill("copper");
  await expect(page.getByRole("link", { name: /CASE-0145/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /CASE-0142/ })).toHaveCount(0);
  await page.getByRole("link", { name: /CASE-0145/ }).first().click();
  await expect(page).toHaveURL(/CASE-0145/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Copper cathodes");
});

test("case tabs switch and mock actions give feedback", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/app/investigations/CASE-0142");
  for (const tab of ["Invoice", "Timeline", "Transactions", "Network", "Notes", "Summary"]) {
    await page.getByRole("tab", { name: new RegExp(tab) }).click();
    await expect(page.getByRole("tab", { name: new RegExp(tab) })).toHaveAttribute("data-state", "active");
  }
  await page.getByRole("button", { name: "Request information" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("selecting an entity opens its detail", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/app/entities?entity=ent-vltava");
  await expect(page.getByRole("heading", { name: "Vltava Componenta s.r.o." })).toBeVisible();
  await expect(page.getByText("USD 359,300").first()).toBeVisible();
});
