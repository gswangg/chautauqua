import { useEffect, useMemo, useRef, useState } from 'react';
import { apiPost, ApiError } from '../../lib/api';
import { expandFullNameMapping, importEmailProblem, mapImportRow, parseCsv, suggestMapping, toCsvVerbatim, FULL_NAME_TARGET, STANDARD_IMPORT_FIELDS } from './csv';
import { toCsv } from '../../../../src/domain/csv';
import { ModalFrame, FormRow } from '../../components/ModalFrame';
import { usePendingLabel } from '../../components/PendingAction';
import type { ImportPlan, ImportPlanRow, ImportResult } from './types';
import { DEC_810, DEC_575, DEC_124, DEC_478, DEC_856 } from '../../../../src/decisions';
// DEC-290 (wave-59 amendment): a supplied eventId is a CANDIDATE, not an
// instruction -- the wizard's session-title requirement, request keys and
// blocker hint below all hang off the 'Also add these people to <event> as
// accepted speakers' opt-in (attachToEvent) being explicitly turned on.
// This amendment lives in decisions/DEC-290.md; no src/decisions.ts export
// exists for DEC-290 to compile-check against (never hand-add one here).
import { countOf, plural, thingsNeedFixingHeading } from '../../lib/plural';
import { validateImportMapping } from '../../../../src/domain/contacts';
import { MAX_IMPORT_ROWS, MAX_IMPORT_CSV_BYTES } from '../../lib/domain-caps';
import { formatBytes } from '../../../../src/domain/files';
import { MAX_NAME_LENGTH } from '../../lib/text-caps';
import './contacts-panels.css';

// Compile-checked dependency marker: when `eventId` is set AND the
// DEC-290 attach-to-event opt-in is on, this wizard collects a required
// `sessionTitle` for the batch (in the same step the event is already
// chosen) rather than letting the server invent an 'Invited: <name>' title
// per contact (DEC-810).
void DEC_810;
// DEC-575 (wave 28 amendment): a file whose rows are partly unusable (no
// email -- the dedupe key) offers a pre-mapping partial import instead of
// proceeding silently or failing whole. See badRows/showFileWarning below.
// The block reuses the SPA's shared .chq-error-summary vocabulary (DEC-124
// wave 26/28 amendments) by class name only -- it does not define those
// classes; app/src/components/error-states.css owns them.
void DEC_575;
void DEC_124;
// DEC-478 (amendment, wave 62): the row/byte caps are disclosed where the
// file is chosen (the caption on step 1) and enforced before the
// match-columns step, not only as the 400 the server would eventually
// return after every column has already been mapped. See
// MAX_IMPORT_ROWS/MAX_IMPORT_CSV_BYTES below, imported from the ONE
// pure-core home so the SPA's cap always agrees with the server's.
void DEC_478;
// DEC-856 (sibling shape, wave 65): the seven named refusals POST
// /contacts/import can throw (csvText/mapping/dryRun/skipLines/eventId/
// sessionTitle, plus the row-cap refusal reusing the csvText key) each
// route to the step and control that produced them -- never a bare
// "Validation failed" at the end of the multi-step ritual. Anything the
// wizard doesn't recognize renders labelled in one top-of-form
// ErrorSummary instead of being silently dropped.
void DEC_856;

interface Props {
  onClose: () => void;
  onImported: () => void;
  // DEC-290: when set (e.g. the Speakers roster importer), the import is
  // OPTIONALLY additionally scoped to this event -- gated behind the
  // explicit 'Also add these people to <event>' opt-in (wave-59 amendment)
  // -- and when the opt-in is on, the server pushes every imported contact
  // onto the event's roster and reports `addedToEvent` back. Absent this
  // prop, behavior is unchanged from the CRM-only import (today's
  // ContactsApp call site).
  eventId?: string;
  // DEC-290 (wave-59 amendment): the event's display name for the opt-in
  // checkbox label; falls back to 'this event' when absent.
  eventName?: string;
}

// Behaviour frozen (DEC-366): CSV column mapping and the set-based import
// call are untouched by this redesign (w2-e) -- restyled with the shared
// .chq-steps strip (mock "Import CSV · step 2 of 3") plus .chq-contacts-
// import-* layout classes.
//
// DEC-663: the flow now runs a dry-run POST (dryRun: true) before ever
// committing. The dry run's rows -- and the exact {csvText, mapping,
// eventId?} body that produced them -- are shown to the organizer on a
// Review step; the commit POST reuses that exact body plus `skipLines`
// (the checked "skip this row" boxes), never a body reconstructed from
// possibly-since-edited mapping state.

interface PlannedRequest {
  csvText: string;
  mapping: Record<string, string>;
  eventId?: string;
  sessionTitle?: string;
}

// G13 (frame 08-contacts--03): the match-columns selects speak human labels
// ('First name', 'Email'), never the machine field keys ('firstName') --
// option VALUES stay the wire keys, so the mapping contract is untouched.
const IMPORT_FIELD_LABELS: Record<string, string> = {
  email: 'Email',
  firstName: 'First name',
  lastName: 'Last name',
  company: 'Company',
  title: 'Title',
  phone: 'Phone',
  bio: 'Bio',
};

/** Human label for a mapped field key -- used by the match-columns selects
 * and the review step's diff lines (frame 08-contacts--13: 'Title
 * ~~Senior Engineer~~ → Principal Engineer', capitalised human labels). */
function importFieldLabel(field: string): string {
  return IMPORT_FIELD_LABELS[field] ?? (field.startsWith('custom.') ? field.slice('custom.'.length) : field);
}

function actionLabel(row: ImportPlanRow): string {
  if (row.action === 'create') return 'Create';
  if (row.action === 'update') return 'Update';
  return `Skip — ${row.reason ?? 'no reason given'}`;
}

/** One rejected row of the DEC-575 file-level gate: its 1-based CSV line
 * and the named problem with its email cell (G13, frame 08-contacts--15). */
interface BadRow {
  line: number;
  problem: string;
}

/** Rows listed with their reasons, capped at ten, then 'and N more'
 * (DEC-575 wave-28 amendment; per-row reasons per frame 08-contacts--15).
 * A display cap, not a server-enforced bound -- kept as a plain literal at
 * its two call sites so the DEC-660 cap-crossing scan doesn't read it as a
 * hand-declared domain cap. */
function listedBadRows(rows: BadRow[]): BadRow[] {
  return rows.slice(0, 10);
}

/** The same three choices the desktop `<select>` offers for a column --
 * skip, the standard fields, full-name, custom -- as an ordered list, for
 * the phone one-column-per-screen radio list (v12m-w1-f, frame
 * "Import CSV · 390" `Import it as`). Desktop's <select> stays a <select>;
 * this is a second rendering of the SAME mapping choices, not a second
 * source of truth -- both write through setColumnMapping. */
