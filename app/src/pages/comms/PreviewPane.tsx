import { formatIcsChip } from './icsChip';
import type { RenderedRecipient } from './types';

// Prev/Next navigation lives on the surrounding "Preview" section header
// (ComposeWizard.tsx) per the mock's step-3 layout — this component just
// renders the single current recipient's card.
export function PreviewPane({ item }: { item: RenderedRecipient | undefined }) {
  if (!item) {
    return <p>No recipients to preview.</p>;
  }

  return (
    <div className="chq-comms-preview-card">
      <div className="chq-comms-preview-field">
        <span className="chq-comms-preview-field-label">To</span>
        <span className="chq-comms-preview-field-value">
          {item.name} &lt;{item.email}&gt;
        </span>
      </div>
      <div className="chq-comms-preview-field">
        <span className="chq-comms-preview-field-label">Subject</span>
        <span className="chq-comms-preview-subject">{item.subject}</span>
      </div>
      <pre className="chq-comms-preview-body">{item.text}</pre>
      {item.ics && (
        <div className="chq-comms-preview-field chq-comms-preview-ics" role="note">
          Calendar invite: {formatIcsChip(item.ics)}
        </div>
      )}
    </div>
  );
}
