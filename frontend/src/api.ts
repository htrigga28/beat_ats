import createClient from "openapi-fetch";
import type { paths } from "./api-types";
import type {
  ApiErrorPayload,
  IngestionStreamEvent,
  ResumeDocument,
  ResumeIngestionResponse,
} from "./types";

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

interface IngestionCallbacks {
  onUploadProgress: (progress: number) => void;
  onEvent: (event: IngestionStreamEvent) => void;
}

export function ingestResumeStream(
  formData: FormData,
  callbacks: IngestionCallbacks,
  signal?: AbortSignal,
): Promise<ResumeIngestionResponse> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    let parsedOffset = 0;
    let result: ResumeIngestionResponse | null = null;
    let terminalError: import("./types").NormalizedError | null = null;

    const parseAvailableLines = (final = false) => {
      const available = request.responseText.slice(parsedOffset);
      const lastNewline = available.lastIndexOf("\n");
      const parseThrough = final ? available.length : lastNewline + 1;
      if (parseThrough <= 0) return;
      const chunk = available.slice(0, parseThrough);
      parsedOffset += parseThrough;
      for (const line of chunk.split("\n")) {
        if (!line.trim()) continue;
        const event = JSON.parse(line) as IngestionStreamEvent;
        callbacks.onEvent(event);
        if (event.type === "result") result = event.data;
        if (event.type === "error") terminalError = normalizeError(event.error, requestResponse());
      }
    };

    const requestResponse = () =>
      new Response(null, {
        status: request.status || 500,
        headers: { "x-request-id": request.getResponseHeader("x-request-id") ?? "" },
      });

    request.open("POST", "/api/v1/resumes/ingest/stream");
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) callbacks.onUploadProgress((event.loaded / event.total) * 100);
    });
    request.addEventListener("progress", () => {
      try {
        parseAvailableLines();
      } catch {
        request.abort();
        reject(normalizeError({ message: "The ingestion stream returned invalid data." }));
      }
    });
    request.addEventListener("load", () => {
      try {
        if (request.status < 200 || request.status >= 300) {
          const payload = request.responseText ? JSON.parse(request.responseText) : {};
          reject(normalizeError(payload, requestResponse()));
          return;
        }
        parseAvailableLines(true);
        if (terminalError) reject(terminalError);
        else if (result) resolve(result);
        else reject(normalizeError({ message: "The ingestion stream ended before a result." }));
      } catch {
        reject(normalizeError({ message: "The ingestion stream returned invalid data." }));
      }
    });
    request.addEventListener("error", () => {
      reject(normalizeError({ message: "The private API is unavailable. Try again." }));
    });
    request.addEventListener("abort", () => {
      reject(new DOMException("The request was cancelled.", "AbortError"));
    });
    signal?.addEventListener("abort", () => request.abort(), { once: true });
    request.send(formData);
  });
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
