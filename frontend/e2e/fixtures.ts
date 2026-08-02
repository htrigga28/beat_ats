import type { Page, Route } from "@playwright/test";

export const resume = {
  contact: {
    full_name: "Jane Doe",
    email: "jane@example.com",
    phone: "+1 555 0100",
    location: "Lagos, Nigeria",
    links: ["https://example.com/jane"],
  },
  professional_summary: "Frontend engineer building accessible B2B products.",
  work_experience: [
    {
      id: "role-1",
      employer: "Example Labs",
      title: "Frontend Engineer",
      location: "Remote",
      start_date: "2022",
      end_date: "Present",
      bullets: [
        { id: "work-1", text: "Built React interfaces used by 10 product teams" },
        { id: "work-2", text: "Led design system adoption across web applications" },
      ],
    },
  ],
  skills: [{ label: "Frontend", items: ["React", "TypeScript", "Accessibility"] }],
  education: [
    {
      institution: "University of Lagos",
      credential: "BSc Computer Science",
      field_of_study: "Computer Science",
      location: "Lagos",
      dates: "2018",
      details: ["First class honours"],
    },
  ],
  certifications: ["Web Accessibility Specialist"],
  projects: [
    {
      id: "project-1",
      name: "Component Toolkit",
      role: "Maintainer",
      dates: "2023",
      link: "https://example.com/toolkit",
      bullets: [{ id: "project-bullet-1", text: "Published reusable components for 6 products" }],
    },
  ],
  additional_sections: [{ title: "Community", items: ["Mentor at Frontend Lagos"] }],
};

export const analysis = {
  match_score: 72,
  keyword_gaps: [
    { term: "WCAG", category: "technical_skill", importance: "Required by the role" },
    { term: "product strategy", category: "domain", importance: "Important responsibility" },
  ],
  title_alignment: {
    target_title: "Senior Frontend Engineer",
    assessment: "partially_aligned",
    rationale: "The resume demonstrates relevant frontend ownership and product collaboration.",
    equivalent_title_suggestions: [],
  },
  actionable_recommendations: [
    "Prioritize accessible interface outcomes.",
    "Connect design-system work to product collaboration.",
    "Keep official titles unchanged.",
  ],
};

const rewrites = {
  items: [
    {
      bullet_id: "work-1",
      original_text: "Built React interfaces used by 10 product teams",
      alternatives: [
        {
          text: "Built accessible React interfaces used by 10 product teams",
          incorporated_keywords: ["accessible", "WCAG"],
        },
        {
          text: "Delivered React interfaces supporting 10 product teams",
          incorporated_keywords: ["React"],
        },
      ],
    },
    {
      bullet_id: "project-bullet-1",
      original_text: "Published reusable components for 6 products",
      alternatives: [
        {
          text: "Published accessible reusable components for 6 products",
          incorporated_keywords: ["accessible"],
        },
        {
          text: "Delivered reusable components across 6 product teams",
          incorporated_keywords: ["product"],
        },
      ],
    },
  ],
};

export async function mockApi(
  page: Page,
  options: { streamErrors?: string[]; analysisFails?: boolean; delayStreamMs?: number } = {},
) {
  let streamCall = 0;
  await page.route("**/api/v1/config", (route) =>
    route.fulfill({
      json: {
        max_upload_bytes: 4 * 1024 * 1024,
        accepted_extensions: ["pdf", "docx"],
        vision_fallback_available: true,
        gemini_model: "gemini-3.1-flash-lite",
      },
    }),
  );
  await page.route("**/api/v1/resumes/ingest/stream", async (route) => {
    if (options.delayStreamMs)
      await new Promise((resolve) => setTimeout(resolve, options.delayStreamMs));
    const errorCode = options.streamErrors?.[streamCall++];
    const lines = errorCode
      ? [
          {
            type: "progress",
            stage: "parsing",
            sequence: 1,
            message: "Parsing local document structure…",
          },
          {
            type: "error",
            error: {
              code: errorCode,
              message:
                errorCode === "vision_consent_required"
                  ? "This PDF requires Gemini vision. Enable the vision fallback to continue."
                  : "The document stream stopped unexpectedly.",
              retryable: errorCode !== "vision_consent_required",
            },
          },
        ]
      : [
          {
            type: "progress",
            stage: "parsing",
            sequence: 1,
            message: "Parsing local document structure…",
          },
          {
            type: "progress",
            stage: "structuring",
            sequence: 2,
            message: "Structuring resume data with Gemini…",
          },
          {
            type: "progress",
            stage: "validating",
            sequence: 3,
            message: "Validating factual resume structure…",
          },
          {
            type: "result",
            data: {
              resume,
              extraction_method: "pdf_text",
              warnings: ["Verify multi-column ordering."],
            },
          },
        ];
    await route.fulfill({
      status: 200,
      contentType: "application/jsonl",
      body: `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`,
    });
  });
  await page.route("**/api/v1/analyses", (route) =>
    options.analysisFails
      ? route.fulfill({
          status: 503,
          json: {
            code: "gemini_provider_error",
            message: "Analysis is unavailable.",
            retryable: true,
          },
        })
      : route.fulfill({ json: analysis }),
  );
  await page.route("**/api/v1/rewrites", async (route) => {
    const request = route.request().postDataJSON() as { bullet_ids: string[] };
    await route.fulfill({
      json: { items: rewrites.items.filter((item) => request.bullet_ids.includes(item.bullet_id)) },
    });
  });
  await page.route("**/api/v1/documents/docx", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      body: Buffer.from("PK mocked Beat ATS document"),
    }),
  );
}

export async function completeUpload(page: Page) {
  await page.getByLabel("Resume file").setInputFiles({
    name: "resume.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF mocked resume"),
  });
  await page
    .getByRole("textbox", { name: /Target job description/ })
    .fill(
      "Senior frontend engineer role requiring React, TypeScript, WCAG, product strategy, and accessible B2B product delivery.",
    );
  await page.getByRole("checkbox", { name: /I consent to processing/ }).check();
  await page.getByRole("button", { name: "Review extracted resume" }).click();
  await page.getByRole("heading", { name: "Verify what was extracted" }).waitFor();
}

export async function reachTailor(page: Page) {
  await completeUpload(page);
  await page.getByRole("button", { name: /Request advisory comparison/ }).click();
  await page.getByRole("heading", { name: "Tailor the wording, preserve the truth" }).waitFor();
}
