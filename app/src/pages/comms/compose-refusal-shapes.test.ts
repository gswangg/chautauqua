// DEC-317 amendment (wave 60): enumerates the THREE fields-map refusal
// shapes src/routes/comms/preview.ts and src/routes/comms/send.ts can emit
// (`not scheduled`, `no eligible recipients`, and the `missing merge
// fields: …` family) and asserts ComposeWizard.tsx source carries a
// named-resolution branch for each -- keyed on the message strings the
// server actually throws, not on prose, so a fourth shape landing without a
// resolver fails this test rather than silently falling into the generic
// `setError(err.message)` branch.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const composeWizardSource = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'ComposeWizard.tsx'),
  'utf8',
);

// The exact message literals the server routes key their fields maps by --
// see src/routes/comms/compose-core.ts (unscheduledIcsFields,
// noRecipientFields) and missingToFields.
const REFUSAL_SHAPES = [
  { name: 'not scheduled (DEC-051 ICS preflight)', keyedOn: `'not scheduled'` },
  { name: 'no eligible recipients (DEC-317 amendment wave 60)', keyedOn: `'no eligible recipients'` },
  { name: 'missing merge fields: … (DEC-793/DEC-856)', keyedOn: `missing merge fields: ` },
] as const;

describe('ComposeWizard resolves every compose-route fields-map refusal shape by name', () => {
  it.each(REFUSAL_SHAPES)('carries a resolution branch keyed on $name', ({ keyedOn }) => {
    expect(composeWizardSource).toContain(keyedOn);
  });

  it('has exactly three extract* helpers reading err.fields (a fourth shape must add a fourth helper, not fall through)', () => {
    const matches = composeWizardSource.match(/function extract\w+\(err: ApiError\)/g) ?? [];
    expect(matches.sort()).toEqual(
      ['function extractIcsUnscheduledIds(err: ApiError)', 'function extractMissingMergeFieldLines(err: ApiError)', 'function extractNoRecipientRefs(err: ApiError)'].sort(),
    );
  });

  it('runPreview and send both consult all three extractors before falling back to the generic error banner', () => {
    const runPreviewBody = composeWizardSource.slice(
      composeWizardSource.indexOf('async function runPreview'),
      composeWizardSource.indexOf('async function send('),
    );
    const sendBody = composeWizardSource.slice(
      composeWizardSource.indexOf('async function send('),
      composeWizardSource.indexOf('function reset()'),
    );
    for (const body of [runPreviewBody, sendBody]) {
      expect(body).toContain('extractIcsUnscheduledIds(err)');
      expect(body).toContain('extractMissingMergeFieldLines(err)');
      expect(body).toContain('extractNoRecipientRefs(err)');
    }
  });

  // DEC-317 amendment (wave 18): a named branch existing somewhere in the
  // source isn't enough -- runPreview can be called from step 'template'
  // (the "Next: preview" button), so a refusal it can throw must render on
  // a surface mounted on every step from which that call can be issued, not
  // only inside the step === 'preview' / step === 'sent' panels.
  it('missing-merge-fields and no-eligible-recipients render inside the top error banner, mounted on every step', () => {
    const topBannerRegion = composeWizardSource.slice(
      composeWizardSource.indexOf('return (\n    <div className="chq-compose-wizard"'),
      composeWizardSource.indexOf("{step === 'select' &&"),
    );
    // The top banner (keyed on {error}, itself gated on no `step ===`
    // condition) is where both shapes render -- reachable regardless of
    // which step issued the request.
    expect(topBannerRegion).toContain('missingMergeFieldLines');
    expect(topBannerRegion).toContain('noRecipientRefs');
    expect(topBannerRegion).not.toMatch(/step === 'select'|step === 'template'|step === 'preview'|step === 'sent'/);
  });

  it('the ics-unscheduled refusal renders a surface outside the preview/sent-only panels, reachable from the step that issued the request', () => {
    const topBannerRegion = composeWizardSource.slice(
      composeWizardSource.indexOf('return (\n    <div className="chq-compose-wizard"'),
      composeWizardSource.indexOf("{step === 'select' &&"),
    );
    expect(topBannerRegion).toContain('icsUnscheduledIds');
    // Gated on "not on the two steps that already have their own panel for
    // it" -- never narrowed to a single specific step, since runPreview can
    // fire this refusal from 'select' (via ?ids= handoff) or 'template'.
    expect(topBannerRegion).toMatch(/step !== 'preview' && step !== 'sent'/);
    // Carries the same escape affordances as the preview-step panel: named
    // via submissionLabel, and a partial-send escape when some recipients
    // are still eligible.
    expect(topBannerRegion).toContain('submissionLabel(id, preview)');
    expect(topBannerRegion).toContain('scheduledCount > 0');
  });
});
