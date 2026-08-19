// v12 mobile campaign w1 (DEC-621 amendment), made real in w5 (DEC-621
// wave-87 amendment): the phone landing's "Draft in progress" card, frame
// docs/design/Chautauqua Comms.dc.html:188 (`border:1px solid #BAB6A6;
// border-radius:6px; background:#FAF8F2; padding:15px; display:flex;
// flex-direction:column; gap:9px`), part of the 'Comms' · 390 screen. A
// presentational card -- CommsPage reads the draft from composeDraft.ts
// (localStorage, written by ComposeWizard on each step advance) and hands
// it in here. DEC-621 wave-109 amendment (task w5-q): when there is no
// draft this still renders -- an equivalent, empty-state card that is the
// landing's route into Compose (see the `if (!draft)` branch below) --
// rather than nothing, so the landing is never a dead end.
//
// The frame's line 191 draws `23 recipients · reviewer feedback merged`,
// but nothing in the app records WHY a draft includes reviewer feedback --
// docs/design/audit/comms-v12.md finding 1 names this gap and its own rule
// ("fail loudly, never invent a number/signal the payload can't answer")
// forbids fabricating that provenance clause. This card renders the
// recipient count alone; there is no `provenance` field to fake it with.
export interface PhoneDraft {
  subject: string;
  recipientCount: number;
}

export function PhoneDraftCard({
  draft,
  onReadDraft,
}: {
  draft: PhoneDraft | null;
  onReadDraft: () => void;
}) {
  if (!draft) {
    // DEC-621 wave-109 amendment (task w5-q): the frame draws this slot
    // for the "a draft exists" state only -- with none stored the phone
    // landing would otherwise reach Compose through no control at all
    // (Tier 0 S2 break, docs/probes/metafid-phoneA-2026-08-19.md, and
    // docs/design/audit/comms-v12.md finding 2). This branch is the
    // equivalent entry into Compose the task calls for: same card
    // geometry and 44px control as the draft-exists branch below (no new
    // CSS needed), button label taken verbatim from the tab strip's own
    // vocabulary (Comms.tsx TABS, id 'compose') rather than invented copy.
    return (
      <div className="chq-comms-phone-draft-card">
        <button type="button" className="chq-comms-phone-draft-read" onClick={onReadDraft}>
          Compose
        </button>
      </div>
    );
  }
  return (
    <div className="chq-comms-phone-draft-card">
      {/* Frame line 189: `font-size:10px; font-weight:800;
          letter-spacing:0.1em; text-transform:uppercase;
          color:#565A4B">Draft in progress` */}
      <span className="chq-comms-phone-draft-eyebrow">Draft in progress</span>
      {/* Frame line 190: the draft's rendered subject line. */}
      <span className="chq-comms-phone-draft-subject">{draft.subject}</span>
      {/* Frame line 191: `23 recipients · reviewer feedback merged` -- the
          provenance clause is dropped, not fabricated (see doc comment
          above). */}
      <span className="chq-comms-phone-draft-meta">{draft.recipientCount} recipients</span>
      {/* Frame line 192: `font-size:13px; line-height:1.55;
          color:#3F4237">Better on a laptop` -- the honest steer, verbatim. */}
      <span className="chq-comms-phone-draft-honesty">Better on a laptop</span>
      {/* Frame line 193: `min-height:44px; display:flex; align-items:center;
          justify-content:center; font-size:13px; font-weight:600">Read the
          draft` */}
      <button type="button" className="chq-comms-phone-draft-read" onClick={onReadDraft}>
        Read the draft
      </button>
    </div>
  );
}
