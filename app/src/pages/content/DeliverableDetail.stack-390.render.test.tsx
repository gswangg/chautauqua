// w15-tc (DEC-989 wave-159): docs/design/Chautauqua Content.dc.html's
// "Session · deliverable" frame (390) draws the body below the header/status
// band as ONE scrolling column, not the desktop two-column grid -- version
// rows (:393-403), then the 2px-ruled "Notes on the slides" label (:405-407),
// then comment rows (:408-416), then the dashed "Upload a file for the
// speaker" link (:417), then the note textbox (:418).
//
// jsdom applies no stylesheet (no @media), so this file asserts DOM
// STRUCTURE (the flex-hoisting wrapper classes exist in the tree, desktop
// two-column DOM is untouched) plus the stylesheet TEXT (content.css's
// terminal max-width:700px block carries the display:contents + order
// rules) -- the same split FilesLibrary.render.test.tsx:186 already uses.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DeliverableDetail } from './DeliverableDetail';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Content.dc.html');
const CSS_FILE = join(HERE, 'content.css');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims -- copied from Settings.frame-verdicts.render.
 * test.tsx's own `verbatimLine`. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

/** Isolate content.css's ONE terminal max-width:700px block, brace-matched
 * so a nested `{...}` inside it (e.g. a media-scoped selector body) never
 * truncates the slice early. Copied from DeliverableDetail.render.test.tsx's
 * own `detailPhoneBlock`. */
function phoneBlock(): string {
  const source = readFileSync(CSS_FILE, 'utf-8');
  const open = source.indexOf('@media (max-width: 700px) {');
  expect(open).toBeGreaterThan(-1);
  const bodyStart = source.indexOf('{', open) + 1;
  let depth = 1;
  let i = bodyStart;
  for (; i < source.length && depth > 0; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
  }
  return source.slice(bodyStart, i - 1);
}

// The phone block declares `.chq-content-group-body` (and a few other
// selectors this file targets) more than once -- an existing gap:16px rule
// plus this lane's own display/order rule further down (CSS legitimately
// cascades repeated selectors within one block). Concatenate every matching
// body rather than taking only the first, so a later declaration is never
// silently missed.
function phoneRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...css.matchAll(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, 'g'))];
  expect(matches.length, `no phone rule for \`${selector}\``).toBeGreaterThan(0);
  return matches.map((m) => m[1]).join('\n');
}

const SUBMISSION_ID = 'sub-stack-390';
const EVENT_ID = 'evt-stack-390';

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const files = [
  {
    id: 'file-slides-v1',
    submissionId: SUBMISSION_ID,
    kind: 'presentation',
    filename: 'slides-v1.pdf',
    sizeBytes: 90,
    contentType: 'application/pdf',
    previousFileId: null,
    uploadedByContactId: null,
    uploaderName: 'Speaker One',
    createdAt: 1700000100000,
    versionNo: 1,
  },
];

function mockBase() {
  return mockApi({
    [`GET /api/v1/submissions/${SUBMISSION_ID}/files`]: listEnvelope(files),
    [`GET /api/v1/submissions/${SUBMISSION_ID}`]: {
      id: SUBMISSION_ID,
      ref: 'S-090',
      updatedAt: 1700000300000,
      participants: [{ name: 'Ada Lovelace', contactId: 'contact-ada' }],
      slot: null,
    },
    [`GET /api/v1/files/file-slides-v1/comments`]: listEnvelope([]),
    'GET /api/v1/me': { userId: 'user-1', email: 'org@example.com', name: 'Org User', role: 'organizer', orgId: 'org-1' },
  });
}

