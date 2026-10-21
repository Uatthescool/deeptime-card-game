import type { OverrideCategory } from "../../engine/index.ts";
import type { Explanation } from "../legality.ts";

const CATEGORY_NAMES: Record<OverrideCategory, string> = {
  diet: "Diet",
  period: "Time Period",
  taxon: "Primary Taxon",
  tag: "Tag",
};

/** These blockers are already shown by the category grid, so the reason list skips them. */
const SHOWN_IN_GRID = new Set(["too-few-matches", "level"]);

function Mark({ ok }: { ok: boolean }) {
  return (
    <span className={`legality-mark ${ok ? "ok" : "no"}`} aria-label={ok ? "Matches" : "Doesn't match"}>
      {ok ? "✓" : "✕"}
    </span>
  );
}

/** Explains why a move is or isn't allowed: the override breakdown, any blockers, and near-miss hints. */
export function LegalityPanel({ explanation, className = "" }: { explanation: Explanation; className?: string }) {
  const override = explanation.placement?.override;
  const breakdown = override?.explanations;
  const hints = explanation.placement?.hints ?? [];
  const reasons = breakdown
    ? explanation.reasons.filter((reason) => !SHOWN_IN_GRID.has(reason.code))
    : explanation.reasons;

  return (
    <section
      className={`legality-panel ${explanation.legal ? "is-legal" : "is-blocked"} ${className}`}
      aria-live="polite"
      aria-label="Move explanation"
    >
      <header>
        <strong>{explanation.title}</strong>
        {breakdown && <small>Needs 3 of 4 matches · {override!.matchCount} here</small>}
      </header>

      {breakdown && (
        <ul className="legality-grid">
          {(Object.keys(CATEGORY_NAMES) as OverrideCategory[]).map((category) => (
            <li key={category}>
              <Mark ok={override!.matches[category]} />
              <span>
                <b>{CATEGORY_NAMES[category]}</b> {breakdown[category]}
              </span>
            </li>
          ))}
          <li className="legality-level">
            <Mark ok={override!.levelLegal} />
            <span>
              <b>Level</b> {breakdown.level}
            </span>
          </li>
        </ul>
      )}

      {reasons.length > 0 && (
        <ul className="legality-reasons">
          {reasons.map((reason) => (
            <li key={reason.code + reason.text}>{reason.text}</li>
          ))}
        </ul>
      )}

      {hints.map((hint) => (
        <p className="legality-hint" key={hint.cardUid}>
          <b>Idea:</b> {hint.text}
        </p>
      ))}
    </section>
  );
}
