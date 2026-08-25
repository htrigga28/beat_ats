import { expect, test } from "@playwright/test";
import { createRequire } from "node:module";
import { completeUpload, mockApi } from "./fixtures";

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
  const stage = page.locator('[data-motion-stage="1"]');
  await expect(stage).toHaveAttribute("data-motion-state", "settled");
  expect(
    await stage.evaluate(async (element) => {
      const before = element.getBoundingClientRect();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const after = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        inlineOpacity: element.style.opacity,
        inlineTransform: element.style.transform,
        opacity: style.opacity,
        transform: style.transform,
        topStable: before.top === after.top,
        leftStable: before.left === after.left,
      };
    }),
  ).toEqual({
    inlineOpacity: "",
    inlineTransform: "",
    opacity: "1",
    transform: "none",
    topStable: true,
    leftStable: true,
  });

  await completeUpload(page);
  await page.getByRole("button", { name: /Request advisory comparison/ }).click();
  const analysis = page.locator('[data-motion-ack="analysis"]');
  await expect(analysis).toHaveAttribute("data-motion-state", "settled");
  expect(
    await analysis.evaluate((element) => ({
      inlineOpacity: element.style.opacity,
      inlineTransform: element.style.transform,
      opacity: getComputedStyle(element).opacity,
      transform: getComputedStyle(element).transform,
    })),
  ).toEqual({ inlineOpacity: "", inlineTransform: "", opacity: "1", transform: "none" });

  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const results = await page.evaluate(async () => {
    const axe = (
      window as typeof window & { axe: { run: () => Promise<{ violations: unknown[] }> } }
    ).axe;
    return axe.run();
  });
  expect(results.violations).toEqual([]);
});
