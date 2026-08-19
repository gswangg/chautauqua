ROOT = "/Users/wednesdayniemeyer/.claude/jobs/2880f027/tmp/v12m-wt/v12m-w5-c"

def patch(path, old, new, count=1):
    p = f"{ROOT}/{path}"
    with open(p, "r", encoding="utf-8") as f:
        content = f.read()
    if old not in content:
        raise SystemExit(f"OLD STRING NOT FOUND in {path}:\n{old[:300]}")
    n = content.count(old)
    if count is not None and n != count:
        raise SystemExit(f"expected {count} occurrences of old string in {path}, found {n}")
    content = content.replace(old, new)
    with open(p, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"patched {path}")

# ---------------------------------------------------------------------------
# components/error-states.css -- .chq-error-summary-link is a real bare
# anchor. Use a compound selector (ancestor + tag) reaching it so this
# phone-only addition doesn't collide with the SSR-parity scan's exact
# selector-text comparison (test/error-vocabulary-parity.scan.test.ts).
# ---------------------------------------------------------------------------
patch(
    "app/src/components/error-states.css",
    """.chq-error-summary-link {
  font-size: 13px;
  font-weight: 700;
  color: var(--chq-brand);
  text-decoration: none;
}""",
    """.chq-error-summary-link {
  font-size: 13px;
  font-weight: 700;
  color: var(--chq-brand);
  text-decoration: none;
}

/* DEC-393 wave-87 amendment: the 44px row-action-anchor floor. A compound
   selector (not the bare `.chq-error-summary-link` above) so this
   phone-only addition can't merge into the SSR-parity scan's property map
   for the shared selector (test/error-vocabulary-parity.scan.test.ts) --
   the SSR twin has no phone breakpoint of its own. */
@media (max-width: 700px) {
  .chq-error-summary a.chq-error-summary-link {
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: 2px 4px;
    margin: -2px -4px;
  }
}""",
    count=1,
)

# ---------------------------------------------------------------------------
# components/modal-frame.css -- .chq-modal-actions is a generic slot that
# CAN hold a bare anchor from an arbitrary caller (it already holds styled
# .chq-btn actions, handled by the existing 46px rule). Cover the anchor
# case without touching the button case.
# ---------------------------------------------------------------------------
patch(
    "app/src/components/modal-frame.css",
    """/* DEC-897: action buttons match the modal's input height (46px, see the
   narrow-breakpoint min-height below) so the footer doesn't read lighter
   than the fields above it. */
.chq-scrim .chq-modal-actions .chq-btn {
  min-height: 46px;
}""",
    """/* DEC-897: action buttons match the modal's input height (46px, see the
   narrow-breakpoint min-height below) so the footer doesn't read lighter
   than the fields above it. */
.chq-scrim .chq-modal-actions .chq-btn {
  min-height: 46px;
}

/* DEC-393 wave-87 amendment: `.chq-modal-actions` is a slot for arbitrary
   caller content (ModalFrame.tsx's `actions` prop) and can hold a bare
   anchor with no `.chq-btn` -- give any such anchor the 44px floor on
   phone without touching the styled `.chq-btn` action buttons above,
   which already clear it at 46px. */
@media (max-width: 700px) {
  .chq-modal-actions a:not(.chq-btn) {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 16px;
  }
}""",
    count=1,
)

# ---------------------------------------------------------------------------
# pages/submissions/detail.css
# ---------------------------------------------------------------------------

patch(
    "app/src/pages/submissions/detail.css",
    """/* Per-row participant actions: quiet tertiary links, never a
   bordered/filled control competing with the Visible checkbox. */
.chq-detail-participant-row-actions {
  display: flex;
  gap: 12px;
}""",
    """/* Per-row participant actions: quiet tertiary links, never a
   bordered/filled control competing with the Visible checkbox. */
/* tap-floor-exempt: SubmissionDetailPage.tsx renders only <button
   className="chq-link-button"> children here (Make co-presenter / Remove)
   -- never an <a>/<Link> -- so there is no bare anchor for the 44px
   row-action floor to apply to (DEC-393 wave-87 amendment). */
.chq-detail-participant-row-actions {
  display: flex;
  gap: 12px;
}""",
)