describe('DeliverableDetail: 390 deliverable body is one linear stack (DEC-989 wave-159)', () => {
  it('frame citations: :406 the 2px-ruled "Notes on the slides" label, :417 the dashed upload link -- the order authority', () => {
    verbatimLine(
      406,
      '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">Notes on the slides</span>',
    );
    verbatimLine(
      417,
      '        <a href="#" style="margin-top:14px; border:1px dashed #BAB6A6; border-radius:6px; min-height:46px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600; color:#4E5C31">Upload a file for the speaker</a>',
    );
  });

  it('desktop DOM is unchanged: the two column wrappers still exist, each with its own PEER heading as first child', async () => {
    mockBase();
    const { container } = render(
      <MemoryRouter>
        <DeliverableDetail
          submissionId={SUBMISSION_ID}
          title="A talk"
          contentStatus="pending"
          onBack={() => {}}
          onContentStatusChange={() => {}}
        />
      </MemoryRouter>,
    );

    await screen.findByText('slides-v1.pdf');
    const groupBody = container.querySelector('.chq-content-group-body');
    const filesCol = container.querySelector('.chq-content-files-col');
    const commentsCol = container.querySelector('.chq-content-comments-col');
    expect(groupBody).not.toBeNull();
    expect(filesCol).not.toBeNull();
    expect(commentsCol).not.toBeNull();
    // Byte-identical desktop shape (DEC-901 amendment, w41-a): two columns,
    // each a real DOM box carrying its own heading as first child --
    // display:contents is a phone-only override (DEC-385 single-direction),
    // never applied above 700px.
    expect(groupBody!.children).toHaveLength(2);
    expect(groupBody!.children[0]).toBe(filesCol);
    expect(groupBody!.children[1]).toBe(commentsCol);
    expect(filesCol!.firstElementChild?.tagName).toBe('H2');
    expect(commentsCol!.firstElementChild?.tagName).toBe('H3');

    // CommentThread's own root also stays a real box on desktop -- the
    // comment list and the composer are its DOM children, not siblings of
    // the heading above them.
    const commentThread = commentsCol!.querySelector('.chq-comment-thread');
    expect(commentThread).not.toBeNull();
    expect(commentsCol!.contains(commentThread!)).toBe(true);
  });

  it('the terminal 700px block turns .chq-content-group-body into a flex column and hoists both columns plus CommentThread with display:contents', () => {
    const phone = phoneBlock();

    const groupBody = phoneRule(phone, '.chq-content-group-body');
    expect(groupBody).toMatch(/display:\s*flex/);
    expect(groupBody).toMatch(/flex-direction:\s*column/);

    const hoisted = phoneRule(
      phone,
      '.chq-content-group-body > .chq-content-files-col,\n  .chq-content-group-body > .chq-content-comments-col,\n  .chq-content-group-body .chq-comment-thread',
    );
    expect(hoisted).toMatch(/display:\s*contents/);
  });

  it('orders the frame\'s five body pieces in sequence: version rows < notes label < comment rows < upload link < note textbox', () => {
    const phone = phoneBlock();

    const versionListOrder = phoneRule(
      phone,
      '.chq-content-group-body .chq-content-files-col > .chq-content-version-list,\n  .chq-content-group-body .chq-content-files-col > .chq-error,\n  .chq-content-group-body .chq-content-files-col .chq-empty-block',
    );
    const notesLabelOrder = phoneRule(phone, '.chq-content-group-body .chq-content-notes-label');
    const commentListOrder = phoneRule(
      phone,
      '.chq-content-group-body .chq-content-comments-col .chq-content-comment-list,\n  .chq-content-group-body .chq-content-comments-col .chq-empty-block',
    );
    const uploadZoneOrder = phoneRule(phone, '.chq-content-group-body .chq-content-upload-zone');
    const composerOrder = phoneRule(phone, '.chq-content-group-body .chq-comment-composer');

    const num = (body: string): number => {
      const m = body.match(/order:\s*(-?\d+)/);
      expect(m, `no order: declaration in \`${body}\``).not.toBeNull();
      return Number(m![1]);
    };

    const versionRows = num(versionListOrder);
    const notesLabel = num(notesLabelOrder);
    const commentRows = num(commentListOrder);
    const uploadLink = num(uploadZoneOrder);
    const noteTextbox = num(composerOrder);

    expect(versionRows).toBeLessThan(notesLabel);
    expect(notesLabel).toBeLessThan(commentRows);
    expect(commentRows).toBeLessThan(uploadLink);
    expect(uploadLink).toBeLessThan(noteTextbox);
  });

  it('pins the docked footer (not this lane\'s) last, so the reorder never moves it off the bottom it already renders at', () => {
    const phone = phoneBlock();

    const composerOrder = Number(
      phoneRule(phone, '.chq-content-group-body .chq-comment-composer').match(/order:\s*(-?\d+)/)![1],
    );
    const dockOrder = Number(
      phoneRule(phone, '.chq-content-group-body .chq-phone-dock').match(/order:\s*(-?\d+)/)![1],
    );
    expect(dockOrder).toBeGreaterThan(composerOrder);
  });
});
