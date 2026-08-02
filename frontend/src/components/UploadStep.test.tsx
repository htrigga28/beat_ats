import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UploadStep } from "./UploadStep";

describe("UploadStep", () => {
  it("keeps the form visible while deployment settings load", () => {
    render(<UploadStep config={null} busy={false} onUpload={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading deployment settings");
  });

  it("shows deployment limits and blocks incomplete submissions", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    render(
      <UploadStep
        config={{
          max_upload_bytes: 4 * 1024 * 1024,
          accepted_extensions: ["pdf", "docx"],
          vision_fallback_available: true,
          gemini_model: "gemini-3.1-flash-lite",
        }}
        busy={false}
        onUpload={onUpload}
      />,
    );
    expect(screen.getAllByText(/4 MB/)).not.toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Extract resume" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a PDF or DOCX");
    expect(onUpload).not.toHaveBeenCalled();
  });

  it("reports file-specific validation errors before transmission", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    render(
      <UploadStep
        config={{
          max_upload_bytes: 4,
          accepted_extensions: ["pdf"],
          vision_fallback_available: true,
          gemini_model: "gemini-3.1-flash-lite",
        }}
        busy={false}
        onUpload={onUpload}
      />,
    );
    await user.upload(screen.getByLabelText("Resume file"), new File(["12345"], "resume.docx"));
    await user.click(screen.getByRole("button", { name: "Extract resume" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Only PDF and DOCX");
  });

  it("submits a valid PDF only after the consent gate is checked", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    render(
      <UploadStep
        config={{
          max_upload_bytes: 4 * 1024 * 1024,
          accepted_extensions: ["pdf", "docx"],
          vision_fallback_available: true,
          gemini_model: "gemini-3.1-flash-lite",
        }}
        busy={false}
        onUpload={onUpload}
      />,
    );
    await user.upload(
      screen.getByLabelText("Resume file"),
      new File(["pdf"], "resume.pdf", { type: "application/pdf" }),
    );
    await user.type(
      screen.getByLabelText("Target job description"),
      "A complete frontend engineering role description with responsibilities and requirements.",
    );
    await user.click(screen.getByLabelText(/I consent/));
    await user.click(screen.getByRole("button", { name: "Extract resume" }));
    expect(onUpload).toHaveBeenCalledWith(
      expect.any(File),
      expect.stringContaining("complete frontend"),
      true,
      false,
    );
  });
});
