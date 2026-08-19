import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCurrentEvent } from '../lib/useCurrentEvent';
import { PageSkeleton } from '../components/PageSkeleton';
import { apiList, ApiError } from '../lib/api';
import { useMutationVersion } from '../lib/mutationSignal';
import { TemplatesTab } from './comms/TemplatesTab';
import { ComposeWizard } from './comms/ComposeWizard';
import { HistoryTab } from './comms/HistoryTab';
import { RecentSends, sentCountLabel } from './comms/RecentSends';
import { PhoneDraftCard } from './comms/PhoneDraftCard';
import { readComposeDraft, type ComposeDraft } from './comms/composeDraft';
import { formatSendRhythm, formatPhoneSendRhythm } from './comms/sendRhythm';
import { formatDateTime } from '../lib/dates';
import type { EmailBatchRow, EmailLogRow, EmailTemplate } from './comms/types';
import './comms/comms.css';

// DEC-905: the send rhythm the head states — "N sent in the last 7 days" —
// windows on the wall-clock, not on the batches page under Compose.
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// DEC-751: Recent sends is capped to four rows under Compose so an
// organiser composing a send can see what already went out (the context
// that prevents sending the same batch twice) without History's full,
// paginated list crowding the compose column.
const COMPOSE_RECENT_SENDS_LIMIT = 4;

type Tab = 'compose' | 'templates' | 'history';

const TABS: { id: Tab; label: string }[] = [
  { id: 'compose', label: 'Compose' },
  { id: 'templates', label: 'Templates' },
  { id: 'history', label: 'History' },
];

const TAB_IDS = TABS.map((t) => t.id);

function isTab(value: string | null): value is Tab {
  return value !== null && (TAB_IDS as string[]).includes(value);
}

