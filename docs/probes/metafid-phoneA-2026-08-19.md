# Meta-fidelity probe: phone clusters A (verified reds, evidence in
# scratchpad/metafid-b/). Cluster verdicts: Contacts FAIL, Comms FAIL,
# Settings FAIL, Submissions MARGINAL, Content MARGINAL. Tier 0.

## Two disproportionate root fixes FIRST
1. The cancelled-padding idiom (padding-inline + negative margin-inline) is
   applied to BORDERED controls where it is NOT layout-neutral: comms.css
   :2068 (.chq-comms-head-actions > .chq-pill overlaps siblings by 11px/side)
   and seven sibling rules (:2078,:2089,:2098,:2108,:2132,:2143), plus the
   same idiom in settings.css (left-bleeding rows on Public pages; four
   flush-joined Saved-embeds buttons). Idiom is for borderless quiet controls
   ONLY — bordered boxes need real gaps. Fix at every bordered application.
2. .chq-settings-section-action (settings.css:210) is 15px tall with no
   phone floor — it is the ONLY route into edit mode on all nine Settings
   panels. ROOMY per DESIGN-RULINGS:189.

## S1 breaks (reach/read)
- Settings People-edit: main overflows 390 by 240px; Person column 0px wide;
  Change-password/Remove overlap. Event-edit +86px, CFP-edit +46px
  (.chq-settings-field fixed 420px/200px at 390). Submission detail +91px
  (.chq-participant-email-cell 210px).
- CFP form stat strip clips values mid-string ("5 Aug 202").
- Submission detail back link renders a bare ‹ with no label (frame: ‹ Triage).
- Header-label leakage into cards: Contacts rows print COMPANY:/LABELS:
  prefixes + stray checkbox; Templates rows print NAME:.
- Portal/Tracks rows stranded in half-width columns (left ~62%).

## S2 structure vs frames
- Tab bar slot 4 must be CONTEXTUAL (Contacts on Contacts frames, Comms on
  Comms, More-active on Settings) — App.tsx:135 is fixed; dot belongs ABOVE
  the label on ALL items (inactive #BAB6A6), App.tsx:317 renders active-only
  and below.
- Comms Templates/History unreachable on phone without a localStorage draft:
  phoneEntered ignores ?tab=; landing has zero nav without a draft.
- Drill-ins keep the parent page head (Contacts pipeline/dupes/merge, Comms
  drills) — frames are one-screen-at-a-time.
- Pinned docks missing on 12 of 14 framed screens (Contact detail, Pipeline,
  Merge, Templates, Files, Session deliverable, Settings Event...); Content
  select-mode dock renders at TOP not bottom (frame :247).
- Contact detail inverts hierarchy: frame's wide-primary "Email Priya" +
  Edit vs live 2x2 secondaries with Save primary; save-scope line misplaced.
- Import CSV phone wizard (frame :487 one-column-per-screen + Next/Skip
  dock) not built; desktop modal overflows at 390.
- Settings read/edit split leaves five of nine frames never rendering as
  drawn; Your data drops masked tokens/Revoke/New token in read mode; edit
  mode inverts title/back-link order.
- Submissions head: three filter strips (VIEW 753px + status 759px both
  clipped) where frame :137 draws search + three chips.
- Saved embeds: frame's Turn off + Get code pair became four flush buttons;
  ON/OFF misplaced; host line + footnote gone.

## S3 44px floor (all buttons/links below; see probe for counts)
.chq-settings-section-action 15px · .chq-submissions-clone 14px · .chq-check
18px · .chq-forms-strip-label 16px · contacts name links 25.6px · content
file links 22-24px · .chq-submissions-viewtab 29px · strip datefield 28.4px
· .chq-color-swatch 22px · portal add-resource 34px.

Positive: zero horizontal document overflow on all 24; CFP form dock is the
model implementation; dock-suppression mechanism works; Merge is strongest.
