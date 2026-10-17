import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

test("hero map: entities, payments and layers respond", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator("section[aria-labelledby=hero-title]");
  await expect(hero.getByText("Payments under review")).toBeVisible({ timeout: 10_000 });
  await hero.getByRole("button", { name: /Calder Brook/ }).click();
  await expect(hero.getByText("Calder Brook Industrial Supplies Ltd")).toBeVisible();
  await hero.getByRole("button", { name: /To maker/ }).click();
  await expect(hero.getByText("Orchard Gate → Yongjia Hexa Fasteners")).toBeVisible();
  const money = hero.getByRole("button", { name: "Money", exact: true });
  await money.click();
  await expect(money).toHaveAttribute("aria-pressed", "false");
  await expect(hero.getByRole("button", { name: /Paid on/ })).toHaveCount(0);
  await hero.getByRole("button", { name: "Replay" }).click();
  await expect(money).toHaveAttribute("aria-pressed", "true");
  await hero.getByRole("link", { name: "Open CASE-0142" }).click();
  await expect(page).toHaveURL(/\/app\/investigations\/CASE-0142$/);
});

test("workspace tabs switch between real screens", async ({ page }) => {
  await page.goto("/#workspace");
  const section = page.locator("#workspace");
  await section.getByRole("tab", { name: /Invoice evidence/ }).click();
  await expect(section.getByRole("tab", { name: /Invoice evidence/ })).toHaveAttribute("data-state", "active");
  await expect(section.getByRole("link", { name: /Open this screen/ })).toHaveAttribute("href", "/app/investigations/CASE-0142");
  await section.getByRole("tab", { name: /Overview/ }).click();
  await expect(section.getByRole("link", { name: /Open this screen/ })).toHaveAttribute("href", "/app");
});

test("network section selects nodes and shows details", async ({ page }) => {
  await page.goto("/#network");
  const section = page.locator("#network");
  await expect(section.getByText("Beneficial owner").first()).toBeVisible();
  await section.getByRole("button", { name: "Vltava Componenta", exact: true }).first().click();
  await expect(section.getByRole("heading", { name: "Vltava Componenta s.r.o." })).toBeVisible();
});

test("closing section opens the demo workspace", async ({ page }) => {
  await page.goto("/");
  await page.locator("section[aria-labelledby=enter-heading]").getByRole("link", { name: /Explore the platform/ }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator("h1").first()).toBeVisible();
});
