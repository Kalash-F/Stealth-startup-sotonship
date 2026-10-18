import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// WCAG 2.2 AA, checked with axe on every route, in both workspace colour modes.
// The checker's report needs the backend, which `next start` does not proxy, so only its empty state runs here.
const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const siteRoutes = ["/", "/sign-in", "/request-demo", "/legal/privacy", "/legal/terms"];
const appRoutes = [
  "/app",
  "/app/investigations",
  "/app/investigations/CASE-0142",
  "/app/entities",
  "/app/activity",
  "/app/statistics",
  "/app/checker",
];

async function violations(page: Page) {
  // open disclosures so their content is checked too
  await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
  const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze();
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

for (const route of siteRoutes) {
  test(`${route} meets WCAG 2.2 AA`, async ({ page }) => {
    await page.goto(route);
    await page.waitForTimeout(400);
    expect(await violations(page)).toEqual([]);
  });
}

for (const route of appRoutes) {
  for (const mode of ["light", "dark"] as const) {
    test(`${route} meets WCAG 2.2 AA in ${mode} mode`, async ({ page }) => {
      if (mode === "dark") await page.addInitScript(() => localStorage.setItem("ws-mode", "dark"));
      await page.goto(route);
      await page.waitForTimeout(400);
      expect(await violations(page)).toEqual([]);
    });
  }
}

test("case tabs meet WCAG 2.2 AA", async ({ page }) => {
  await page.goto("/app/investigations/CASE-0142");
  for (const tab of ["Invoice", "Timeline", "Transactions", "Network", "Notes"]) {
    await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
    await page.waitForTimeout(200);
    expect(await violations(page), tab).toEqual([]);
  }
});

test("the workspace skip link moves focus to the content", async ({ page }) => {
  await page.goto("/app/checker");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest("main"))).toBe(true);
});
