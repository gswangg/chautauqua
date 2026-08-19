// w14-f (DEC-986): phone-only two-step CFP wizard inline vanilla JS.
// Additive only -- desktop's chq-cfp-step-* chrome stays display:none
// outside the 700px media query (cfp.css.ts), so this script is inert
// there too (it only ever flips an attribute + text/width the desktop
// stylesheet never reads). Mirrors agenda-itinerary-script.tsx's shape:
// one exported component returning a single <script
// dangerouslySetInnerHTML>, no fetch, no change to the POST target.
// DEC-986: a step transition un-requires every control it hides and
// restores it when the step is shown again (clause 1), and Next validates
// the outgoing step before it advances (clause 2), so a required control
// never ends up invalid inside a display:none section.
export function CfpStepsScript() {
  const js = `(function(){
  document.addEventListener('DOMContentLoaded', function(){
    var form = document.getElementById('chq-cfp-submit-form');
    if (!form) return;
    // DEC-986: a rejected submission re-renders the SAME form with its
    // errors inline -- if any survive server-side validation, every field
    // (both steps) must stay visible so the speaker can find and fix them,
    // so the wizard never engages (data-chq-cfp-step stays "all").
    var hasError = form.querySelector('.chq-field-error') || form.querySelector('[role="alert"]');
    if (hasError) return;
    var label = form.querySelector('.chq-cfp-steps-label');
    var fill = form.querySelector('.chq-cfp-steps-bar-fill');
    var talkSection = form.querySelector('.chq-cfp-step-talk');
    var youSection = form.querySelector('.chq-cfp-step-you');
    // DEC-986 clause (1): the required-toggle is part of HIDING, not a
    // separate concern. A step transition un-requires every control in the
    // section it is about to hide and restores the original required-ness
    // when that section is shown again. The original value is stashed on
    // the element itself (data-chq-cfp-required-orig), never in a JS-side
    // map, so it survives however many times a section toggles. Clause (2)
    // below already stops an INVALID control being hidden; this stops a
    // hidden control being constraint-validatable at all, which is what the
    // wave-93 ruling asked for and what keeps step 2's Submit -- which
    // clause (3) deliberately leaves fully validating -- from ever being
    // aborted on a control in the other, display:none step.
    function applyRequiredState(section, visible){
      if (!section) return;
      var controls = section.querySelectorAll('[required], [data-chq-cfp-required-orig]');
      for (var i = 0; i < controls.length; i++) {
        var el = controls[i];
        if (!el.hasAttribute('data-chq-cfp-required-orig')) {
          el.setAttribute('data-chq-cfp-required-orig', el.required ? '1' : '0');
        }
        el.required = visible && el.getAttribute('data-chq-cfp-required-orig') === '1';
      }
    }
    function setStep(step){
      form.setAttribute('data-chq-cfp-step', step);
      applyRequiredState(talkSection, step === '1');
      applyRequiredState(youSection, step === '2');
      if (label) {
        label.textContent = step === '2' ? 'Step 2 of 2 · about you' : 'Step 1 of 2 · your talk';
      }
      if (fill) {
        fill.style.width = step === '2' ? '100%' : '50%';
      }
      form.scrollIntoView();
    }
    // DEC-986 clause (2): "Next" is type="button", so the browser runs no
    // constraint validation of its own when it is pressed. Advancing
    // unchecked hides step 1 (cfp.css.ts's [data-chq-cfp-step="2"]
    // .chq-cfp-step-talk display:none rule) while its controls keep
    // their required flag, and the real Submit on step 2 aborts on a
    // non-focusable invalid control -- no message, no focus, no server hit.
    // So check the OUTGOING step's controls first and reportValidity() the
    // first invalid one: that focuses it and raises the browser's own
    // bubble on a field the speaker can still see, and refuses to advance.
    function firstInvalidIn(section){
      if (!section) return null;
      var controls = section.querySelectorAll('input, select, textarea');
      for (var i = 0; i < controls.length; i++) {
        var control = controls[i];
        if (control.disabled) continue;
        if (typeof control.checkValidity !== 'function') continue;
        if (!control.checkValidity()) return control;
      }
      return null;
    }
    var next = form.querySelector('.chq-cfp-step-next');
    var back = form.querySelector('.chq-cfp-step-back');
    if (next) {
      next.addEventListener('click', function(){
        var invalid = firstInvalidIn(talkSection);
        if (invalid) {
          if (typeof invalid.reportValidity === 'function') invalid.reportValidity();
          else if (typeof invalid.focus === 'function') invalid.focus();
          return;
        }
        setStep('2');
      });
    }
    if (back) { back.addEventListener('click', function(){ setStep('1'); }); }
    setStep('1');
  });
})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
