import { fireEvent, render, screen } from "@testing-library/react";
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
    expect(screen.getAllByText(/4 MiB/)).not.toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Review extracted resume" }));
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
    await user.click(screen.getByRole("button", { name: "Review extracted resume" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Only PDF and DOCX");
  });

  it("reports the deployment size limit for an accepted file type", async () => {
    const user = userEvent.setup();
    render(
      <UploadStep
        config={{
          max_upload_bytes: 4,
          accepted_extensions: ["pdf"],
          vision_fallback_available: false,
          gemini_model: "gemini-3.1-flash-lite",
        }}
        busy={false}
        onUpload={vi.fn()}
      />,
    );
    await user.upload(screen.getByLabelText("Resume file"), new File(["12345"], "resume.pdf"));
    await user.click(screen.getByRole("button", { name: "Review extracted resume" }));
    expect(screen.getByRole("alert")).toHaveTextContent("larger than the deployment limit");
    expect(screen.getByRole("checkbox", { name: /Visual PDF processing/ })).toBeDisabled();
  });

  it("requires a complete description and explicit consent", async () => {
    const user = userEvent.setup();
    render(
      <UploadStep
        config={{
          max_upload_bytes: 1024,
          accepted_extensions: ["pdf"],
          vision_fallback_available: true,
          gemini_model: "gemini-3.1-flash-lite",
        }}
        busy={false}
        onUpload={vi.fn()}
      />,
    );
    await user.upload(screen.getByLabelText("Resume file"), new File(["pdf"], "resume.pdf"));
    await user.type(screen.getByRole("textbox", { name: /Target job description/ }), "Too short");
    await user.click(screen.getByRole("button", { name: "Review extracted resume" }));
    expect(screen.getByRole("alert")).toHaveTextContent("at least 50 characters");
    expect(screen.getByRole("alert")).toHaveTextContent("Consent is required");
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
      screen.getByRole("textbox", { name: /Target job description/ }),
      "A complete frontend engineering role description with responsibilities and requirements.",
    );
    await user.click(screen.getByLabelText(/I consent/));
    await user.click(screen.getByRole("button", { name: "Review extracted resume" }));
    expect(onUpload).toHaveBeenCalledWith(
      expect.any(File),
      expect.stringContaining("complete frontend"),
      true,
      false,
    );
  });

  it("supports drag and drop, optional vision consent, and clearing the file", async () => {
    const user = userEvent.setup();
    render(
      <UploadStep
        config={{
          max_upload_bytes: 1024,
          accepted_extensions: ["pdf"],
          vision_fallback_available: true,
          gemini_model: "gemini-3.1-flash-lite",
        }}
        busy={false}
        onUpload={vi.fn()}
      />,
    );
    const dropzone = screen.getByText("Drop your resume here").parentElement!;
    await user.click(screen.getByRole("button", { name: "Browse files" }));
    fireEvent.dragEnter(dropzone);
    fireEvent.dragOver(dropzone);
    expect(dropzone).toHaveClass("is-dragging");
    fireEvent.dragLeave(dropzone, { relatedTarget: document.body });
    fireEvent.dragEnter(dropzone);
    fireEvent.drop(dropzone, { dataTransfer: { files: [new File(["pdf"], "resume.pdf")] } });
    expect(screen.getByText("resume.pdf")).toBeVisible();
    await user.click(screen.getByRole("checkbox", { name: /Visual PDF processing/ }));
    expect(screen.getByRole("checkbox", { name: /Visual PDF processing/ })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Clear selected resume" }));
    expect(screen.getByText("Drop your resume here")).toBeVisible();
  });

  it("shows focus-managed streamed progress and allows cancellation", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <UploadStep
        config={{
          max_upload_bytes: 1024,
          accepted_extensions: ["pdf"],
          vision_fallback_available: true,
          gemini_model: "gemini-3.1-flash-lite",
        }}
        busy
        uploadProgress={100}
        ingestionPhase={{
          type: "progress",
          stage: "structuring",
          sequence: 2,
          message: "Structuring resume data with Gemini…",
        }}
        onCancel={onCancel}
        onUpload={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Building your editable resume" });
    expect(dialog.querySelector(".processing-card")).toHaveFocus();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "75");
    await user.click(screen.getByRole("button", { name: "Cancel processing" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
