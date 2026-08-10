import { useState } from 'react';
import type { RenderedRecipient } from './types';

export function PreviewPane({ items }: { items: RenderedRecipient[] }) {
  const [index, setIndex] = useState(0);

  if (items.length === 0) {
    return <p>No recipients to preview.</p>;
  }

  const clamped = Math.min(index, items.length - 1);
  const current = items[clamped];
  if (!current) return null;

  return (
    <div className="chq-preview-pane">
      <div className="chq-preview-nav">
        <button type="button" disabled={clamped <= 0} onClick={() => setIndex((i) => i - 1)}>
          Previous
        </button>
        <span>
          Recipient {clamped + 1} of {items.length}
        </span>
        <button type="button" disabled={clamped >= items.length - 1} onClick={() => setIndex((i) => i + 1)}>
          Next
        </button>
      </div>
      <div className="chq-preview-card">
        <div>
          <strong>To:</strong> {current.name} &lt;{current.email}&gt;
        </div>
        <div>
          <strong>Subject:</strong> {current.subject}
        </div>
        <pre className="chq-preview-body">{current.text}</pre>
      </div>
    </div>
  );
}
