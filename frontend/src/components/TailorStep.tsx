import { useEffect, useState } from "react";
import type { BulletRewriteResponse, ResumeDocument } from "../types";

interface Props {
  resume: ResumeDocument;
  rewrites: BulletRewriteResponse | null;
  selectedIds: string[];
  choices: Record<string, string>;
  busy: boolean;
  onRequest: (ids: string[]) => void;
  onChoice: (id: string, text: string) => void;
  onApply: (choices: Record<string, string>) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function TailorStep({
  resume,
  rewrites,
  selectedIds,
  choices,
  busy,
  onRequest,
  onChoice,
  onApply,
  onBack,
  onContinue,
}: Props) {
  const [selected, setSelected] = useState(selectedIds);
  const [localChoices, setLocalChoices] = useState(choices);
  useEffect(() => setSelected(selectedIds), [selectedIds]);
  useEffect(() => setLocalChoices(choices), [choices]);
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length < 10
          ? [...current, id]
          : current,
    );
  const choose = (id: string, text: string) => {
    setLocalChoices((current) => ({ ...current, [id]: text }));
    onChoice(id, text);
  };
  return (
    <section className="reading-column wide-column" aria-labelledby="tailor-title">
      <p className="eyebrow">CHANGE REGISTER</p>
      <h2 id="tailor-title">Choose the bullets worth tailoring</h2>
      <p className="lead">
        Select only bullets whose underlying experience genuinely supports this role. Gemini
        proposes alternatives; it will not apply them.
      </p>
      <form
        className="form-sheet"
        onSubmit={(event) => {
          event.preventDefault();
          if (selected.length) onRequest(selected);
        }}
      >
        <p className="limit-note">{selected.length} of 10 bullets selected</p>
        {(resume.work_experience ?? []).map((role) => (
          <fieldset className="selection-group" key={role.id}>
            <legend>
              {role.title} — {role.employer}
            </legend>
            {(role.bullets ?? []).map((bullet) => (
              <label className="checkbox-row source-select" key={bullet.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(bullet.id)}
                  onChange={() => toggle(bullet.id)}
                  disabled={busy || (!selected.includes(bullet.id) && selected.length >= 10)}
                />
                <span>{bullet.text}</span>
              </label>
            ))}
          </fieldset>
        ))}
        <button
          className="button button-primary"
          type="submit"
          disabled={busy || selected.length === 0}
        >
          {busy ? "Drafting alternatives…" : "Generate alternatives"}
        </button>
      </form>
      {rewrites && (
        <section className="rewrite-register" aria-labelledby="rewrite-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">PROPOSED WORDING</p>
              <h3 id="rewrite-title">Review alternatives</h3>
            </div>
            <span className="muted">Nothing changes until you apply a choice.</span>
          </div>
          {rewrites.items.map((item) => (
            <article className="rewrite-item" key={item.bullet_id}>
              <p className="field-label">Source bullet</p>
              <p className="source-text">{item.original_text}</p>
              <fieldset>
                <legend>Choose one alternative</legend>
                {item.alternatives.map((alternative) => (
                  <label className="radio-row" key={alternative.text}>
                    <input
                      type="radio"
                      name={`rewrite-${item.bullet_id}`}
                      value={alternative.text}
                      checked={localChoices[item.bullet_id] === alternative.text}
                      onChange={() => choose(item.bullet_id, alternative.text)}
                    />
                    <span>{alternative.text}</span>
                  </label>
                ))}
              </fieldset>
            </article>
          ))}
          <button
            className="button button-primary"
            type="button"
            onClick={() => onApply(localChoices)}
            disabled={busy}
          >
            Apply selected alternatives
          </button>
        </section>
      )}
      <div className="form-actions">
        <button className="button button-secondary" type="button" onClick={onBack}>
          Back to review
        </button>
        <button className="button button-secondary" type="button" onClick={onContinue}>
          Continue without more rewrites
        </button>
      </div>
    </section>
  );
}
