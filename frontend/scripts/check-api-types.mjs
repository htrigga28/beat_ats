import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "beat-ats-openapi-"));
const generated = join(directory, "api-types.ts");
try {
  execFileSync(
    "npx",
    ["openapi-typescript", "http://127.0.0.1:8000/openapi.json", "-o", generated],
    {
      stdio: "inherit",
    },
  );
  const expected = readFileSync("src/api-types.ts", "utf8");
  const actual = readFileSync(generated, "utf8");
  if (expected !== actual) {
    console.error("Generated API types are out of date. Run npm run generate:api-types.");
    process.exitCode = 1;
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
