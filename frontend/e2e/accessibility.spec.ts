import { expect, test } from "@playwright/test";
import { createRequire } from "node:module";
import { mockApi } from "./fixtures";

const require = createRequire(import.meta.url);

test("upload is keyboard-operable, reduced-motion safe, and axe-clean on mobile", async ({
  page,
}) => {
  await mockApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Beat ATS home" })).toBeFocused();
  const animationDuration = await page
    .locator(".stage-enter")
    .evaluate((element) => getComputedStyle(element).animationDuration);
  expect(Number.parseFloat(animationDuration)).toBeLessThan(0.001);

  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const results = await page.evaluate(async () => {
    const axe = (
      window as typeof window & { axe: { run: () => Promise<{ violations: unknown[] }> } }
    ).axe;
    return axe.run();
  });
  expect(results.violations).toEqual([]);
});
