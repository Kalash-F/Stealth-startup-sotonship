// Usage: node scripts/screenshot.mjs <url> <out.png> [width=1440] [height=900] [fullPage=1]
// Prints console errors and document scrollWidth (to catch horizontal overflow).
import { chromium } from "@playwright/test";

const [, , url, out, w = "1440", h = "900", full = "1"] = process.argv;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-proxy-server"],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
page.on("response", (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
await page.goto(url, { waitUntil: "load" });
await page.waitForTimeout(800);
await page.screenshot({ path: out, fullPage: full === "1" });
const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
console.log(JSON.stringify({ url, width: +w, scrollWidth, overflow: scrollWidth > +w, errors }, null, 2));
await browser.close();
