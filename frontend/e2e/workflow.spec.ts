import { expect, test } from "@playwright/test";
import { completeUpload, mockApi, reachTailor, resume } from "./fixtures";

test("completes the controlled desktop workflow and downloads DOCX", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await reachTailor(page);

  await page.getByRole("checkbox", { name: /Built React interfaces/ }).check();
  await page.getByRole("checkbox", { name: /Published reusable components/ }).check();
  await expect(page.getByText("2 / 10")).toBeVisible();
  await page.getByRole("button", { name: "Generate suggestions" }).click();

  const desktopStudio = page.locator(".tailor-desktop");
  await expect(desktopStudio.getByText("Original wording")).toBeVisible();
  await expect(page.getByText("1 / 2")).toBeVisible();
  await expect(page.locator(".tailor-desktop").getByText("Review required")).toBeVisible();
  await expect(page.getByRole("button", { name: "Proceed to final export" })).toBeDisabled();
  await expect(desktopStudio.locator("mark", { hasText: "accessible" })).toBeVisible();
  await expect(
    desktopStudio
      .getByLabel("Suggested keywords not present verbatim")
      .getByText("WCAG", { exact: true }),
  ).toBeVisible();
  await page
    .locator(".proposal-card")
    .first()
    .getByRole("button", { name: "Apply wording" })
    .click();
  await expect(page.locator(".tailor-desktop").getByText("Applied wording")).toBeVisible();

  await page.getByRole("button", { name: "Review next bullet" }).click();
  await expect(
    page
      .locator(".tailor-desktop .suggestion-pane")
      .getByText("Published reusable components for 6 products", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("2 / 2")).toBeVisible();
  await page.getByRole("button", { name: "Proceed to final export" }).click();

  await expect(page.getByRole("heading", { name: "Verify the final document" })).toBeVisible();
  await expect(page.getByText("Web Accessibility Specialist")).toBeVisible();
  await expect(page.getByText("Mentor at Frontend Lagos")).toBeVisible();
  const downloadButton = page.getByRole("button", { name: /Download ATS-optimized/ });
  await expect(downloadButton).toBeDisabled();
  await page.getByRole("checkbox", { name: /all bullet points, numbers/ }).check();
  await page.getByRole("checkbox", { name: /results are advisory/ }).check();
  await expect(downloadButton).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await downloadButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("tailored_resume.docx");
});

test("recovers from scanned-PDF consent and retains populated inputs", async ({ page }) => {
  await mockApi(page, { streamErrors: ["vision_consent_required"] });
  await page.goto("/");
  await page.getByLabel("Resume file").setInputFiles({
    name: "scan.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF scan"),
  });
  const description = page.getByRole("textbox", { name: /Target job description/ });
  await description.fill(
    "A complete frontend role description requiring accessible interfaces and product delivery.",
  );
  await page.getByRole("checkbox", { name: /I consent to processing/ }).check();
  await page.getByRole("button", { name: "Review extracted resume" }).click();
  await expect(page.getByText(/requires Gemini vision/)).toBeVisible();
  await expect(description).toHaveValue(/complete frontend role/);
  await page.getByRole("checkbox", { name: /Visual PDF processing/ }).check();
  await page.getByRole("button", { name: "Review extracted resume" }).click();
  await expect(page.getByRole("heading", { name: "Verify what was extracted" })).toBeVisible();
});

test("recovers from a terminal ingestion stream failure", async ({ page }) => {
  await mockApi(page, { streamErrors: ["ingestion_failed"] });
  await page.goto("/");
  await page.getByLabel("Resume file").setInputFiles({
    name: "resume.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF mocked resume"),
  });
  const description = page.getByRole("textbox", { name: /Target job description/ });
  await description.fill(
    "A complete frontend role description requiring accessible interfaces and product delivery.",
  );
  await page.getByRole("checkbox", { name: /I consent to processing/ }).check();
  await page.getByRole("button", { name: "Review extracted resume" }).click();
  await expect(page.getByText("The document stream stopped unexpectedly.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(description).toHaveValue(/complete frontend role/);
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("heading", { name: "Verify what was extracted" })).toBeVisible();
});

test("keeps analysis failures in Review with a retry action", async ({ page }) => {
  await mockApi(page, { analysisFails: true });
  await page.goto("/");
  await completeUpload(page);
  await page.getByRole("button", { name: /Request advisory comparison/ }).click();
  await expect(page.getByRole("heading", { name: "Verify what was extracted" })).toBeVisible();
  await expect(page.getByText("Analysis is unavailable.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});

test("enforces the ten-bullet cap and preserves state across back navigation", async ({ page }) => {
  const manyBullets = Array.from({ length: 11 }, (_, index) => ({
    id: `work-${index + 1}`,
    text: `Evidence-backed bullet ${index + 1}`,
  }));
  await mockApi(page);
  await page.route("**/api/v1/resumes/ingest/stream", (route) =>
    route.fulfill({
      contentType: "application/jsonl",
      body: `${JSON.stringify({
        type: "result",
        data: {
          resume: {
            ...resume,
            work_experience: [{ ...resume.work_experience[0], bullets: manyBullets }],
          },
          extraction_method: "pdf_text",
          warnings: [],
        },
      })}\n`,
    }),
  );
  await page.goto("/");
  await reachTailor(page);
  const bullets = page.getByRole("checkbox", { name: /Evidence-backed bullet/ });
  for (let index = 0; index < 10; index += 1) await bullets.nth(index).check();
  await expect(bullets.nth(10)).toBeDisabled();
  await page.getByRole("button", { name: "Back to review" }).click();
  await expect(page.getByRole("heading", { name: "Verify what was extracted" })).toBeVisible();
});

test("clears the in-memory session only after destructive confirmation", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await completeUpload(page);
  await page.getByRole("button", { name: "Clear session" }).click();
  await expect(page.getByRole("alertdialog", { name: "Clear all session data?" })).toBeVisible();
  await page.getByRole("button", { name: "Keep session" }).click();
  await expect(page.getByRole("heading", { name: "Verify what was extracted" })).toBeVisible();
  await page.getByRole("button", { name: "Clear session" }).click();
  await page.getByRole("button", { name: "Clear session", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: "Start with the evidence" })).toBeVisible();
});

test("completes the no-tailoring path at a 390px mobile viewport", async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await reachTailor(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.getByRole("tab", { name: "Resume" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Suggestions" })).toBeVisible();
  await page.getByRole("button", { name: "Continue without tailoring" }).click();
  await expect(page.getByRole("heading", { name: "Verify the final document" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
