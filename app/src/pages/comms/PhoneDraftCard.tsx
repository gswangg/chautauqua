// v12 mobile campaign w1 (DEC-621 amendment; planner's ruling): the phone
// landing's "Draft in progress" card, frame
// docs/design/Chautauqua Comms.dc.html:188 (`border:1px solid #BAB6A6;
// border-radius:6px; background:#FAF8F2; padding:15px; display:flex;
// flex-direction:column; gap:9px`), part of the 'Comms' · 390 screen. A
// presentational card that renders ONLY when a draft exists -- CommsPage
// has no source of an in-progress compose draft to hand it: ComposeWizard's
// step state is component-local, never lifted to CommsPage or persisted
// anywhere, and this task's file scope (app/src/pages/comms/**) forbids
// both adding a server endpoint and inventing a proxy signal the loaded
// data can't actually answer. Wired with draft={null} in Comms.tsx, so the
// card never renders in production today -- kept here, structurally
// ready, so a future task wiring a real draft source only has to supply
// the prop. See docs/design/audit/comms-v12.md for the full gap writeup.
export interface PhoneDraft {
  subject: string;
  recipientCount: number;
  provenance: string;
}

export function PhoneDraftCard({
  draft,
  onReadDraft,
}: {
  draft: PhoneDraft | null;
  onReadDraft: () => void;
}) {
  if (!draft) return null;
  return (
    <div className="chq-comms-phone-draft-card">
      {/* Frame line 189: `font-size:10px; font-weight:800;
          letter-spacing:0.1em; text-transform:uppercase;
          color:#565A4B">Draft in progress` */}
      <span className="chq-comms-phone-draft-eyebrow">Draft in progress</span>
      {/* Frame line 190: the draft's rendered subject line. */}
      <span className="chq-comms-phone-draft-subject">{draft.subject}</span>
      {/* Frame line 191: `23 recipients · reviewer feedback merged` */}
      <span className="chq-comms-phone-draft-meta">
        {draft.recipientCount} recipients · {draft.provenance}
      </span>
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
