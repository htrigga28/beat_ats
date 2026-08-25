import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");

export default defineConfig({
  testDir: "./e2e",
  testMatch: "integration.spec.ts",
  reporter: "line",
  use: { baseURL: "http://127.0.0.1:4173", trace: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      "npm --prefix frontend run build && python tests/prepare_integration_static.py && python -m uvicorn tests.integration_app:app --host 127.0.0.1 --port 4173",
    cwd: repositoryRoot,
    env: { ...process.env, GEMINI_API_KEY: "" },
    url: "http://127.0.0.1:4173/healthz",
    reuseExistingServer: false,
  },
});
