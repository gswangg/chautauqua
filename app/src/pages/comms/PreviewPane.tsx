import { formatIcsChip } from './icsChip';
import type { RenderedRecipient } from './types';

// Prev/Next navigation lives on the surrounding "Preview" section header
// (ComposeWizard.tsx) per the mock's step-3 layout — this component just
// renders the single current recipient's card.
//
// DEC-732 (eval-findings 44d/68): when the compose request asked for a
// calendar invite, the preview must say so for THIS recipient one way or
// the other -- "Scheduled" with the invite line, or "No slot" -- so what
// the organizer previews is exactly what send() will do. Silently omitting
// both when the recipient has no slot is what let the preview and the send
// (which quietly skips the ICS attachment) disagree.
// DEC-883: splits the rendered body into paragraphs (blank-line separated,
// matching how renderTemplate/formatFeedback join lines) and wraps the
// paragraph(s) matching this recipient's own resolved `vars.feedback` value
// in a quoted "Reviewer feedback, merged" block. This is preview chrome
// only -- it never re-derives or re-formats the feedback text, and the
// SENT body (item.text itself) is untouched.
function renderBody(item: RenderedRecipient) {
  const feedback = item.vars?.feedback;
  if (feedback === undefined) {
    return <pre className="chq-comms-preview-body">{item.text}</pre>;
  }
  const paragraphs = item.text.split(/\n\n+/);
  const feedbackTrimmed = feedback.trim();
  return (
    <div className="chq-comms-preview-body">
      {paragraphs.map((para, idx) =>
        para.trim() === feedbackTrimmed ? (
          <blockquote key={idx} className="chq-comms-feedback">
            <span className="chq-comms-feedback-eyebrow">Reviewer feedback, merged</span>
            <span>{para}</span>
          </blockquote>
        ) : (
          <pre key={idx} className="chq-comms-preview-body-paragraph">
            {para}
          </pre>
        ),
      )}
    </div>
  );
}

export function PreviewPane({ item, attachIcs = false }: { item: RenderedRecipient | undefined; attachIcs?: boolean }) {
  if (!item) {
    return <p>No recipients to preview.</p>;
  }

  return (
    <div className="chq-comms-preview-card">
      <div className="chq-comms-preview-field">
        <span className="chq-comms-preview-field-label">To</span>
        <span className="chq-comms-preview-field-value">
          {item.name} &lt;{item.email}&gt;
          {attachIcs && (
            <span className="chq-flag chq-comms-preview-ics-flag">{item.ics ? 'Scheduled' : 'No slot'}</span>
          )}
        </span>
      </div>
      <div className="chq-comms-preview-field">
        <span className="chq-comms-preview-field-label">Subject</span>
        <span className="chq-comms-preview-subject">{item.subject}</span>
      </div>
      {renderBody(item)}
      {attachIcs && item.ics && (
        <div className="chq-comms-preview-field chq-comms-preview-ics" role="note">
          Calendar invite: {formatIcsChip(item.ics)}
        </div>
      )}
      {attachIcs && !item.ics && (
        <div className="chq-comms-preview-field chq-comms-preview-ics" role="note">
          No slot yet — this recipient gets no calendar invite.
        </div>
      )}
    </div>
  );
}
