import { expect, test } from "@playwright/test";
import { completeUpload, mockApi } from "./fixtures";

test.use({ reducedMotion: "reduce" });

test("captures stable workflow stage visuals", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await expect(page).toHaveScreenshot("stage-1-upload.png", {
    fullPage: true,
    animations: "disabled",
  });

  await completeUpload(page);
  await expect(page).toHaveScreenshot("stage-2-review.png", {
    fullPage: true,
    animations: "disabled",
  });

  await page.getByRole("button", { name: /Request advisory comparison/ }).click();
  await page.getByRole("heading", { name: "Tailor the wording, preserve the truth" }).waitFor();
  await expect(page).toHaveScreenshot("stage-3-tailor.png", {
    fullPage: true,
    animations: "disabled",
  });

  await page.getByRole("button", { name: "Continue without tailoring" }).click();
  await page.getByRole("heading", { name: "Verify the final document" }).waitFor();
  await expect(page).toHaveScreenshot("stage-4-export.png", {
    fullPage: true,
    animations: "disabled",
  });
});

test("captures mobile upload without overflow", async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page).toHaveScreenshot("stage-1-upload-mobile.png", {
    fullPage: true,
    animations: "disabled",
  });
});
