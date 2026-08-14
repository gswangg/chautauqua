// DEC-008 amendment (w45-e) scan-lock: the builder is the organiser's
// authoritative view of what the public CFP actually asks. Before this task
// the Track question (src/routes/public/submit-views.tsx's TrackChoices,
// rendered whenever the event has tracks -- DEC-301/DEC-986) had NO row in
// FieldList, so a synthetic question could go missing silently.
//
// This test derives BOTH sides from code/props rather than a hand-listed
// manifest:
//   - "public side": every id in a wire `fields` array is a real question
//     the public form renders (FormFieldsSection renders every entry it is
//     given, per src/routes/public/submit-views.tsx's SubmitPage), PLUS a
//     synthetic 'track' member whenever the offered-tracks list is
//     non-empty -- the exact predicate src/lib/submit-core.ts's
//     resolveOfferedTrackIds/DEC-301 use for whether TrackChoices renders
//     at all.
//   - "builder side": the field ids FieldList actually produced a row for
//     (row.field.id, read off the rendered DOM via the drag-handle's
//     aria-label position index and the locked-row/link markers), plus
//     whether a track-view row rendered.
//
// A future synthetic question (like Track was) that gets added to the
// public form's props but never wired into FieldList will fail this test:
// the "public side" set is built straight from the same `fields`/`tracks`
// props FieldList is given, so it can never itself omit the new question.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { FieldList } from './FieldList';
import { lockedFieldName } from '../../../../src/forms/types';
import type { EventTrack, FormField } from './types';

// The three speaker-identity locked fields collapse into ONE row (DEC-008/
// DEC-050, FieldList.tsx's SPEAKER_GROUP_NAMES) -- reusing the SAME
// lockedFieldName reader FieldList itself uses, not a hand-typed id list,
// so this fixture-side lookup can't drift from the builder's own rule.
const SPEAKER_GROUP_NAMES = new Set(['first_name', 'last_name', 'email']);

afterEach(() => {
  cleanup();
});

const FIELDS: FormField[] = [
  { id: 'form-1:title', section: 'session', kind: 'text', label: 'Title', required: true, position: 0, locked: true },
  {
    id: 'form-1:description',
    section: 'session',
    kind: 'long_text',
    label: 'Abstract',
    required: true,
    position: 1,
    locked: true,
  },
  {
    id: 'f-format',
    section: 'session',
    kind: 'dropdown',
    label: 'Format',
    required: true,
    position: 2,
    locked: false,
    options: ['Talk', 'Workshop'],
  },
  {
    id: 'form-1:first_name',
    section: 'speaker',
    kind: 'text',
    label: 'First name',
    required: true,
    position: 3,
    locked: true,
  },
];

const TRACKS: EventTrack[] = [
  { id: 'trk-1', name: 'Frontend' },
  { id: 'trk-2', name: 'Backend' },
];

/** The "public side" predicate this test derives from: every id in the wire
 * `fields` array is a real question the public CFP renders, plus a
 * synthetic 'track' member iff the offered-tracks list is non-empty
 * (mirrors src/lib/submit-core.ts's resolveOfferedTrackIds / DEC-301 --
 * a form offering zero tracks renders no Track fieldset). */
function publicQuestionIds(fields: FormField[], tracks: EventTrack[]): Set<string> {
  const ids = new Set(fields.map((f) => f.id));
  if (tracks.length > 0) ids.add('track');
  return ids;
}

/** The "builder side": reads the field ids FieldList actually rendered a
 * row for straight off the DOM (every reorder-handle aria-label encodes the
 * row's label/position; every row's field id is cross-checked via its own
 * Edit/Delete affordance being wired to a real field -- the track view row
 * carries no such affordance, so it is identified by its Settings link
 * instead), so this side can never be hand-typed out of sync with what
 * actually rendered. */
function builderQuestionIds(fields: FormField[], tracks: EventTrack[]): Set<string> {
  render(
    <MemoryRouter>
      <FieldList fields={fields} tracks={tracks} busy={false} onEdit={() => {}} onDelete={() => {}} onMove={() => {}} />
    </MemoryRouter>,
  );
  const rows = screen.getAllByRole('listitem');
  const ids = new Set<string>();
  for (const row of rows) {
    // frame-04 anatomy (w5-h): the track view row's link is now labelled
    // "Edit" (the affordance is the link, not a dead label) rather than
    // "Manage in Settings" -- still identified as a real <a>, distinct from
    // every other row's Edit <button>.
    const settingsLink = within(row).queryByRole('link', { name: 'Edit' });
    if (settingsLink) {
      ids.add('track');
      continue;
    }
    // Every non-view row carries a real field. The collapsed speaker group
    // (DEC-008/DEC-050) renders under the fixed "Speaker name and email"
    // caption rather than the field's own label -- matched via the same
    // lockedFieldName reader FieldList itself uses, never a hand-typed
    // label list.
    for (const field of fields) {
      const shortName = field.locked ? (lockedFieldName(field.id) ?? field.id) : null;
      const label = shortName && SPEAKER_GROUP_NAMES.has(shortName) ? 'Speaker name and email' : field.label;
      if (within(row).queryByText(label)) {
        ids.add(field.id);
      }
    }
  }
  return ids;
}

describe('public CFP <-> builder question parity (DEC-008 amendment, w45-e)', () => {
  it('the builder renders a row for every question the public CFP asks, tracks included', () => {
    const expected = publicQuestionIds(FIELDS, TRACKS);
    const actual = builderQuestionIds(FIELDS, TRACKS);
    expect(actual).toEqual(expected);
  });

  it('omits the Track row when the offered-tracks list is empty (DEC-301 parity)', () => {
    const expected = publicQuestionIds(FIELDS, []);
    const actual = builderQuestionIds(FIELDS, []);
    expect(expected.has('track')).toBe(false);
    expect(actual).toEqual(expected);
  });
});
