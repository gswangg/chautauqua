// Itinerary picker inline vanilla JS, shared by the agenda/schedule
// surfaces. Split out of the former monolithic src/routes/public/agenda.tsx
// (contention decomposition, wave 66) — no behavior change.

import { MAX_ITINERARY_IDS, applyItineraryToggle, itineraryStorageKey, mergeItinerarySelection, mirrorItineraryCheckboxes } from "../../lib/itinerary";
import { computeSavedOverlaps, joinOverlapTitles } from "../../lib/overlap-lanes";
import { assertValidMinute, clockHMM } from "../../domain/clock";
import { DEC_555 } from "../../decisions";
void DEC_555;

/** Itinerary picker inline vanilla JS (DEC-022): reads/writes
 * localStorage chq_itinerary_<slug>, keeps the .ics download link's ?ids=
 * query in sync with the checked set. */
export function ItineraryScript(props: { eventSlug: string }) {
  const storageKey = itineraryStorageKey(props.eventSlug);
  // EMB-10/11: mergeItinerarySelection's own body references MAX_ITINERARY_IDS
  // as a free identifier -- .toString() embeds only the function's SOURCE,
  // never its closed-over module-level const, so the const must be emitted into
  // the IIFE below too. Without it every change handler throws before
  // localStorage.setItem ever runs and no pick persists.
  // NB: keep this explanation OUT of the emitted `js` string. The hostile-input
  // surface test (test/public-surface-hostile-input.test.ts) asserts no public
  // response body ever names a raw exception type, so a comment naming one
  // would fail it once shipped inside the inline script.
  const js = `(function(){
  var MAX_ITINERARY_IDS = ${MAX_ITINERARY_IDS};
  // DEC-555 wave-29 amendment: mergeItinerarySelection and
  // mirrorItineraryCheckboxes are embedded under their OWN names (not a
  // __chq-prefixed alias) because applyItineraryToggle's own SOURCE TEXT
  // below calls them by these exact free identifiers -- .toString() carries
  // only source text, never a rename.
  var mergeItinerarySelection = (${mergeItinerarySelection.toString()});
  var mirrorItineraryCheckboxes = (${mirrorItineraryCheckboxes.toString()});
  // DEC-555 wave-29 amendment: the ONE serialized write path (root cause
  // fix, see itinerary-script-persistence.test.ts) -- every mutation goes
  // through this single function, called with one storage snapshot and one
  // DOM snapshot, and every subsequent redraw is driven from its RETURNED
  // ids/boxes, never a second DOM read.
  var applyItineraryToggle = (${applyItineraryToggle.toString()});
  var __chqOverlaps = (${computeSavedOverlaps.toString()});
  var __chqJoinOverlapTitles = (${joinOverlapTitles.toString()});
  // assertValidMinute is embedded under its OWN name for the same reason as
  // mergeItinerarySelection/mirrorItineraryCheckboxes above: clockHMM's own
  // source text below calls it by this exact free identifier. Missing this
  // embed is the w29-c root cause -- any /schedule page with two saved,
  // time-overlapping sessions threw here on the very first render, before
  // the change listener that persists Remove clicks ever got registered.
  var assertValidMinute = (${assertValidMinute.toString()});
  // DEC-555 (wave 148 amendment): the overlaps panel's sentence range prints
  // through the SAME clock formatter (src/domain/clock.ts's clockHMM, the
  // DEC-900 ONE owner of clock formatting) every other public surface uses --
  // embedded via .toString() exactly like the helpers above, never a second
  // hand-rolled formatter (DEC-522's day-label hazard).
  var __chqClock = (${clockHMM.toString()});
  var key = ${JSON.stringify(storageKey)};
  var slug = ${JSON.stringify(props.eventSlug)};
  var stored = [];
  try { stored = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { stored = []; }
  var boxes = document.querySelectorAll('.chq-itinerary-toggle');
  // DEC-584: the desktop grid and the phone list both render a
  // '.chq-itinerary-toggle' for every session (one is display:none at a
  // time, but both stay in the DOM), so the SAME submission id appears
  // twice in the raw NodeList -- dedupe before this list reaches
  // mergeItinerarySelection, or the itinerary is not the set of unique
  // rendered ids.
  var allRenderedIds = [];
  Array.prototype.forEach.call(boxes, function(b){
    if (allRenderedIds.indexOf(b.value) === -1) { allRenderedIds.push(b.value); }
  });
  function boxStates(){
    return Array.prototype.map.call(boxes, function(b){ return { value: b.value, checked: b.checked }; });
  }
  function currentIds(){
    return Array.prototype.filter.call(boxes, function(b){ return b.checked; }).map(function(b){ return b.value; });
  }
  function updateLink(ids){
    var count = document.getElementById('chq-ics-count');
    if (count) { count.textContent = String(ids.length); }
    // DEC-919: the day strip's terminal "My schedule · N" pill
    // (agenda-controls.tsx DaySwitcher) mirrors this same ids[] into its
    // own count id -- never a second count derivation, same idiom as
    // #chq-ics-count above.
    var pillCount = document.getElementById('chq-my-schedule-pill-count');
    if (pillCount) { pillCount.textContent = String(ids.length); }
    // DEC-576 (wave 110 amendment): the SSR phone dock mounts a SECOND
    // .ics anchor (id chq-ics-link-dock, agenda.tsx's AgendaContent/
    // ScheduleContent) beside the rail's own #chq-ics-link -- exactly one
    // of the two is in the a11y tree at a time per page (agenda.css.ts's
    // >700px/<=700px swap), same idiom as this file's own
    // .chq-itinerary-toggle desktop/phone duplicate above. Both ids are
    // driven from the same ids[] here so neither can go stale.
    var links = [document.getElementById('chq-ics-link'), document.getElementById('chq-ics-link-dock')];
    Array.prototype.forEach.call(links, function(link){
      if (!link) return;
      if (ids.length === 0) { link.setAttribute('aria-disabled', 'true'); link.removeAttribute('href'); return; }
      link.removeAttribute('aria-disabled');
      link.href = '/e/' + slug + '/schedule.ics?ids=' + encodeURIComponent(ids.join(','));
    });
  }
  // DEC-555 amendment (wave 1, task w1-d): /schedule's main column lists
  // ONLY the saved rows (no server round-trip, no second store -- DEC-555's
  // merge rule still stands). No-ops harmlessly on /agenda, which never
  // renders any '.chq-pub-schedule-row' element. Each row carries
  // data-day/-start-min/-end-min so __chqOverlaps can name every clash
  // purely from the DOM's own attributes.
  var scheduleRows = Array.prototype.slice.call(document.querySelectorAll('.chq-pub-schedule-row'));
  var dayGroups = Array.prototype.slice.call(document.querySelectorAll('.chq-pub-schedule-day-group'));
  var subtitleEl = document.getElementById('chq-schedule-subtitle');
  var scheduleEmptyEl = document.getElementById('chq-schedule-empty');
  var overlapsSectionEl = document.getElementById('chq-schedule-overlaps-section');
  var overlapsHeadingEl = document.getElementById('chq-schedule-overlaps-heading');
  var overlapsBodyEl = document.getElementById('chq-schedule-overlaps-body');
  // DEC-555 wave-29 amendment: takes ids as a parameter -- the caller's
  // single write-path snapshot -- rather than re-deriving it via
  // currentIds(). A second internal DOM read here is exactly the shape that
  // let a cap-trimmed row keep showing checked/saved after
  // applyItineraryToggle had already dropped it from storage.
  function applyScheduleView(ids){
    if (scheduleRows.length === 0) return;
    var idSet = {};
    for (var i = 0; i < ids.length; i += 1) { idSet[ids[i]] = true; }
    var saved = [];
    Array.prototype.forEach.call(scheduleRows, function(row){
      var id = row.getAttribute('data-submission-id');
      var isSaved = !!idSet[id];
      row.style.display = isSaved ? '' : 'none';
      var clashEl = row.querySelector('.chq-pub-schedule-row-clash');
      if (clashEl) { clashEl.hidden = true; clashEl.textContent = ''; }
      if (isSaved) {
        var titleEl = row.querySelector('.chq-pub-schedule-row-title');
        // DEC-555: rawStartMin/rawEndMin capture whether the attribute is
        // genuinely present BEFORE parseInt's '0' fallback collapses a
        // missing attribute and a legitimate midnight (0) into the same
        // value -- the overlaps sentence below needs to tell "no range
        // clause" apart from "range starts at 0:00".
        var rawStartMin = row.getAttribute('data-start-min');
        var rawEndMin = row.getAttribute('data-end-min');
        saved.push({
          id: id,
          title: titleEl ? titleEl.textContent : '',
          day: row.getAttribute('data-day') || '',
          startMin: parseInt(rawStartMin || '0', 10),
          endMin: parseInt(rawEndMin || '0', 10),
          hasRange: rawStartMin !== null && rawStartMin !== '' && rawEndMin !== null && rawEndMin !== '',
        });
      }
    });
    var overlap = __chqOverlaps(saved);
    Array.prototype.forEach.call(scheduleRows, function(row){
      var id = row.getAttribute('data-submission-id');
      var clashTitles = overlap.clashesById[id];
      if (!clashTitles || clashTitles.length === 0) return;
      var clashEl = row.querySelector('.chq-pub-schedule-row-clash');
      if (!clashEl) return;
      clashEl.hidden = false;
      clashEl.textContent = clashTitles.length === 1 ? ('Overlaps ' + clashTitles[0]) : ('Overlaps ' + clashTitles.length + ' sessions');
    });
    Array.prototype.forEach.call(dayGroups, function(group){
      var rows = group.querySelectorAll('.chq-pub-schedule-row');
      var visibleCount = 0;
      Array.prototype.forEach.call(rows, function(r){ if (r.style.display !== 'none') { visibleCount += 1; } });
      group.style.display = visibleCount === 0 ? 'none' : '';
      var countEl = group.querySelector('.chq-pub-schedule-day-count');
      if (countEl) { countEl.textContent = visibleCount + (visibleCount === 1 ? ' session' : ' sessions'); }
    });
    if (subtitleEl) {
      var overlapWord = overlap.pairCount === 1 ? 'overlap' : 'overlaps';
      subtitleEl.textContent = saved.length + ' saved · ' + overlap.pairCount + ' ' + overlapWord + ' · no account needed';
    }
    if (scheduleEmptyEl) { scheduleEmptyEl.hidden = saved.length !== 0; }
    if (overlapsSectionEl) { overlapsSectionEl.hidden = overlap.pairCount === 0; }
    if (overlapsHeadingEl) {
      overlapsHeadingEl.textContent = overlap.pairCount === 1 ? '1 overlap' : (overlap.pairCount + ' overlaps');
    }
    if (overlapsBodyEl) {
      while (overlapsBodyEl.firstChild) { overlapsBodyEl.removeChild(overlapsBodyEl.firstChild); }
      // DEC-555 (wave 148 amendment): one sentence per COVERING session
      // (not one line per pair) -- every saved item with at least one clash
      // gets its own sentence naming its own clock range and every title it
      // covers. The heading above still counts PAIRS (overlap.pairCount);
      // this sentence count is allowed to differ and is never asserted
      // against it.
      for (var s = 0; s < saved.length; s += 1) {
        var item = saved[s];
        var titles = overlap.clashesById[item.id];
        if (!titles || titles.length === 0) continue;
        var joined = __chqJoinOverlapTitles(titles);
        var sentence = item.hasRange
          ? (item.title + ' runs ' + __chqClock(item.startMin) + '–' + __chqClock(item.endMin) + ', over ' + joined + '.')
          : (item.title + ' overlaps ' + joined + '.');
        var line = document.createElement('span');
        line.className = 'chq-pub-rail-caption';
        line.textContent = sentence;
        overlapsBodyEl.appendChild(line);
      }
    }
  }
  Array.prototype.forEach.call(boxes, function(b){ b.checked = stored.indexOf(b.value) !== -1; });
  updateLink(stored);
  applyScheduleView(stored);
  document.addEventListener('change', function(e){
    if (!e.target || !e.target.classList || !e.target.classList.contains('chq-itinerary-toggle')) return;
    // DEC-555 wave-29 amendment (THE FIX): ONE storage snapshot
    // (latestStored), ONE DOM snapshot (boxStates()), fed through the ONE
    // serialized write function -- applyItineraryToggle already mirrors the
    // changed value across every box sharing it (DEC-584: the desktop/phone
    // duplicate trap), computes the merged+capped id list, and resolves
    // every box's checked state to agree with what actually got persisted.
    // Every redraw below is driven from its RETURNED values -- never a
    // second DOM read.
    var latestStored = [];
    try { latestStored = JSON.parse(localStorage.getItem(key) || '[]'); } catch (err) { latestStored = []; }
    var result = applyItineraryToggle(latestStored, allRenderedIds, boxStates(), e.target.value, e.target.checked);
    Array.prototype.forEach.call(boxes, function(b, i){ b.checked = result.boxes[i].checked; });
    localStorage.setItem(key, JSON.stringify(result.ids));
    updateLink(result.ids);
    applyScheduleView(result.ids);
  });
})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
