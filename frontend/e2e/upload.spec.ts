import { expect, test } from "@playwright/test";

test("renders the upload register without horizontal overflow on a phone", async ({ page }) => {
  await page.route("**/api/v1/config", async (route) => {
    await route.fulfill({
      json: {
        max_upload_bytes: 4194304,
        accepted_extensions: ["pdf", "docx"],
        vision_fallback_available: true,
        gemini_model: "gemini-3.1-flash-lite",
      },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Upload", exact: true })).toBeVisible();
  await expect(page.getByLabel("Resume file")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