export function CommsPage() {
  const { eventId, loading, error } = useCurrentEvent();
  // DEC-710: the tab strip reads/writes ?tab= so it is bookmarkable and
  // participates in browser back/forward. An absent or unknown ?tab= falls
  // back to compose.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tab: Tab = isTab(rawTab) ? rawTab : 'compose';
  // DEC-621 amendment (v12 mobile campaign w1, planner's ruling): at phone
  // width the page opens on a landing screen -- the frame's own dashboard
  // (head + an in-progress draft, when one exists + a read-only recent-
  // sends list), rather than dropping straight into compose step 1. SSR
  // can't know the viewport, so both the landing block and the regular
  // head+tab content always render; a JS app-state flag (not a width
  // check) toggles which one the phone stylesheet shows -- desktop never
  // reads this flag (the CSS rules that key off it only exist inside the
  // 700px media query in comms.css).
  //
  // DEC-621 wave-109 amendment (task w5-q): a recognised `?tab=` names a
  // screen the visitor already chose (a bookmark, a deep link, browser
  // back/forward per DEC-710) -- the landing would otherwise reassert
  // itself over that choice every time this component mounts, since
  // `phoneEntered` used to always start false. Read once, at mount, from
  // `isTab(rawTab)` (the same predicate `tab` above already uses) rather
  // than kept in sync by an effect: `setPhoneEntered(false)` (the drill-
  // ins' `onBack`) must be able to return to the landing without an
  // effect immediately re-deriving `true` from a `?tab=` that is still
  // sitting in the URL -- an initializer only runs once, so the back path
  // never fights it.
  const [phoneEntered, setPhoneEntered] = useState(() => isTab(rawTab));

  // DEC-700/DEC-905: every successful non-GET already bumps this counter in
  // api.ts -- subscribing here means both the Recent Sends mount and the
  // head's send-rhythm subtitle hold one current answer, refetched the
  // moment a send succeeds rather than staying on whatever was true before
  // the organizer's last action.
  const mutationVersion = useMutationVersion();

  // v12 mobile campaign w5 (DEC-621 wave-87 amendment): the draft the
  // landing's "Draft in progress" card draws, read from ComposeWizard's own
  // localStorage record (composeDraft.ts) -- see PhoneDraftCard's doc
  // comment for why the frame's provenance clause is dropped rather than
  // fabricated. Re-read on `mutationVersion` too, so a successful send
  // (which clears the stored record) drops the card without a reload.
  const [draftRecord, setDraftRecord] = useState<ComposeDraft | null>(null);
  useEffect(() => {
    if (!eventId) return;
    setDraftRecord(readComposeDraft(eventId));
  }, [eventId, mutationVersion]);

  // DEC-518 wave-43 amendment: the head's send-rhythm subtitle and Recent
  // Sends both depend on the two fetches below -- a failed read must not
  // sit silently as a permanent loading state or a permanent "0 sent"; it
  // is named here, on the one page whose job is the send audit trail.
  const [loadError, setLoadError] = useState<string | null>(null);

  // DEC-751/DEC-905: fed by the same GET .../email-log?groupBy=batch call
  // History uses. Previously gated on tab === 'compose' so the head (which
  // needs the latest batch's date for its subtitle) never saw it while on
  // another tab -- the fetch now runs regardless of which tab is active.
  const [recentBatches, setRecentBatches] = useState<EmailBatchRow[]>([]);
  const [batchesLoaded, setBatchesLoaded] = useState(false);
  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    apiList<EmailBatchRow>(`/events/${eventId}/email-log?groupBy=batch`)
      .then((res) => {
        if (!cancelled) {
          setRecentBatches(res.items);
          setBatchesLoaded(true);
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Failed to load recent sends');
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, mutationVersion]);

  // DEC-905: the head's "N sent in the last 7 days" reads its OWN request's
  // envelope total under the new `since` filter, scoped to `status=sent` --
  // never a sum over a page of batches, which would go wrong the moment the
  // batch list is paginated or capped, and never the unfiltered envelope
  // total, which would count failed sends as if they went out.
  const [sentLast7Days, setSentLast7Days] = useState(0);
  const [failedLast7Days, setFailedLast7Days] = useState(0);
  const [sentLast7DaysLoaded, setSentLast7DaysLoaded] = useState(false);
  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    const since = Date.now() - SEVEN_DAYS_MS;
    Promise.all([
      apiList<EmailLogRow>(`/events/${eventId}/email-log?since=${since}&status=sent&perPage=1`),
      apiList<EmailLogRow>(`/events/${eventId}/email-log?since=${since}&status=failed&perPage=1`),
    ])
      .then(([sentRes, failedRes]) => {
        if (!cancelled) {
          setSentLast7Days(sentRes.total);
          setFailedLast7Days(failedRes.total);
          setSentLast7DaysLoaded(true);
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Failed to load send totals');
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, mutationVersion]);

  // w1-g: fetched once here (not by History or the compose mount
  // separately) and passed to both RecentSends mounts, so the same four
  // sends render the same template names whichever mount is on screen --
  // required prop on RecentSends means a third mount can't repeat the
  // Compose-mount em-dash bug by forgetting to pass it.
  const [templatesById, setTemplatesById] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    apiList<EmailTemplate>(`/events/${eventId}/templates`)
      .then((res) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const t of res.items) map[t.id] = t.name;
        setTemplatesById(map);
      })
      .catch(() => {
        // The template label is a courtesy annotation on an already-shown
        // send record, not the record itself -- a failure to load the
        // template list must not block or blank either Recent Sends mount.
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // DEC-751 amendment (w15-d): "All history" on the compose mount's Recent
  // Sends switches to the History tab -- the per-row "Open" no longer hands
  // off here (it drills in place on both mounts now), so this always clears
  // any stale ?batch=<key> rather than setting one.
  function goToHistory() {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('tab', 'history');
      params.delete('batch');
      return params;
    });
  }

  function choosePhoneTab(t: Tab) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('tab', t);
      return params;
    });
    setPhoneEntered(true);
  }

  if (loading) {
    return (
      <div className="chq-page chq-measure-table">
        <h1 className="chq-page-title">Comms</h1>
        <PageSkeleton variant="table" />
      </div>
    );
  }

  if (error || !eventId) {
    return (
      <div className="chq-page chq-measure-table">
        <h1 className="chq-page-title">Comms</h1>
        <div className="chq-error">{error ?? 'No event selected.'}</div>
      </div>
    );
  }

  // w1-g: the Templates tab is an editor (Name/Subject/Body fields), not a
  // table -- it takes the 820 reading measure on the PAGE container itself,
  // same as any other reading page, while Compose/History (both row-and-
  // column layouts) stay at the 1440 table measure. This clamps on the SAME
  // chq-page root every other tab uses, not an inner body wrapper (the
  // previous attempt's mistake, filed three times over).
  const pageMeasureClass = tab === 'templates' ? 'chq-measure' : 'chq-measure-table';

  // DEC-905 (wave-59 amendment): the send rhythm has ONE producer -- built
  // here from the envelope-derived totals plus the latest all-time batch's
  // date, and handed (never re-derived) to both the head and BOTH RecentSends
  // mounts, so all three agree by construction rather than by convention.
  const rhythm =
    sentLast7DaysLoaded && batchesLoaded
      ? { sentLast7Days, failedLast7Days, lastSentAt: recentBatches[0]?.sentAt ?? null }
      : null;

  return (
    <div className={`chq-page chq-comms-page ${pageMeasureClass}`}>
      <div className={phoneEntered ? 'chq-comms-main' : 'chq-comms-main chq-comms-main-landing'}>
        {/* DEC-518 wave-43 amendment: a failed recent-batches or send-totals
            read names itself here instead of leaving the head subtitle and
            Recent Sends sitting in a permanent loading state / "0 sent". */}
        {loadError && (
          <div className="chq-error" role="alert">
            {loadError}
          </div>
        )}
        <div className="chq-comms-head">
          <div className="chq-comms-head-titles">
            <h1 className="chq-page-title">Comms</h1>
            {/* DEC-905: states the send rhythm -- a count windowed on the
                wall-clock (never a sum over a page of batches) plus the most
                recent send's date, taken from the same all-time batch list
                Recent Sends renders. */}
            {rhythm && <p className="chq-comms-head-subtitle">{formatSendRhythm(rhythm)}</p>}
          </div>
          <div className="chq-comms-head-actions" role="tablist">
            {/* w4-g (DEC-890 amendment): Templates is its own page (a
                breadcrumb back to Comms, not a peer tab) -- the Compose
                pill is chrome left over from the shared tab strip and has
                no destination while already on Templates, so it's dropped
                here. Templates/History stay so the strip can still switch
                straight to History without detouring through Compose. */}
            {TABS.filter((t) => tab !== 'templates' || t.id !== 'compose').map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={tab === t.id ? 'chq-pill is-active' : 'chq-pill'}
                onClick={() => choosePhoneTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'compose' && (
          <>
            <ComposeWizard eventId={eventId} />
            <RecentSends
              eventId={eventId}
              batches={recentBatches}
              batchesLoaded={batchesLoaded}
              limit={COMPOSE_RECENT_SENDS_LIMIT}
              onSeeAll={goToHistory}
              templatesById={templatesById}
              rhythm={rhythm}
            />
          </>
        )}
        {tab === 'templates' && <TemplatesTab eventId={eventId} onBack={() => setPhoneEntered(false)} />}
        {tab === 'history' && <HistoryTab eventId={eventId} templatesById={templatesById} rhythm={rhythm} onBack={() => setPhoneEntered(false)} />}
      </div>

      {/* v12 mobile campaign w1 (DEC-621 amendment; planner's ruling):
          phone-only landing, frame docs/design/Chautauqua Comms.dc.html:177
          ('Comms', 390). Hidden by default (top-level display:none in
          comms.css); shown inside the 700px media query only while
          chq-comms-phone-landing-show is present, i.e. before the visitor
          has entered via the draft card below. */}
      <div
        className={
          phoneEntered ? 'chq-comms-phone-landing' : 'chq-comms-phone-landing chq-comms-phone-landing-show'
        }
      >
        {/* Frame line 183: `font-size:27px; font-weight:700;
            letter-spacing:-0.04em; line-height:1">Comms</h1>`. A styled
            <p>, not a second <h1> -- .chq-comms-main's own h1.chq-page-title
            already owns the page's ONE "Comms" accessible heading name and
            stays in the DOM (display:none only, never unmounted) while this
            block is shown; a second <h1> with the identical accessible name
            would double the page's heading the instant CSS fails to load,
            and unconditionally under jsdom (which evaluates no @media
            rules) -- same reasoning this landing's original DEC-621 markup
            recorded here. */}
        <p className="chq-comms-phone-landing-title">Comms</p>
        {/* Frame line 184: `4 sent in 7 days · last Tue 4:12pm`. Built from
            the SAME rhythm figures the desktop subtitle uses (never
            re-derived) -- see formatPhoneSendRhythm. */}
        {rhythm && <p className="chq-comms-phone-landing-subtitle">{formatPhoneSendRhythm(rhythm)}</p>}

        {/* Frame lines 188-193: "Draft in progress" card. v12 mobile
            campaign w5 (DEC-621 wave-87 amendment): draftRecord comes from
            composeDraft.ts's localStorage record, written by ComposeWizard
            on each step advance -- null (card absent) whenever this event
            has no in-progress draft, exactly the frame's own conditional
            composition. onReadDraft lands the visitor on the compose tab,
            where ComposeWizard picks its own step up from where it left
            off (it never re-derives step from the stored record -- see
            ComposeWizard's own doc comment). */}
        <PhoneDraftCard
          draft={draftRecord && { subject: draftRecord.subject, recipientCount: draftRecord.recipientCount }}
          onReadDraft={() => choosePhoneTab('compose')}
        />

        {/* Frame lines 196-205: read-only "Recent sends" -- the same
            all-time batch list the head's rhythm line and both tab-body
            RecentSends mounts already hold, never a second fetch.
            DEC-621 wave-109 amendment (task w5-q): with no stored draft
            the draft-card slot's only route is into Compose (see
            PhoneDraftCard's empty-state branch), so this band carries the
            landing's other two routes -- into Templates and into History
            -- the frame's own dashboard otherwise being a dead end for
            them (Tier 0 S2 break, docs/probes/metafid-phoneA-2026-08-19
            .md). Labels are taken verbatim from the tab strip's own
            vocabulary (the TABS array above), inventing no new copy. */}
        <div className="chq-comms-phone-recent-head">
          <span className="chq-section-label">Recent sends</span>
          <div className="chq-comms-phone-recent-head-actions">
            {TABS.filter((t) => t.id !== 'compose').map((t) => (
              <button
                key={t.id}
                type="button"
                className="chq-comms-phone-recent-head-link"
                onClick={() => choosePhoneTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {recentBatches.slice(0, COMPOSE_RECENT_SENDS_LIMIT).map((batch) => {
          const templateLabel =
            batch.templateId && templatesById[batch.templateId] ? templatesById[batch.templateId] : '—';
          return (
            <div key={batch.batchKey} className="chq-comms-phone-recent-row">
              {/* Frame line 201: `{{ h.when }} · {{ h.short }}` */}
              <span className="chq-comms-phone-recent-when">
                {formatDateTime(batch.sentAt)} · {sentCountLabel(batch.statusCounts)}
              </span>
              {/* Frame line 202: `font-family:'Familjen Grotesk', sans-serif;
                  font-size:15px; font-weight:600; letter-spacing:-0.015em;
                  line-height:1.35` */}
              <span className="chq-comms-phone-recent-subject">{batch.subject}</span>
              {/* Frame line 203: `{{ h.template }}` */}
              <span className="chq-comms-phone-recent-template">{templateLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
