import { execFileSync } from "node:child_process";
import { accessSync, constants, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const scenario = JSON.parse(
  readFileSync(join(repositoryRoot, "tests", "fixtures", "integration_scenario.json"), "utf8"),
);

function integrationResume(testOutputPath: string): string {
  const privateResume = process.env.BEAT_ATS_INTEGRATION_RESUME;
  if (privateResume && existsSync(privateResume)) {
    try {
      accessSync(privateResume, constants.R_OK);
      return privateResume;
    } catch {
      // Use the deterministic non-private input when a configured local file is unavailable.
    }
  }
  const syntheticResume = join(testOutputPath, "integration-resume.pdf");
  execFileSync(process.env.BEAT_ATS_PYTHON ?? "python", [
    join(repositoryRoot, "tests", "create_integration_pdf.py"),
    syntheticResume,
  ]);
  return syntheticResume;
}

function inspectDocx(path: string): {
  paragraphs: string[];
  table_count: number;
  header_text: string[];
  footer_text: string[];
} {
  return JSON.parse(
    execFileSync(
      process.env.BEAT_ATS_PYTHON ?? "python",
      [join(repositoryRoot, "tests", "inspect_docx.py"), path],
      { encoding: "utf8" },
    ),
  );
}

function assertOrdered(paragraphs: string[], values: string[]) {
  let previous = -1;
  for (const value of values) {
    const index = paragraphs.indexOf(value);
    expect(index, `Expected DOCX text: ${value}`).toBeGreaterThan(previous);
    previous = index;
  }
}

function nonEmpty(values: Array<string | null | undefined>): string[] {
  return values.filter((value): value is string => Boolean(value));
}

function expectedDocxParagraphs(replacements: Map<string, string>): string[] {
  const { contact, professional_summary: summary } = scenario.resume;
  const work = scenario.resume.work_experience.flatMap((entry) => {
    const dates = nonEmpty([entry.start_date, entry.end_date]).join(" - ");
    return [
      `${entry.title}\t${entry.employer}`,
      ...nonEmpty([nonEmpty([entry.location, dates]).join(" | ")]),
      ...entry.bullets.map((bullet) => replacements.get(bullet.text) ?? bullet.text),
    ];
  });
  const skills = scenario.resume.skills.flatMap((group) =>
    group.label ? [`${group.label}: ${group.items.join(", ")}`] : [group.items.join(", ")],
  );
  const education = scenario.resume.education.flatMap((entry) => [
    `${entry.credential}${entry.field_of_study ? `, ${entry.field_of_study}` : ""}\t${entry.institution}`,
    ...nonEmpty([nonEmpty([entry.location, entry.dates]).join(" | ")]),
    ...entry.details,
  ]);
  const projects = scenario.resume.projects.flatMap((entry) => [
    `${entry.name}\t${entry.role}`,
    ...nonEmpty([nonEmpty([entry.dates, entry.link]).join(" | ")]),
    ...entry.bullets.map((bullet) => replacements.get(bullet.text) ?? bullet.text),
  ]);
  const additionalSections = scenario.resume.additional_sections.flatMap((section) => [
    section.title.toUpperCase(),
    ...section.items,
  ]);

  return [
    contact.full_name,
    ...nonEmpty([nonEmpty([contact.email, contact.phone, contact.location]).join(" | ")]),
    ...contact.links,
    "PROFESSIONAL SUMMARY",
    ...nonEmpty([summary]),
    "WORK EXPERIENCE",
    ...work,
    "SKILLS",
    ...skills,
    "EDUCATION",
    ...education,
    "CERTIFICATIONS",
    ...scenario.resume.certifications,
    "PROJECTS",
    ...projects,
    ...additionalSections,
  ];
}

test("runs the built SPA, FastAPI, parser, fake Gemini, and retained-Blob repeat download", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const marker = await page.request.get("/__beat-ats-integration-build.txt");
  expect(marker.ok()).toBe(true);
  await expect(marker.text()).resolves.toMatch(/^[a-f0-9]{64}$/);

  await page.getByLabel("Resume file").setInputFiles(integrationResume(testInfo.outputPath()));
  await page
    .getByRole("textbox", { name: /Target job description/ })
    .fill(scenario.selected_job_description);
  await page.getByRole("checkbox", { name: /I consent to processing/ }).check();
  await page.getByRole("button", { name: "Review extracted resume" }).click();
  await expect(page.getByRole("heading", { name: "Verify what was extracted" })).toBeVisible();

  await page.getByRole("button", { name: /Request advisory comparison/ }).click();
  await expect(
    page.getByRole("heading", { name: "Tailor the wording, preserve the truth" }),
  ).toBeVisible();

  const workRewrite = scenario.rewrites[0];
  const projectRewrite = scenario.rewrites[1];
  await page.getByRole("checkbox", { name: workRewrite.original_text }).check();
  await page.getByRole("checkbox", { name: projectRewrite.original_text }).check();
  await page.getByRole("button", { name: "Generate suggestions" }).click();
  const firstProposal = page.locator(".proposal-card").first();
  await expect(firstProposal.getByText(workRewrite.accepted_text, { exact: true })).toBeVisible();
  await firstProposal.getByRole("button", { name: "Apply wording" }).click();
  await expect(firstProposal.getByText(workRewrite.accepted_text, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Review next bullet" }).click();
  await expect(
    page
      .locator(".tailor-desktop .suggestion-pane")
      .getByText(projectRewrite.original_text, { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Proceed to final export" }).click();

  await expect(page.getByRole("heading", { name: "Verify the final document" })).toBeVisible();
  await page.getByRole("checkbox", { name: /all bullet points, numbers/ }).check();
  await page.getByRole("checkbox", { name: /results are advisory/ }).check();
  const downloadButton = page.getByRole("button", { name: /Download ATS-safe/ });
  const downloadPromise = page.waitForEvent("download");
  await downloadButton.click();
  const firstDownload = await downloadPromise;
  const firstPath = testInfo.outputPath("tailored-resume-first.docx");
  await firstDownload.saveAs(firstPath);

  const repeatDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download again" }).click();
  const repeatDownload = await repeatDownloadPromise;
  const repeatPath = testInfo.outputPath("tailored-resume-repeat.docx");
  await repeatDownload.saveAs(repeatPath);

  expect(readFileSync(repeatPath)).toEqual(readFileSync(firstPath));
  const facts = inspectDocx(firstPath);
  expect(facts.table_count).toBe(0);
  expect(facts.header_text).toEqual([]);
  expect(facts.footer_text).toEqual([]);
  expect(facts.paragraphs).not.toContain(workRewrite.original_text);

  assertOrdered(
    facts.paragraphs,
    expectedDocxParagraphs(new Map([[workRewrite.original_text, workRewrite.accepted_text]])),
  );
});