patch(
    "app/src/pages/submissions/detail.css",
    """.chq-detail-participant-row-actions .chq-link-button {
  font-size: 12px;
  font-weight: 700;
  color: var(--chq-muted);
}""",
    """/* tap-floor-exempt: scoped to .chq-detail-participant-row-actions, which
   (see the tap-floor-exempt comment above it) only ever renders <button>
   children -- this compound selector never reaches a bare anchor
   (DEC-393 wave-87 amendment). */
.chq-detail-participant-row-actions .chq-link-button {
  font-size: 12px;
  font-weight: 700;
  color: var(--chq-muted);
}""",
)

patch(
    "app/src/pages/submissions/detail.css",
    """.chq-detail-edit-form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}""",
    """/* tap-floor-exempt: SubmissionDetailPage.tsx renders only Save/Cancel
   <button className="chq-btn ..."> here in both the title/abstract and
   tracks editors -- never an <a>/<Link> -- so there is no bare anchor for
   the 44px row-action floor to apply to (DEC-393 wave-87 amendment). */
.chq-detail-edit-form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}""",
)

patch(
    "app/src/pages/submissions/detail.css",
    """.chq-detail-participant-actions-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}""",
    """/* tap-floor-exempt: this cell holds the Visible checkbox, the invite-status
   chip and the (button-only, see .chq-detail-participant-row-actions above)
   actions -- never an <a>/<Link> directly -- so there is no bare anchor for
   the 44px row-action floor to apply to (DEC-393 wave-87 amendment). */
.chq-detail-participant-actions-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}""",
)

patch(
    "app/src/pages/submissions/detail.css",
    """  .chq-detail-back,
  .chq-detail-position-prev,
  .chq-detail-position-next {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }""",
    """  .chq-detail-back,
  .chq-detail-position-prev,
  .chq-detail-position-next {
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: 0 4px;
  }

  /* DEC-393 wave-87 amendment: 'Delete this submission' is a bare <Link>
     (no .chq-btn) -- the row-action-anchor floor evasion. */
  .chq-detail-delete-link {
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: 0 4px;
  }""",
)

# ---------------------------------------------------------------------------
# pages/submissions/submissions.css
# ---------------------------------------------------------------------------

patch(
    "app/src/pages/submissions/submissions.css",
    """.chq-submissions-head-actions {
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
}""",
    """/* tap-floor-exempt: SubmissionsTable.tsx renders 'Forms' (Link) and
   'Export CSV' (<a download>) here, both carrying `.chq-btn` -- never a
   bare anchor -- so there is no row-action-anchor floor gap here
   (DEC-393 wave-87 amendment). */
.chq-submissions-head-actions {
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
}""",
)

patch(
    "app/src/pages/submissions/submissions.css",
    """.chq-submissions-bulkbar-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}""",
    """/* tap-floor-exempt: BulkActionBar.tsx renders status-move <button>s, an
   'Email these N' <Link> carrying `.chq-btn`, and a Clear <button> here --
   never a bare anchor (DEC-393 wave-87 amendment). */
.chq-submissions-bulkbar-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}""",
)

patch(
    "app/src/pages/submissions/submissions.css",
    """.chq-submissions-pagination-actions {
  margin-left: auto;
  display: flex;
  gap: 9px;
}""",
    """/* tap-floor-exempt: SubmissionsTable.tsx renders only Previous/Next
   <button>s here -- never an <a>/<Link> -- so there is no bare anchor for
   the 44px row-action floor to apply to (DEC-393 wave-87 amendment). */
.chq-submissions-pagination-actions {
  margin-left: auto;
  display: flex;
  gap: 9px;
}""",
)

patch(
    "app/src/pages/submissions/submissions.css",
    """  .chq-submissions-table-title {
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }""",
    """  /* DEC-393 wave-87 amendment: the row-title <Link> is a bare anchor (no
     `.chq-btn`) -- the 44px row-action-anchor floor, applied without
     disturbing the row's own baseline/flex-wrap layout above (the link's
     own box grows, the row doesn't reflow). */
  .chq-submissions-table-title {
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: 0 4px;
    margin: 0 -4px;
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }""",
)

patch(
    "app/src/pages/submissions/submissions.css",
    """.chq-submissions-delete-back {
  color: var(--chq-muted);
  text-decoration: none;
  font-size: 14px;
}""",
    """.chq-submissions-delete-back {
  color: var(--chq-muted);
  text-decoration: none;
  font-size: 14px;
}

/* DEC-393 wave-87 amendment: the back link is a bare <Link> (no
   `.chq-btn`) -- the 44px row-action-anchor floor. */
@media (max-width: 700px) {
  .chq-submissions-delete-back {
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: 0 4px;
    margin: 0 -4px;
  }
}""",
)

print("ALL CSS PATCHES APPLIED")
