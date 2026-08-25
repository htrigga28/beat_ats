import { expect, test } from "@playwright/test";
import { completeUpload, mockApi } from "./fixtures";

test("accepts the target limit and prevents extra Review target text", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await completeUpload(page);

  const target = page.getByRole("textbox", { name: "Target job description" });
  await expect(target).toHaveAttribute("maxlength", "50000");
  await expect(page.locator("#target-description-count")).toHaveAttribute("aria-live", "polite");

  await target.fill("a".repeat(50_000));
  await expect(page.locator("#target-description-count")).toHaveText(
    "50,000 / 50 minimum · 50,000 maximum",
  );
  await page.getByRole("button", { name: /Request advisory comparison/ }).click();
  await expect(
    page.getByRole("heading", { name: "Tailor the wording, preserve the truth" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Back to review" }).click();
  await target.fill("a".repeat(50_001));
  expect((await target.inputValue()).length).toBe(50_000);
});
