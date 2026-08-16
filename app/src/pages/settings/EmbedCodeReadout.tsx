// DEC-785 (wave 4 amendment): one shared embed code readout used by both
// the live builder (EmbedsPanel) and the saved-embeds "Get code" disclosure
// (SavedEmbedsPanel) -- two panels rendering the same URL/snippet object
// must not each own their own copy anatomy. Behaviour (copy, the 2s
// "Copied!" flip, the copy-failure select-and-focus fallback) is lifted
// verbatim from EmbedsPanel's former inline block; the boxed-readout shape
// (one .chq-embeds-output-block, ui-monospace on #FAF8F2 inside a #D3CFC0
// rule, Copy as a bordered secondary in the footer action row) matches
// DESIGN-RULINGS.md:221 and the w19-c/DEC-785 amendment this component now
// carries for both consumers instead of one.
import { useEffect, useRef, useState } from 'react';
import { copyText } from '../../lib/clipboard';

export function EmbedCodeReadout({
  url,
  snippet,
  previewHref,
}: {
  url: string;
  snippet: string;
  // Optional: EmbedsPanel's live builder shows a Preview link beside the
  // two Copy actions; SavedEmbedsPanel's read-only "Get code" row does not
  // ask for one. Omitting the prop omits the control, nothing else changes.
  previewHref?: string;
}) {
  const [copyResult, setCopyResult] = useState<{ target: 'url' | 'snippet'; ok: boolean; text: string } | null>(
    null,
  );
  const failedCopyRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (copyResult && !copyResult.ok) {
      failedCopyRef.current?.focus();
      failedCopyRef.current?.select();
    }
  }, [copyResult]);

  async function handleCopy(target: 'url' | 'snippet', text: string) {
    const ok = await copyText(text);
    setCopyResult({ target, ok, text });
    if (ok) {
      window.setTimeout(() => setCopyResult((current) => (current?.target === target ? null : current)), 2000);
    }
  }

  return (
    <div className="chq-embeds-output-block">
      <span className="chq-settings-eyebrow">Snippet</span>
      <code>{snippet}</code>
      <div className="chq-embeds-output-actions">
        <button
          type="button"
          className="chq-btn chq-btn-secondary"
          onClick={() => void handleCopy('snippet', snippet)}
        >
          {copyResult?.target === 'snippet' && copyResult.ok ? 'Copied!' : 'Copy snippet'}
        </button>
        <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => void handleCopy('url', url)}>
          {copyResult?.target === 'url' && copyResult.ok ? 'Copied!' : 'Copy URL'}
        </button>
        {previewHref ? (
          <a className="chq-btn chq-btn-tertiary" href={previewHref} target="_blank" rel="noreferrer">
            Preview
          </a>
        ) : null}
      </div>
      <div role="status" aria-live="polite" className="chq-copy-status">
        {copyResult ? (copyResult.ok ? 'Copied' : 'Copy failed — select the text and copy it manually') : null}
      </div>
      {copyResult && !copyResult.ok ? (
        <input
          id="embed-copy-fallback"
          ref={failedCopyRef}
          className="chq-input"
          readOnly
          value={copyResult.text}
          onFocus={(e) => e.currentTarget.select()}
          aria-label={`${copyResult.target === 'url' ? 'URL' : 'Snippet'} to copy manually`}
        />
      ) : null}
    </div>
  );
}
