import createClient from "openapi-fetch";
import type { paths } from "./api-types";
import type { ApiErrorPayload, ResumeDocument } from "./types";

const client = createClient<paths>({ baseUrl: "" });

export function normalizeError(
  error: unknown,
  response?: Response,
): import("./types").NormalizedError {
  const body = (error && typeof error === "object" ? error : {}) as Record<string, unknown>;
  const detail = (
    body.detail && typeof body.detail === "object" ? body.detail : body
  ) as Partial<ApiErrorPayload>;
  return {
    code: typeof detail.code === "string" ? detail.code : "request_failed",
    message:
      typeof detail.message === "string" ? detail.message : "The request could not be completed.",
    retryable: detail.retryable === true,
    requestId: response?.headers.get("x-request-id") ?? undefined,
  };
}

async function readJson<T>(
  request: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  try {
    const result = await request;
    if (result.error !== undefined) throw normalizeError(result.error, result.response);
    if (result.data === undefined) throw normalizeError({}, result.response);
    return result.data;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) throw error;
    throw normalizeError({ message: "The private API is unavailable. Try again." });
  }
}

export function getConfig(signal?: AbortSignal) {
  return readJson<import("./types").RuntimeConfig>(
    client.GET("/api/v1/config", { signal }) as never,
  );
}

export function ingestResume(formData: FormData, signal?: AbortSignal) {
  return readJson<{
    resume: import("./types").ResumeDocument;
    extraction_method: string;
    warnings: string[];
  }>(client.POST("/api/v1/resumes/ingest", { body: formData as never, signal }) as never);
}

export function analyzeResume(
  resume: ResumeDocument,
  jobDescription: string,
  aiProcessingConsent: boolean,
  signal?: AbortSignal,
) {
  return readJson<import("./types").GapAnalysis>(
    client.POST("/api/v1/analyses", {
      body: { resume, job_description: jobDescription, ai_processing_consent: aiProcessingConsent },
      signal,
    }) as never,
  );
}

export function rewriteBullets(
  resume: ResumeDocument,
  jobDescription: string,
  bulletIds: string[],
  aiProcessingConsent: boolean,
  signal?: AbortSignal,
) {
  return readJson<import("./types").BulletRewriteResponse>(
    client.POST("/api/v1/rewrites", {
      body: {
        resume,
        job_description: jobDescription,
        bullet_ids: bulletIds,
        ai_processing_consent: aiProcessingConsent,
      },
      signal,
    }) as never,
  );
}

export async function generateDocx(resume: ResumeDocument, signal?: AbortSignal): Promise<Blob> {
  try {
    const result = await client.POST("/api/v1/documents/docx", {
      body: resume,
      parseAs: "blob",
      signal,
    });
    if (result.error !== undefined) throw normalizeError(result.error, result.response);
    if (!(result.data instanceof Blob)) throw normalizeError({}, result.response);
    return result.data;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) throw error;
    throw normalizeError({ message: "The private API is unavailable. Try again." });
  }
}
