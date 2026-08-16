## Mobile / phone queue (carried forward, own lane, not re-measured this wave)

Desktop fidelity was priority; mobile deferred. Done items cited (STRUCTURAL,
listed in DISMISSED-VERIFIED-CLOSED above): phone-block-visibility override
assertion, N-aware clash caption, "place here anyway" path, Comms phone
landing, phone password fixed footer + Cancel, Home footer media rule.
Additional: Settings subscreens are URL state not path routes, DELIBERATE
(`app/src/pages/Settings.tsx:13-30`, DEC-728); Phone submissions triage
cards exist (`app/src/pages/submissions/submissions-phone-card.render.test.tsx`,
DEC-610).

**Deleted this wave (DEC-358 wave-37 amendment — false claim, re-verified
against the tree):** the prior "Still open/unverified: CFP 2-step wizard,
roster screen" line. Both exist and were verified present at this wave's
runtime: `src/routes/public/cfp-steps-script.tsx` (1.9 KB) plus
`src/routes/public/submit-views.tsx`'s `data-chq-cfp-step`/`.chq-cfp-steps`
markup (`:556-567`) implement the CFP 2-step wizard; `app/src/pages/speakers/
RosterPanel.tsx` (14 KB) plus its
`app/src/pages/speakers/RosterPanel.render.test.tsx` (9.7 KB) implement and
test the roster screen. Neither is a live gap; this was a stale claim
carried forward unre-verified, the same class of defect DEC-358's wave-35
amendment named for "does not exist" file claims — an existence claim
("still open/unverified") decays exactly the same way and needed re-globbing
before being carried, and on re-globbing was found false.

**Governing principle (affirmed, still binds):** mobile is additive
reflow — a mobile change must never move a desktop pixel (scan-lock).
Phone grammar (action bars, sheets, stacking, 44px targets) is a legitimate
translation of desktop affordances; a phone-only surface never lets
desktop be inferred from it.
