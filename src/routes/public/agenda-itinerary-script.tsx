// Itinerary picker inline vanilla JS, shared by the agenda/schedule
// surfaces. Split out of the former monolithic src/routes/public/agenda.tsx
// (contention decomposition, wave 66) — no behavior change.

import { MAX_ITINERARY_IDS, itineraryStorageKey, mergeItinerarySelection, mirrorItineraryCheckboxes } from "../../lib/itinerary";
import { computeSavedOverlaps } from "../../lib/overlap-lanes";

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
  var __chqMerge = (${mergeItinerarySelection.toString()});
  var __chqMirror = (${mirrorItineraryCheckboxes.toString()});
  var __chqOverlaps = (${computeSavedOverlaps.toString()});
  var key = ${JSON.stringify(storageKey)};
  var slug = ${JSON.stringify(props.eventSlug)};
  var stored = [];
  try { stored = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { stored = []; }
  var boxes = document.querySelectorAll('.chq-itinerary-toggle');
  // DEC-584: the desktop grid and the phone list both render a
  // '.chq-itinerary-toggle' for every session (one is display:none at a
  // time, but both stay in the DOM), so the SAME submission id appears
  // twice in the raw NodeList -- dedupe before this list reaches
  // __chqMerge, or the itinerary is not the set of unique rendered ids.
  var allRenderedIds = [];
  Array.prototype.forEach.call(boxes, function(b){
    if (allRenderedIds.indexOf(b.value) === -1) { allRenderedIds.push(b.value); }
  });
  function currentIds(){
    return Array.prototype.filter.call(boxes, function(b){ return b.checked; }).map(function(b){ return b.value; });
  }
  function updateLink(ids){
    var link = document.getElementById('chq-ics-link');
    var count = document.getElementById('chq-ics-count');
    if (count) { count.textContent = String(ids.length); }
    if (!link) return;
    if (ids.length === 0) { link.setAttribute('aria-disabled', 'true'); link.removeAttribute('href'); return; }
    link.removeAttribute('aria-disabled');
    link.href = '/e/' + slug + '/schedule.ics?ids=' + encodeURIComponent(ids.join(','));
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
  function applyScheduleView(){
    if (scheduleRows.length === 0) return;
    var ids = currentIds();
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
        saved.push({
          id: id,
          title: titleEl ? titleEl.textContent : '',
          day: row.getAttribute('data-day') || '',
          startMin: parseInt(row.getAttribute('data-start-min') || '0', 10),
          endMin: parseInt(row.getAttribute('data-end-min') || '0', 10),
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
      subtitleEl.textContent = saved.length + ' saved · ' + overlap.pairCount + ' ' + overlapWord;
    }
    if (scheduleEmptyEl) { scheduleEmptyEl.hidden = saved.length !== 0; }
    if (overlapsSectionEl) { overlapsSectionEl.hidden = overlap.pairCount === 0; }
    if (overlapsHeadingEl) {
      overlapsHeadingEl.textContent = overlap.pairCount === 1 ? '1 overlap' : (overlap.pairCount + ' overlaps');
    }
    if (overlapsBodyEl) {
      while (overlapsBodyEl.firstChild) { overlapsBodyEl.removeChild(overlapsBodyEl.firstChild); }
      var seenPairs = {};
      for (var s = 0; s < saved.length; s += 1) {
        var item = saved[s];
        var titles = overlap.clashesById[item.id];
        if (!titles) continue;
        for (var t = 0; t < titles.length; t += 1) {
          var otherTitle = titles[t];
          var pairKey = [item.title, otherTitle].sort().join('|') + '|' + item.day;
          if (seenPairs[pairKey]) continue;
          seenPairs[pairKey] = true;
          var line = document.createElement('span');
          line.className = 'chq-pub-rail-caption';
          line.textContent = item.title + ' overlaps ' + otherTitle + '.';
          overlapsBodyEl.appendChild(line);
        }
      }
    }
  }
  Array.prototype.forEach.call(boxes, function(b){ b.checked = stored.indexOf(b.value) !== -1; });
  updateLink(stored);
  applyScheduleView();
  document.addEventListener('change', function(e){
    if (!e.target || !e.target.classList || !e.target.classList.contains('chq-itinerary-toggle')) return;
    // THE TRAP (DEC-584): currentIds() below is "every checked box" across
    // BOTH copies. Without mirroring first, unchecking only the visible
    // copy leaves the hidden copy's box still checked, so the id never
    // leaves currentIds() and the uncheck never persists. Mirror every box
    // sharing the changed input's value to its new checked state first.
    var states = Array.prototype.map.call(boxes, function(b){ return { value: b.value, checked: b.checked }; });
    var mirrored = __chqMirror(states, e.target.value, e.target.checked);
    Array.prototype.forEach.call(boxes, function(b, i){ b.checked = mirrored[i].checked; });
    var latestStored = [];
    try { latestStored = JSON.parse(localStorage.getItem(key) || '[]'); } catch (err) { latestStored = []; }
    var ids = __chqMerge(latestStored, allRenderedIds, currentIds());
    localStorage.setItem(key, JSON.stringify(ids));
    updateLink(ids);
    applyScheduleView();
  });
})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