function phoneImportTargetOptions(col: string): Array<{ value: string; label: string }> {
  return [
    { value: '', label: 'Skip this column' },
    ...STANDARD_IMPORT_FIELDS.map((f) => ({ value: f, label: importFieldLabel(f) })),
    { value: FULL_NAME_TARGET, label: 'Full name (splits into first / last)' },
    { value: `custom.${col}`, label: `Custom: ${col}` },
  ];
}

export function ImportWizard({ onClose, onImported, eventId, eventName }: Props) {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  // v12m-w1-f: PHONE-ONLY pagination through the match-columns step, one
  // source column at a time (frame "Import CSV · 390", `Column 2 of 5`).
  // This is presentation state only -- it never touches `mapping`, the
  // injective-mapping check (mappingValidationError below) or the
  // runPreview() POST body, all of which stay exactly as they were.
  // Desktop keeps rendering every column at once and ignores this index.
  const [phoneColumnIndex, setPhoneColumnIndex] = useState(0);
  // DEC-290 (wave-59 amendment): a supplied eventId is a CANDIDATE, not an
  // instruction -- unchecked by default, this is the ONE control every
  // add-to-event behaviour below (the session-title field, its
  // required-ness, the preview guard, the request keys, the disabled-
  // primary blocker hint) hangs off.
  const [attachToEvent, setAttachToEvent] = useState(false);
  // DEC-810: when this import is scoped to an event AND attachToEvent is
  // on, the whole batch shares one session title -- collected here, in the
  // step where the event is already chosen (the eventId prop), never
  // invented server-side.
  const [sessionTitle, setSessionTitle] = useState('');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [plannedRequest, setPlannedRequest] = useState<PlannedRequest | null>(null);
  const [skipLines, setSkipLines] = useState<Set<number>>(new Set());
  // DEC-663 (wave-64 amendment): the possible-duplicate disposition -- a
  // line's chosen merge target (line -> contactId), 'Import as new' by
  // default (absent from the map). A line can be skipped OR merged, never
  // both -- toggleSkipLine and setMergeSelection each clear the other's
  // entry for the same line.
  const [mergeSelections, setMergeSelections] = useState<Map<number, string>>(new Map());
  // w49-f: the review table renders only the rows where something is lost
  // or ambiguous by default -- this flips it to show every row (still
  // sorted updates-first, still skippable). Reset on every fresh preview so
  // a re-run starts filtered again.
  const [showAllRows, setShowAllRows] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  // DEC-733 (V11 pending grammar): csv-import is one of the four slow
  // operations -- the commit button becomes its own progress indicator.
  // The total row count is known up front from the accepted plan; the
  // server does not report incremental progress, so this is the
  // known-total form ("Importing 214 rows…"), not a live "N of M".
  const importPendingLabel = usePendingLabel({
    pending: busy,
    restLabel: `Import ${countOf(plan ? plan.rows.length - skipLines.size : 0, 'row')}`,
    participle: 'Importing',
    total: plan ? plan.rows.length - skipLines.size : undefined,
  });
  const [error, setError] = useState<string | null>(null);
  // DEC-856: the server's fields map from the last preview/commit refusal,
  // read once per matcher below instead of re-parsed per render. Cleared
  // whenever the control that produced the offending key is edited, so a
  // stale message never survives the fix.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | null>(null);
  // DEC-856: a csvText refusal (required / over-byte / over-row) can arrive
  // from runPreview even though header.length > 0 already (the full-name
  // expansion in runPreview can push an already-parsed file over the byte
  // cap) -- this forces the wizard back to step 1 rather than leaving the
  // organizer stranded on the match-columns screen with a file-level error.
  const [forceStep1, setForceStep1] = useState(false);
  // DEC-575 (wave 28 amendment): true once the organizer has accepted the
  // file-level "N rows have no email address" block and asked to proceed
  // with only the usable rows. Reset by resetToChooseFile so a fresh
  // upload gets its own file-level check.
  const [warningAcknowledged, setWarningAcknowledged] = useState(false);

  const parsed = useMemo(() => {
    if (csvText.trim() === '') return null;
    try {
      return parseCsv(csvText);
    } catch (err) {
      return err instanceof Error ? err.message : 'Failed to parse CSV';
    }
  }, [csvText]);

  const rows = typeof parsed === 'object' && parsed !== null ? parsed : null;
  const header = rows?.[0] ?? [];
  const allDataRows = rows ? rows.slice(1) : [];
  const parseError = typeof parsed === 'string' ? parsed : null;

  // DEC-478 (amendment, wave 62): the same two caps the server enforces,
  // checked as soon as the file is parsed -- BEFORE the match-columns step
  // -- so an oversize file is refused where it was chosen, not after the
  // organizer has mapped every column.
  const csvByteLength = useMemo(() => (csvText === '' ? 0 : new TextEncoder().encode(csvText).length), [csvText]);
  const overRowCount = allDataRows.length > MAX_IMPORT_ROWS ? allDataRows.length - MAX_IMPORT_ROWS : 0;
  const overByteCount = csvByteLength > MAX_IMPORT_CSV_BYTES ? csvByteLength - MAX_IMPORT_CSV_BYTES : 0;
  const showSizeRefusal = header.length > 0 && !plan && !result && (overRowCount > 0 || overByteCount > 0);

  // DEC-575 (wave 28 amendment): a pre-mapping, file-level refusal for rows
  // whose email cell is unusable -- counted from the header's own
  // auto-suggested mapping (suggestMapping, same alias table the "Match
  // columns" screen uses to prime its selects), computed ONCE per parsed
  // file and never re-derived from the organizer's later, live edits to
  // `mapping` in the match step -- a match-step "skip this column" toggle
  // on Email must not resurrect this file-level gate after it has already
  // been passed.
  //
  // G13 (frame 08-contacts--15): the gate tests the cell with
  // importEmailProblem -- the domain's canonical isValidEmail rule
  // (DEC-454), the same one the server's plan/commit path enforces -- not
  // just emptiness, and carries each rejected row's named reason so the
  // refusal can say WHY per row, the way the frame draws it.
  const badRows: BadRow[] = useMemo(() => {
    if (header.length === 0) return [];
    const autoMapping = suggestMapping(header);
    // DEC-011/DEC-478 (wave-65 amendment): the domain's mapImportRow has no
    // concept of FULL_NAME_TARGET (that pseudo-target is client-only, see
    // ./csv.ts), so a fullName-mapped column must run through
    // expandFullNameMapping FIRST -- the same two steps runPreview's own
    // POST body already runs below -- before mapImportRow ever sees it.
    const expanded = expandFullNameMapping(header, allDataRows, autoMapping);
    const bad: BadRow[] = [];
    expanded.rows.forEach((row, i) => {
      const mapped = mapImportRow(expanded.mapping, expanded.header, row);
      const problem = importEmailProblem(mapped.email ?? '');
      if (problem) bad.push({ line: i + 2, problem }); // +2: header is line 1, first data row is line 2.
    });
    return bad;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDataRows, header.join(' ')]);

  const showFileWarning =
    header.length > 0 && !plan && !result && !showSizeRefusal && badRows.length > 0 && !warningAcknowledged;

  // Once the organizer accepts "Import the N good rows", every downstream
  // step (match columns, dedupe preview, dry run) sees only the usable
  // rows -- the raw file (csvText / allDataRows) is untouched so re-upload
  // and "the file is still loaded" both stay true.
  const dataRows = useMemo(() => {
    if (!warningAcknowledged) return allDataRows;
    const badLines = new Set(badRows.map((r) => r.line));
    return allDataRows.filter((_, i) => !badLines.has(i + 2));
  }, [warningAcknowledged, allDataRows, badRows]);

  // P1 fix (w1-f): auto-suggest a mapping from header names on the first
  // sight of a given header (see suggestMapping in ./csv.ts), so a CSV whose
  // columns already read "Email"/"First Name"/etc. imports without the user
  // having to hand-map every column first. Re-suggests once per distinct
  // header (by content, not header identity), and never overwrites a
  // mapping the user has already started editing for that header.
  const lastAutoMappedHeader = useRef<string | null>(null);
  useEffect(() => {
    if (header.length === 0) return;
    const signature = header.join('\u0000');
    if (lastAutoMappedHeader.current === signature) return;
    lastAutoMappedHeader.current = signature;
    const suggested = suggestMapping(header);
    if (Object.keys(suggested).length > 0) setMapping(suggested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [header.join('\u0000')]);

  // v12m-w1-f: a new file (new header signature) always restarts the
  // phone-only pager (below) at its first column -- otherwise a shorter
  // second file could leave the index pointing past the end of the new
  // header.
  useEffect(() => {
    setPhoneColumnIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [header.join('\u0000')]);

  // Match-columns dedupe footer (DEC-663 amendment, w49-f): counts rows
  // that repeat an EARLIER ROW'S email WITHIN THIS FILE -- it is not, and
  // has never been, a query against existing contacts (only the server's
  // dry run answers that; see the Review step's "matched by email" clause,
  // sourced from plan.updated). The footer below must say only what this
  // number measured -- an in-file collision, last row wins -- and stay
  // silent when there isn't one.
  // DEC-478 (amendment, wave 47): the SAME pure-core rule the server door
  // enforces (validateImportMapping) -- never a second copy of the "no two
  // columns may target one field" check -- run inline as the mapping is
  // edited so the offending pair is named and Continue is blocked before
  // the organizer ever reaches the dry run.
  const mappingValidationError = useMemo(() => {
    try {
      validateImportMapping(mapping);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Invalid column mapping';
    }
  }, [mapping]);

  const dedupeCount = useMemo(() => {
    // DEC-011/DEC-478 (wave-65 amendment): same expand-then-map order as
    // badRows above -- mapImportRow (domain) throws on the FULL_NAME_TARGET
    // pseudo-target unless expandFullNameMapping has already rewritten it
    // into firstName/lastName columns.
    const expanded = expandFullNameMapping(header, dataRows, mapping);
    const seen = new Set<string>();
    let dupes = 0;
    for (const row of expanded.rows) {
      const mapped = mapImportRow(expanded.mapping, expanded.header, row);
      if (!mapped.email) continue;
      if (seen.has(mapped.email)) dupes += 1;
      else seen.add(mapped.email);
    }
    return dupes;
  }, [dataRows, mapping, header]);

  // B5: update rows -- the only rows where something is lost -- come first.
  // Array.prototype.sort is stable, so within each group (update vs.
  // everything else) rows keep the dry run's original line order.
  const sortedPlanRows = useMemo(() => {
    if (!plan) return [];
    return [...plan.rows].sort((a, b) => (a.action === 'update' ? 0 : 1) - (b.action === 'update' ? 0 : 1));
  }, [plan]);

  // w49-f: by default the review table shows only the rows where something
  // is lost or ambiguous -- an update, an overwrite, or a possible
  // duplicate -- so a 205-row "everything's fine" plan doesn't bury the 9
  // rows that need a decision. The rest are reachable behind "Show all N
  // rows" (showAllRows), never dropped, always skippable once shown.
  function isLosingRow(row: ImportPlanRow): boolean {
    return row.action === 'update' || (row.overwrites?.length ?? 0) > 0 || (row.possibleDuplicates?.length ?? 0) > 0;
  }
  const visiblePlanRows = showAllRows ? sortedPlanRows : sortedPlanRows.filter(isLosingRow);
  const hiddenRowCount = sortedPlanRows.length - visiblePlanRows.length;

  // DEC-856: one matcher per named refusal key POST /contacts/import can
  // throw, routed to the step/control that produced it -- csvText to the
  // file/paste step, mapping (and the column-mapping message, which already
  // names the offending column -- see the route's `{ mapping: err.message }`)
  // to the match-columns step, eventId/sessionTitle to the add-to-event
  // controls (the session-title field, the only add-to-event control this
  // wizard renders), skipLines to the skip-rows control on the review step.
  // Anything else (dryRun, or a key this wizard has never seen) renders
  // labelled in the top-of-form ErrorSummary below instead of being dropped.
  const MATCHED_FIELD_KEYS = ['csvText', 'mapping', 'eventId', 'sessionTitle', 'skipLines'] as const;
  const csvTextFieldError = fieldErrors?.csvText ?? null;
  const mappingFieldError = fieldErrors?.mapping ?? null;
  const eventFieldError = fieldErrors?.sessionTitle ?? fieldErrors?.eventId ?? null;
  const skipLinesFieldError = fieldErrors?.skipLines ?? null;
  const unmatchedFieldEntries = fieldErrors
    ? Object.entries(fieldErrors).filter(([key]) => !MATCHED_FIELD_KEYS.includes(key as (typeof MATCHED_FIELD_KEYS)[number]))
    : [];

  // Step strip (mock "Import CSV · step 3 of 4"): 1 = choose a file, 2 =
  // map columns, 3 = review the dry run, 4 = done. Display-only -- does
  // not gate the real flow, which stays driven by
  // csvText/header/plan/result exactly as before. `forceStep1` overrides a
  // csvText refusal that arrives after header.length > 0 (DEC-856 above).
  const step = forceStep1 ? 1 : result ? 4 : plan ? 3 : header.length > 0 && !showSizeRefusal ? 2 : 1;

  // w15-c: the dialog title names the current step; "Import contacts from
  // CSV" moves down to the ModalFrame subtitle so it stays visible across
  // every step instead of being the one static title.
  const stepTitle =
    step === 4
      ? 'Import complete'
      : step === 3
        ? 'Review the import'
        : step === 2
          ? 'Match the columns'
          : 'Choose a file';

  // DEC-856: one entry point for both preview and commit refusals. A
  // fields map routes the wizard back to the step/control that produced the
  // offending key (see MATCHED_FIELD_KEYS above) instead of leaving the
  // generic `error` state (rendered once, at the top, for shapes with no
  // fields map at all) as the only signal.
  function handleImportApiError(err: unknown, fallback: string) {
    if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) {
      setFieldErrors(err.fields);
      setError(null);
      if (err.fields.csvText) {
        // A csvText refusal can arrive from runPreview even once
        // header.length > 0 (full-name expansion can push an
        // already-parsed file over the byte cap) -- send the organizer
        // back to step 1 rather than stranding them on step 2/3.
        setForceStep1(true);
      }
      if (err.fields.mapping || err.fields.eventId || err.fields.sessionTitle || err.fields.csvText) {
        // Any of these means the plan (if any) was built from a request
        // the server has now rejected -- never show a stale Review step.
        setPlan(null);
        setPlannedRequest(null);
      }
    } else {
      setFieldErrors(null);
      setForceStep1(false);
      setError(err instanceof ApiError ? err.message : fallback);
    }
  }

  function handleFile(file: File) {
    setFileName(file.name);
    setFieldErrors(null);
    setForceStep1(false);
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ''));
    reader.readAsText(file);
  }

  // DEC-575 (wave 28 amendment): the file-level warning's secondary path.
  // An explicit user action -- never the warning state itself -- clears the
  // parsed file so step 1's choose-file screen comes back for a corrected
  // upload.
  function resetToChooseFile() {
    setCsvText('');
    setFileName(null);
    setMapping({});
    setWarningAcknowledged(false);
    setFieldErrors(null);
    setForceStep1(false);
    lastAutoMappedHeader.current = null;
  }

  function setColumnMapping(col: string, value: string) {
    setFieldErrors(null);
    setMapping((prev) => {
      const next = { ...prev };
      if (value === '') {
        delete next[col];
      } else {
        next[col] = value;
      }
      return next;
    });
  }

  // DEC-663 (wave-87 amendment): runPreview optionally takes the mapping to
  // build the request from, rather than always reading the `mapping` state
  // closure. The phone pager's last-column "Skip" both clears that column's
  // mapping AND runs the preview in the same click -- setColumnMapping's
  // setState is async, so without this override runPreview would build its
  // request from the STALE pre-Skip mapping.
  async function runPreview(overrideMapping?: Record<string, string>) {
    if (eventId && attachToEvent && sessionTitle.trim() === '') {
      setError('Enter a session title for this batch.');
      return;
    }
    setBusy(true);
    setError(null);
    setFieldErrors(null);
    setForceStep1(false);
    try {
      // Split any full-name-mapped column into first/last before the
      // server ever sees it (see expandFullNameMapping in ./csv.ts).
      const expanded = expandFullNameMapping(header, dataRows, overrideMapping ?? mapping);
      const expandedCsvText = toCsvVerbatim([expanded.header, ...expanded.rows]);
      const request: PlannedRequest = {
        csvText: expandedCsvText,
        mapping: expanded.mapping,
        ...(eventId && attachToEvent ? { eventId, sessionTitle: sessionTitle.trim() } : {}),
      };
      const res = await apiPost<ImportPlan>('/contacts/import', { ...request, dryRun: true });
      setPlan(res);
      setPlannedRequest(request);
      setSkipLines(new Set());
      setMergeSelections(new Map());
      setShowAllRows(false);
    } catch (err) {
      handleImportApiError(err, 'Preview failed');
    } finally {
      setBusy(false);
    }
  }

  function toggleSkipLine(line: number) {
    const willSkip = !skipLines.has(line);
    setSkipLines((prev) => {
      const next = new Set(prev);
      if (next.has(line)) {
        next.delete(line);
      } else {
        next.add(line);
      }
      return next;
    });
    // A line can be skipped or merged, never both -- checking Skip clears
    // any merge selection for the same line.
    if (willSkip && mergeSelections.has(line)) {
      setMergeSelections((prev) => {
        const next = new Map(prev);
        next.delete(line);
        return next;
      });
    }
  }

  // DEC-663 (wave-64 amendment): contactId === null selects 'Import as
  // new' (the default, absent from the map). Picking a merge target clears
  // that line's Skip checkbox -- the mirror of toggleSkipLine above.
  function setMergeSelection(line: number, contactId: string | null) {
    setMergeSelections((prev) => {
      const next = new Map(prev);
      if (contactId) next.set(line, contactId);
      else next.delete(line);
      return next;
    });
    if (contactId && skipLines.has(line)) {
      setSkipLines((prev) => {
        const next = new Set(prev);
        next.delete(line);
        return next;
      });
    }
  }

  // G13 (frame 08-contacts--13): the review step's back path -- drops only
  // the stale plan; the parsed file, mapping and match-step state all
  // survive, so the organizer lands back on Match the columns.
  function backToMatchColumns() {
    setPlan(null);
    setPlannedRequest(null);
    setSkipLines(new Set());
    setMergeSelections(new Map());
    setShowAllRows(false);
    setFieldErrors(null);
    setError(null);
  }

  async function runCommit() {
    if (!plannedRequest) return;
    setBusy(true);
    setError(null);
    setFieldErrors(null);
    try {
      const mergeLines = [...mergeSelections.entries()].map(([line, contactId]) => ({ line, contactId }));
      const res = await apiPost<ImportResult>('/contacts/import', {
        ...plannedRequest,
        skipLines: [...skipLines],
        mergeLines,
      });
      setResult(res);
      onImported();
    } catch (err) {
      handleImportApiError(err, 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  // docs/design/Chautauqua Contacts.dc.html:800 draws a third, tertiary
  // action on the file-level refusal -- `Download the 9 rows` -- beside
  // `Import the N good rows` / `Upload a different file`. DEC-745
  // (wave-108 amendment): BUILT, not deferred -- the component already
  // holds header, allDataRows and badRows (each carrying its 1-based
  // `line`), which is exactly the rejected set the frame offers, so "no
  // data model behind the drawing" does not apply. No src/decisions.ts
  // export exists for this DEC-745 amendment to compile-check against
  // (same as the DEC-290 note above; never hand-add one here).
  //
  // Serialized VERBATIM -- the header plus the rejected rows in their
  // original order, never re-derived and never re-ordered -- because the
  // point of the download is that the organiser fixes those exact rows in
  // the file and re-uploads it. Uses the shared toCsv (not toCsvVerbatim,
  // which is reserved for this component's own preview->commit round trip
  // and must never back an export surface -- see ./csv.ts) so the
  // downloaded file gets the same DEC-179 formula-injection neutralization
  // as every other CSV export in the app.
  function downloadRejectedRows() {
    const badLines = new Set(badRows.map((r) => r.line));
    const rejected = allDataRows.filter((_, i) => badLines.has(i + 2));
    const csv = toCsv([header, ...rejected]);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    const base = (fileName ?? 'import.csv').replace(/\.csv$/i, '');
    anchor.download = `${base}-rejected-rows.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const actions = showSizeRefusal ? (
    <button type="button" className="chq-btn chq-btn-secondary" onClick={resetToChooseFile}>
      Choose a different file
    </button>
  ) : showFileWarning ? (
    <>
      <button
        type="button"
        className="chq-btn chq-btn-primary"
        onClick={() => setWarningAcknowledged(true)}
      >
        Import the {countOf(allDataRows.length - badRows.length, 'good row', 'good rows')}
      </button>
      <button type="button" className="chq-btn chq-btn-secondary" onClick={resetToChooseFile}>
        Upload a different file
      </button>
      <button type="button" className="chq-btn chq-btn-tertiary" onClick={downloadRejectedRows}>
        Download the {countOf(badRows.length, 'row')}
      </button>
    </>
  ) : result ? (
    <button type="button" className="chq-btn chq-btn-primary" onClick={onClose}>
      Done
    </button>
  ) : plan ? (
    <>
      <button
        type="button"
        className={`chq-btn chq-btn-primary ${importPendingLabel.buttonProps.className}`.trim()}
        disabled={importPendingLabel.buttonProps.disabled}
        onClick={runCommit}
      >
        {importPendingLabel.label}
      </button>
      {/* G13 (frame 08-contacts--13): a footer Back beside the primary --
          the second of the frame's two return paths to the match step. */}
      <button type="button" className="chq-btn chq-btn-secondary" onClick={backToMatchColumns} disabled={busy}>
        Back
      </button>
      <button type="button" className="chq-btn chq-btn-secondary" onClick={onClose}>
        Cancel
      </button>
    </>
  ) : (
    <>
      <button
        type="button"
        className="chq-btn chq-btn-primary"
        disabled={
          busy ||
          dataRows.length === 0 ||
          (!!eventId && attachToEvent && sessionTitle.trim() === '') ||
          !!mappingValidationError
        }
        onClick={() => void runPreview()}
      >
        Import {countOf(dataRows.length, 'row')}
      </button>
      <button type="button" className="chq-btn chq-btn-secondary" onClick={onClose}>
        Cancel
      </button>
      {/* w40-h: names the blocker on the disabled primary instead of leaving
          an unexplained disabled button -- disappears the moment the field
          that unblocks it is filled. */}
      {!!eventId && attachToEvent && sessionTitle.trim() === '' && (
        <span className="chq-contacts-import-blocker">Add a session title for this batch to preview</span>
      )}
    </>
  );

  return (
    <ModalFrame
      title={stepTitle}
      subtitle="Import contacts from CSV"
      ariaLabel="Import contacts"
      onClose={onClose}
      closeDisabled={busy}
      modalClassName="chq-contacts-import"
      size="wide"
      actions={actions}
    >
      <ol className="chq-steps" aria-label="Import steps">
        <li className={`chq-step${step > 1 ? ' is-done' : step === 1 ? ' is-current' : ''}`}>Choose file</li>
        <li className={`chq-step${step > 2 ? ' is-done' : step === 2 ? ' is-current' : ''}`}>Match columns</li>
        <li className={`chq-step${step > 3 ? ' is-done' : step === 3 ? ' is-current' : ''}`}>Review</li>
        <li className={`chq-step${step === 4 ? ' is-current' : ''}`}>Done</li>
      </ol>

      {error && <div className="chq-error">{error}</div>}

      {/* DEC-856: refusal keys this wizard doesn't route to a specific
          control (e.g. a key added to the route after this wizard was
          last touched) render labelled here instead of being dropped --
          the whole batch was refused, so `kept` says nothing was
          imported, unlike the DEC-575 file-level warning above which keeps
          the file loaded. */}
      {unmatchedFieldEntries.length > 0 && (
        <div className="chq-error-summary" role="alert">
          <p className="chq-error-summary-heading">
            {thingsNeedFixingHeading(unmatchedFieldEntries.length, 'before this import can run')}
          </p>
          <ul className="chq-error-summary-rows">
            {unmatchedFieldEntries.map(([key, message]) => (
              <li key={key}>
                {key}: {message}
              </li>
            ))}
          </ul>
          <p className="chq-error-summary-kept">Nothing was imported.</p>
        </div>
      )}

      {/* DEC-478 (amendment, wave 62): a file-level, pre-mapping refusal for
          a file over either cap -- rendered above the step content, in the
          same error-vocabulary grammar as the DEC-575 email-warning block
          below (summarize, count the overage, offer the way out). The file
          itself is never cleared automatically; "Choose a different file"
          is the only reset. */}
      {showSizeRefusal && (
        <div className="chq-error-summary" role="alert">
          <p className="chq-error-summary-heading">
            {overRowCount > 0
              ? `${allDataRows.length} ${plural(allDataRows.length, 'row')} — ${overRowCount} over the ${MAX_IMPORT_ROWS}-row limit`
              : `${formatBytes(csvByteLength)} — ${formatBytes(overByteCount)} over the ${formatBytes(MAX_IMPORT_CSV_BYTES)} limit`}
          </p>
          <p className="chq-error-summary-detail">Split the file and import each part.</p>
        </div>
      )}

      {/* DEC-575 (wave 28 amendment): a file-level, pre-mapping block for
          rows missing the dedupe key (email) -- rendered above the step
          content, offering a partial import instead of proceeding silently
          or failing whole. Reuses the SPA's shared .chq-error-summary
          vocabulary (DEC-124) by class name only; the file itself is never
          cleared by this state. */}
      {showFileWarning && (
        <div className="chq-error-summary" role="alert">
          <p className="chq-error-summary-heading">
            {badRows.length} of {allDataRows.length} rows have no email address
          </p>
          <p className="chq-error-summary-detail">
            Email is how a contact is matched and how anything reaches them, so a row without one cannot be
            created.
          </p>
          {/* G13 (frame 08-contacts--15): every rejected row names its own
              reason -- blank, a placeholder like "n/a", a missing @ -- in
              the frame's vocabulary, capped at ten rows then 'and N more'
              (DEC-575). */}
          <ul className="chq-error-summary-rows">
            {listedBadRows(badRows).map((row) => (
              <li key={row.line}>
                Row {row.line} — {row.problem}
              </li>
            ))}
            {badRows.length > listedBadRows(badRows).length && (
              <li>and {badRows.length - listedBadRows(badRows).length} more</li>
            )}
          </ul>
          <p className="chq-error-summary-kept">Nothing was lost — the file is still loaded.</p>
        </div>
      )}

      {/* Step 1 -- choose a file, unmounted entirely once a header row has
          been parsed AND is within both caps (from either the file input or
          the paste box) so it never shares the screen with step 2's
          column-matching UI. Stays mounted for an oversize file
          (showSizeRefusal) so "Choose a different file" has controls to
          come back to. */}
      {(forceStep1 || header.length === 0 || showSizeRefusal) && !plan && !result && (
        <div className="chq-contacts-import-drop">
          <FormRow label="Upload a CSV file" htmlFor="import-csv-file">
            <input
              id="import-csv-file"
              className="chq-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
              placeholder="contacts.csv"
            />
          </FormRow>
          {/* DEC-856: csvText is the raw text either control produces --
              the required/over-byte/over-row refusals all attach here,
              beside the control that actually holds the value the server
              rejected. */}
          <FormRow label="Or paste CSV text" htmlFor="import-csv-text" error={csvTextFieldError}>
            <textarea
              id="import-csv-text"
              className="chq-textarea"
              rows={8}
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                setFieldErrors(null);
                setForceStep1(false);
              }}
              placeholder="firstName,lastName,email..."
            />
          </FormRow>

          {/* DEC-478 (amendment, wave 62): the row/byte caps disclosed where
              the file is chosen, not only in the 400 at the end. */}
          <p className="chq-contacts-pipeline-caption">
            Up to {countOf(MAX_IMPORT_ROWS, 'row')} · {formatBytes(MAX_IMPORT_CSV_BYTES)} max
          </p>

          {parseError && <div className="chq-error">{parseError}</div>}
        </div>
      )}

      {/* Step 2 (frame 08--03) -- file/paste controls are gone; one block
          per CSV column pairs its header with a sample value from the file
          and the target select beneath it, plus a dashed "skip this
          column" affordance. Does not touch the dry-run/commit contract
          (DEC-663): mapping state feeds the same runPreview() call as
          before, unchanged below. */}
      {!forceStep1 && header.length > 0 && !plan && !result && !showSizeRefusal && !showFileWarning && (
        <div className="chq-contacts-import-match">
          <div className="chq-contacts-import-match-head">
            <span className="chq-contacts-import-match-filename">{fileName ?? 'Pasted CSV'}</span>
            <span className="chq-contacts-import-match-count">{countOf(dataRows.length, 'row')}</span>
          </div>

          {parseError && <div className="chq-error">{parseError}</div>}

          {/* DEC-856: a required/invalid `mapping` refusal (including the
              column-mapping-invalid shape, whose message already names the
              offending column) attaches here, above the per-column grid it
              describes. */}
          {mappingFieldError && (
            <div className="chq-error" id="import-mapping-error" role="alert">
              {mappingFieldError}
            </div>
          )}

          {/* DEC-478 (amendment, wave 47): the SAME injectivity rule the
              server door enforces, run inline as the mapping is edited --
              never a second copy -- naming the duplicated target and both
              offending columns, blocking Continue (see the primary button's
              disabled expression) before a dry run is ever attempted. */}
          {!mappingFieldError && mappingValidationError && (
            <div className="chq-error" id="import-mapping-duplicate-error" role="alert">
              {mappingValidationError}
            </div>
          )}

          {/* DEC-290 (wave-59 amendment): a supplied eventId is a
              CANDIDATE, not an instruction -- this unchecked-by-default
              opt-in is the one control every add-to-event behaviour below
              hangs off (the session-title field, its required-ness, the
              preview guard, the request keys, the disabled-primary blocker
              hint). With it off the request carries neither eventId nor
              sessionTitle and the import writes contacts only. */}
          {eventId && (
            <label className="chq-checkbox-label" htmlFor="import-attach-to-event">
              <input
                id="import-attach-to-event"
                className="chq-check"
                type="checkbox"
                checked={attachToEvent}
                onChange={(e) => setAttachToEvent(e.target.checked)}
              />
              Also add these people to {eventName ?? 'this event'} as accepted speakers
            </label>
          )}

          {/* DEC-810: the session title is collected here, in the match
              panel, once the event is already chosen (eventId) AND the
              DEC-290 opt-in above is on -- not in step 1's file/paste
              screen, which has no other event-scoped state. */}
          {eventId && attachToEvent && (
            <FormRow
              label="Session title for this batch"
              htmlFor="import-session-title"
              help="Every contact added to this event by this import joins ONE accepted session with this title."
              error={eventFieldError}
            >
              <input
                id="import-session-title"
                className="chq-input"
                maxLength={MAX_NAME_LENGTH}
                value={sessionTitle}
                onChange={(e) => {
                  setSessionTitle(e.target.value);
                  setFieldErrors(null);
                }}
                placeholder="e.g. Lightning talks"
                required
              />
            </FormRow>
          )}

          {/* G13 (frame 08-contacts--03): one full-width row per CSV column
              -- column name over a sample value on the left, an → glyph
              mid-row, the target select right-flushed. The unmapped state
              IS the select, rendered in the dashed skip register with
              'Skip this column' as its empty option -- not an '(ignore)'
              option plus a separate button. */}
          <div className="chq-contacts-import-columns">
            {header.map((col, i) => {
              const sample = dataRows[0]?.[i] ?? '';
              const skipped = !mapping[col];
              return (
                <div key={col} className="chq-contacts-import-column-row">
                  <div className="chq-contacts-import-column-id">
                    <div className="chq-contacts-import-column-header">{col}</div>
                    <div className="chq-contacts-import-column-sample">
                      {sample !== '' ? sample : <em className="chq-contacts-import-preview-cell-skip">(blank)</em>}
                    </div>
                  </div>
                  <span className="chq-contacts-import-column-arrow" aria-hidden="true">
                    →
                  </span>
                  <select
                    className={`chq-select chq-contacts-import-column-select${skipped ? ' is-skipped' : ''}`}
                    aria-label={`Map column ${col}`}
                    value={mapping[col] ?? ''}
                    onChange={(e) => setColumnMapping(col, e.target.value)}
                  >
                    <option value="">Skip this column</option>
                    {STANDARD_IMPORT_FIELDS.map((f) => (
                      <option key={f} value={f}>
                        {importFieldLabel(f)}
                      </option>
                    ))}
                    <option value={FULL_NAME_TARGET}>Full name (splits into first / last)</option>
                    <option value={`custom.${col}`}>Custom: {col}</option>
                  </select>
                </div>
              );
            })}
          </div>

          {/* v12m-w1-f: PHONE-ONLY -- one source column at a time (frame
              "Import CSV · 390" `One column per screen`, docs/design/
              Chautauqua Contacts.dc.html:483, body :487-511: `Column 2 of
              5` eyebrow, the column name at display-face 22px, a "First
              three values" line, an "Import it as" rule, then the target
              choices as a marked radio list -- not the desktop <select>
              above). Hidden by default; shown only inside contacts-
              panels.css's max-width:700px layer. Reads/writes the SAME
              `mapping` state as the desktop grid above -- `mapping`, the
              injective check and the POST body are unchanged by this
              block; `phoneColumnIndex` only decides which column is
              currently in view. */}
          {header.length > 0 &&
            (() => {
              const col = header[Math.min(phoneColumnIndex, header.length - 1)]!;
              const colIdx = header.indexOf(col);
              const samples = dataRows
                .slice(0, 3)
                .map((row) => row[colIdx] ?? '')
                .filter((v) => v !== '');
              const current = mapping[col] ?? '';
              return (
                <div className="chq-contacts-import-phone-column">
                  <span className="chq-contacts-import-phone-eyebrow">
                    Column {phoneColumnIndex + 1} of {header.length}
                  </span>
                  <span className="chq-contacts-import-phone-name">{col}</span>
                  {samples.length > 0 && (
                    <span className="chq-contacts-import-phone-samples">
                      First three values: {samples.join(', ')}
                    </span>
                  )}
                  <div className="chq-contacts-import-phone-rule">
                    <span className="chq-contacts-import-phone-rule-label">Import it as</span>
                  </div>
                  <div
                    className="chq-contacts-import-phone-targets"
                    role="radiogroup"
                    aria-label={`Map column ${col}`}
                  >
                    {phoneImportTargetOptions(col).map((opt) => (
                      <label key={opt.value || '(skip)'} className="chq-contacts-import-phone-target-row">
                        <input
                          type="radio"
                          className="chq-contacts-import-phone-target-input"
                          name={`phone-target-${col}`}
                          checked={current === opt.value}
                          onChange={() => setColumnMapping(col, opt.value)}
                        />
                        <span className="chq-contacts-import-phone-target-mark" aria-hidden="true" />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })()}

          {/* w49-f: conditional-and-quiet -- names the in-file collision it
              actually counted (an earlier row in THIS file with the same
              email), and renders nothing at zero rather than a false "0
              rows match existing contacts". DEC-663 (wave-87 amendment,
              finding 2): this note sits beneath the DESKTOP column grid
              only -- .chq-contacts-import-dedupe is hidden at phone width
              (contacts-panels.css) rather than repositioned under the
              phone radio list. The frame's own literal text at that phone
              position ("9 rows match an existing contact by email · those
              get updated") can only come from the dry run's plan.updated,
              which does not exist at this step; rather than fabricate that
              count from the in-file dedupe measurement, the phone pager
              shows nothing here and the true, plan-sourced note
              (.chq-contacts-import-matched below) appears once the dry run
              has actually run, on the Review step. See
              docs/design/audit/contacts-v12.md finding 2. */}
          {dedupeCount > 0 && (
            <p className="chq-contacts-import-dedupe">
              Same-file email repeat: {countOf(dedupeCount, 'row')} · the later row wins
            </p>
          )}

          {/* v12m-w1-f, DEC-663 (wave-87 amendment, finding 3): PHONE-ONLY
              sticky dock for the pager above -- page-owned (this component
              + contacts-panels.css only), NOT the shared ModalFrame footer
              (`actions`, rendered below by ModalFrame regardless of
              width) -- consolidating the two phone docks is out of this
              task's scope; see docs/design/audit/contacts-v12.md finding
              1. On every column but the last, "Next column" keeps
              whatever mapping choice is already selected for the current
              column and advances; "Skip" clears this column's mapping
              (same as picking "Skip this column" above) and advances. On
              the LAST column both buttons instead run the same
              runPreview() the desktop Review step runs, advancing into
              the dry run -- "Next column"/"Skip" become a path INTO the
              plan rather than clamping at a dead end. Skip passes
              runPreview an explicit override mapping (the column just
              cleared) rather than relying on the not-yet-applied
              setColumnMapping state update. */}
          {header.length > 0 &&
            (() => {
              const isLastPhoneColumn = phoneColumnIndex >= header.length - 1;
              const previewBlocked =
                busy ||
                dataRows.length === 0 ||
                (!!eventId && attachToEvent && sessionTitle.trim() === '') ||
                !!mappingValidationError;
              return (
                <div className="chq-contacts-import-phone-dock" data-chq-phone-dock>
                  <button
                    type="button"
                    className="chq-btn chq-btn-primary chq-contacts-import-phone-next"
                    disabled={isLastPhoneColumn && previewBlocked}
                    onClick={() => {
                      if (isLastPhoneColumn) {
                        void runPreview();
                      } else {
                        setPhoneColumnIndex((i) => Math.min(i + 1, header.length - 1));
                      }
                    }}
                  >
                    {isLastPhoneColumn ? `Review ${countOf(dataRows.length, 'row')}` : 'Next column'}
                  </button>
                  <button
                    type="button"
                    className="chq-btn chq-btn-secondary chq-contacts-import-phone-skip"
                    disabled={isLastPhoneColumn && previewBlocked}
                    onClick={() => {
                      const col = header[Math.min(phoneColumnIndex, header.length - 1)]!;
                      setColumnMapping(col, '');
                      if (isLastPhoneColumn) {
                        const nextMapping = { ...mapping };
                        delete nextMapping[col];
                        void runPreview(nextMapping);
                      } else {
                        setPhoneColumnIndex((i) => Math.min(i + 1, header.length - 1));
                      }
                    }}
                  >
                    Skip
                  </button>
                </div>
              );
            })()}
        </div>
      )}

      {plan && !result && (
        <div className="chq-contacts-import-review">
          {/* G13 (frame 08-contacts--13): a wrong mapping must be fixable
              without closing and re-uploading -- this tertiary link (and
              the footer's Back) return to the match step with the file and
              mapping intact; only the stale plan is dropped. */}
          <button type="button" className="chq-btn chq-btn-tertiary chq-contacts-import-review-back" onClick={backToMatchColumns}>
            ‹ Match the columns
          </button>
          {/* B5 (DEC-663 amendment, w27-i): the heading names the two counts
              the dedupe outcome earns -- created/updated straight from the
              dry run's plan, not a re-derivation from the rows array --
              instead of the generic "Review before import" that named
              nothing the organizer didn't already know. 'new'/'updated' are
              invariant adjectives (never "1 news"), so countOf is called
              with an explicit pluralForm equal to the singular rather than
              inventing a second helper. G13 (frame 08-contacts--13, ruling
              B5 'two counts as a heading'): the counts ARE the step's
              heading -- sentence case at heading size, never an 11px
              micro-label -- with the file · rows · match-key line as its
              sub. */}
          <h3 className="chq-contacts-import-review-heading">
            {countOf(plan.created, 'new', 'new')} · {countOf(plan.updated, 'updated', 'updated')}
          </h3>
          <p className="chq-contacts-import-review-sub">
            {fileName ?? 'Pasted CSV'} · {countOf(plan.rows.length, 'row')} · matched on email
          </p>
          {/* w49-f: the existing-contacts claim moved here from the match
              step's dedupe footer -- sourced straight from the dry run's
              own plan.updated, never re-derived from the rows array. */}
          {plan.updated > 0 && (
            <p className="chq-contacts-import-matched">
              {countOf(plan.updated, 'row')} matched an existing contact by email · they will be updated
            </p>
          )}
          <table className="chq-table chq-contacts-import-review-table">
            <thead>
              <tr>
                <th className="chq-contacts-import-review-col-line">Line</th>
                <th className="chq-contacts-import-review-col-email">Email</th>
                <th>Action</th>
                <th className="chq-contacts-import-review-col-skip">Skip this row</th>
              </tr>
            </thead>
            <tbody>
              {visiblePlanRows.map((row) => {
                const updateReason = row.action === 'update' ? row.reason : undefined;
                const decorated =
                  (row.overwrites?.length ?? 0) > 0 || (row.possibleDuplicates?.length ?? 0) > 0 || Boolean(updateReason);
                return (
                  <tr key={row.line}>
                    <td className="chq-contacts-import-review-col-line">{row.line}</td>
                    <td className="chq-contacts-import-review-col-email">{row.email}</td>
                    <td>
                      {actionLabel(row)}
                      {decorated && (
                        <ul className="chq-contacts-import-review-detail">
                          {updateReason && <li>{updateReason}</li>}
                          {/* G13 (frame 08-contacts--13): diffs read
                              'Title ~~Senior Engineer~~ → Principal
                              Engineer' -- Capitalised human label, explicit
                              arrow -- never the machine field key. */}
                          {(row.overwrites ?? []).map((ow, i) => (
                            <li key={`ow-${i}`}>
                              <strong>{importFieldLabel(ow.field)}</strong>{' '}
                              <s className="chq-contacts-import-overwrite-old">{ow.from}</s> {'→'}{' '}
                              <span className="chq-contacts-import-overwrite-new">{ow.to}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {/* DEC-663 (wave-64 amendment): the third disposition
                          for a possible duplicate -- 'Import as new' (the
                          default) or 'Merge into <name> (<email>)' per
                          candidate, a natural-width radio group rather than
                          a bare select. Mutually exclusive with the row's
                          Skip checkbox (see setMergeSelection/
                          toggleSkipLine): a line is skipped or merged,
                          never both. */}
                      {(row.possibleDuplicates ?? []).length > 0 && (
                        <fieldset
                          className="chq-contacts-import-review-dupe-group"
                          role="radiogroup"
                          aria-label={`Possible duplicate for line ${row.line}`}
                        >
                          <label className="chq-checkbox-label">
                            <input
                              className="chq-check"
                              type="radio"
                              name={`import-merge-${row.line}`}
                              checked={!mergeSelections.get(row.line)}
                              onChange={() => setMergeSelection(row.line, null)}
                            />
                            Import as new
                          </label>
                          {(row.possibleDuplicates ?? []).map((dup) => (
                            <label key={dup.contactId} className="chq-checkbox-label">
                              <input
                                className="chq-check"
                                type="radio"
                                name={`import-merge-${row.line}`}
                                checked={mergeSelections.get(row.line) === dup.contactId}
                                onChange={() => setMergeSelection(row.line, dup.contactId)}
                              />
                              Merge into {dup.name} ({dup.email})
                            </label>
                          ))}
                          {typeof row.possibleDuplicatesMore === 'number' && row.possibleDuplicatesMore > 0 && (
                            <p className="chq-contacts-import-review-dupe-more">
                              {countOf(row.possibleDuplicatesMore, 'more possible match', 'more possible matches')} not
                              shown — check the directory's Duplicates view.
                            </p>
                          )}
                        </fieldset>
                      )}
                    </td>
                    <td className="chq-contacts-import-review-col-skip">
                      <label className="chq-contacts-import-review-skip">
                        <input
                          className="chq-check"
                          type="checkbox"
                          checked={skipLines.has(row.line)}
                          onChange={() => toggleSkipLine(row.line)}
                          aria-label={`Skip line ${row.line}`}
                        />
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* w49-f: the rows hidden by default are the clean creates --
              plan.created's own count, never re-derived -- reachable
              without losing Skip on any of them. */}
          {!showAllRows && hiddenRowCount > 0 && (
            <div className="chq-contacts-import-review-disclosure">
              <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => setShowAllRows(true)}>
                Show all {countOf(sortedPlanRows.length, 'row')}
              </button>
              <p className="chq-contacts-import-review-caption">
                {countOf(plan.created, 'new contact', 'new contacts')} not shown here — nothing to review
              </p>
            </div>
          )}

          <p className="chq-contacts-pipeline-caption">{countOf(skipLines.size, 'row')} marked to skip.</p>

          {/* DEC-856: a `skipLines` refusal (malformed skip-row selection)
              attaches beside the control it describes rather than only the
              generic top-of-form error. */}
          {skipLinesFieldError && (
            <div className="chq-error" id="import-skip-lines-error" role="alert">
              {skipLinesFieldError}
            </div>
          )}

          {/* B5: an irreversibility line, immediately above the commit
              action -- ModalFrame renders `children` then the actions div
              right after (see ModalFrame.tsx), so this is the last thing in
              the review step's own content. */}
          <p className="chq-contacts-import-irreversible">
            Importing cannot be undone in bulk — a skipped row can be imported later.
          </p>
        </div>
      )}

      {result && (
        <div className="chq-contacts-import-summary">
          <h3 className="chq-section-label">Import complete</h3>
          <p>
            Created {result.created}, updated {result.updated}, skipped {result.skipped.length}.
          </p>
          {eventId && <p>Added {result.addedToEvent ?? 0} to this event.</p>}
          {result.skipped.length > 0 && (
            <ul className="chq-contacts-import-skipped">
              {result.skipped.map((s) => (
                <li key={s.line}>
                  Line {s.line}: {s.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </ModalFrame>
  );
}
