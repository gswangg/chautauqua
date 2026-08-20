// SummarySection (w1-b, DEC-728): the settings drill-in primitive. Renders
// a numbered-section head (uppercase 11px/700/0.12em label above a 2px ink
// rule, with ONE right-aligned tertiary action on that same rule — DEC-706,
// same markup as the existing chq-settings-numbered/-section-head/-row
// classes used by Call for papers and People and roles) followed by
// read-only label:value rows; when `editing` is true it swaps the rows for
// `children` (the section's own edit form) instead.
//
// The action button opens the drilled edit view itself, writing
// `?section=<sectionKey>&edit=1` into the URL (DEC-728, precedent
// DEC-710: drill/tab selection is URL state, so a settings form is
// bookmarkable and Back leaves it). Callers read the same two params via
// useSearchParams to compute the `editing` prop they pass in — this keeps
// the write path in one place while still letting each panel decide what
// counts as "its" section and when to reset back to the summary (e.g. on
// save).
//
// DEC-728 amendment (wave 15): the action button always renders -- at rest
// it reads `actionLabel` and opens the drill.
//
// w7-c/DEC-728 amendment: while editing, the frame (Chautauqua
// Settings.dc.html :632-633, :723-724, :813-814, :894-895, :975-976,
// :1136-1137) draws NO panel head at all -- no <h2>, no second back
// control -- only the shell's `‹ <Section>` back link above the page's H1
// (Settings.tsx). The panel-level 'Back' button this file used to render
// while editing was a redundant second exit filed against
// DESIGN-RULINGS:247; a drill still always has a way out, it's just the
// one the frame draws instead of a second one this component minted.
// `aria-label={label}` stays on the <section> below so the accessible name
// the <h2> used to supply for the panel survives its removal.
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface SummarySectionRow {
  label: string;
  value: ReactNode;
  // DEC-896: the row's third grid column -- a short right-aligned note
  // ('Used in every public URL', 'Reviewers see only their assigned
  // tracks'). Collapses when absent: never an empty cell, never a
  // dangling separator, since the grid track it would occupy has no
  // content to size against.
  hint?: ReactNode;
  // DEC-747 amendment (wave 53): a caption-less row whose value spans the
  // full 820px settings column (e.g. Tracks and rooms' two-column grid)
  // needs the hosting `.chq-settings-row` itself to drop the label/hint
  // tracks -- otherwise its `width: 100%` child resolves against the
  // narrower `1fr` value cell, not the column. Added through the row's
  // own class prop rather than forking SummarySection per caller.
  rowClassName?: string;
}

export interface SummarySectionProps {
  sectionKey: string;
  label: string;
  rows: SummarySectionRow[];
  actionLabel: string;
  editing: boolean;
  children: ReactNode;
}

export function SummarySection({ sectionKey, label, rows, actionLabel, editing, children }: SummarySectionProps) {
  const [, setSearchParams] = useSearchParams();

  function openEdit() {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('section', sectionKey);
      params.set('edit', '1');
      return params;
    });
  }

  return (
    <section className="chq-settings-panel chq-settings-numbered" aria-label={label}>
      {editing ? null : (
        <div className="chq-settings-section-head">
          <h2>{label}</h2>
          <button type="button" className="chq-settings-section-action" onClick={openEdit}>
            {actionLabel}
          </button>
        </div>
      )}
      {editing
        ? children
        : rows.map((row) => (
            <div
              className={row.rowClassName ? `chq-settings-row ${row.rowClassName}` : 'chq-settings-row'}
              key={row.label}
            >
              <span className="chq-settings-row-label">{row.label}</span>
              <div className="chq-settings-row-value">{row.value}</div>
              {row.hint != null ? <div className="chq-settings-row-hint">{row.hint}</div> : null}
            </div>
          ))}
    </section>
  );
}
