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
});
