import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

test("hero leads with the outcome and one name per destination", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Spot mispriced trade invoices in seconds.");
  const nav = page.getByRole("navigation", { name: "Primary" });
  for (const [label, href] of [
    ["Product", "/#product"],
    ["How it works", "/#how-it-works"],
    ["Data", "/#data"],
    ["Contact", "/#contact"],
  ]) {
    await expect(nav.getByRole("link", { name: label })).toHaveAttribute("href", href);
  }
  // The header button stays out of the way while the hero's own buttons are on screen.
  const hero = page.locator("section[aria-labelledby=hero-title]");
  await expect(hero.getByRole("link", { name: "Check an invoice" })).toHaveAttribute("href", "/app/checker");
  await expect(hero.getByRole("link", { name: "Explore the workspace" })).toHaveAttribute("href", "/app");
  await expect(page.locator("header").getByRole("link", { name: "Check an invoice" })).toHaveCount(0);
  await page.locator("#data").scrollIntoViewIfNeeded();
  await expect(page.locator("header").getByRole("link", { name: "Check an invoice" })).toBeVisible();
});

test("hero map: the flagged line first, then companies, payments and layers", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator("section[aria-labelledby=hero-title]");
  await expect(hero.getByText("Flagged line · price outlier")).toBeVisible({ timeout: 10_000 });
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
  await hero.getByRole("button", { name: /Paid on/ }).click();
  await expect(hero.getByText("Payments under review")).toBeVisible();
  await hero.getByRole("link", { name: "Open the case" }).click();
  await expect(page).toHaveURL(/\/app\/investigations\/CASE-0142$/);
});

test("annotated invoice links each note to its field", async ({ page }) => {
  await page.goto("/#product");
  const section = page.locator("#product");
  const notes = section.getByRole("list", { name: "What the check found" }).getByRole("listitem");
  await expect(notes).toHaveCount(5);
  await expect(notes.first()).toContainText("The origin contradicts itself");
  await notes.nth(2).locator("[tabindex='0']").focus();
  await expect(notes.nth(2)).toContainText("92×");
});

test("workspace tabs switch between real screens, including the network", async ({ page }) => {
  await page.goto("/#workspace");
  const section = page.locator("#workspace");
  await section.getByRole("tab", { name: /Case file/ }).click();
  await expect(section.getByRole("tab", { name: /Case file/ })).toHaveAttribute("data-state", "active");
  await expect(section.getByRole("link", { name: /Open this screen/ })).toHaveAttribute("href", "/app/investigations/CASE-0142");
  await section.getByRole("tab", { name: /Network/ }).click();
  await expect(section.getByRole("link", { name: /Open this screen/ })).toHaveAttribute("href", "/app/entities");
  await expect(section.getByRole("heading", { name: "Orchard Gate General Trading FZE" })).toBeVisible();
  await expect(section.locator(".react-flow__attribution")).toHaveCount(0);
  await section.locator(".react-flow__node").filter({ hasText: "Vltava Componenta" }).click();
  await expect(section.getByRole("heading", { name: "Vltava Componenta s.r.o." })).toBeVisible();
  await section.getByRole("tab", { name: /Review queue/ }).click();
  await expect(section.getByRole("link", { name: /Open this screen/ })).toHaveAttribute("href", "/app");
});

test("contact section offers the checker and a demo request", async ({ page }) => {
  await page.goto("/#contact");
  const section = page.locator("#contact");
  await expect(section.getByRole("link", { name: "Check an invoice" })).toHaveAttribute("href", "/app/checker");
  await section.getByRole("link", { name: "Request a demo" }).click();
  await expect(page).toHaveURL(/\/request-demo$/);
});
