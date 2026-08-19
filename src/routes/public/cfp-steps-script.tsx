// w14-f (DEC-986): phone-only two-step CFP wizard inline vanilla JS.
// Additive only -- desktop's chq-cfp-step-* chrome stays display:none
// outside the 700px media query (cfp.css.ts), so this script is inert
// there too (it only ever flips an attribute + text/width the desktop
// stylesheet never reads). Mirrors agenda-itinerary-script.tsx's shape:
// one exported component returning a single <script
// dangerouslySetInnerHTML>, no fetch, no change to the POST target.
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
    // DEC-986 clause 1: a step transition un-requires every control it is
    // about to hide and restores the original required-ness when that step
    // is shown again. The original value is stashed on a data attribute on
    // the element itself (never a JS-side map), so it survives regardless
    // of how many times a control's section toggles visible/hidden.
    function applyRequiredState(section, visible){
      if (!section) return;
      var controls = section.querySelectorAll('[required], [data-chq-cfp-required-orig]');
      controls.forEach(function(el){
        if (!el.hasAttribute('data-chq-cfp-required-orig')) {
          el.setAttribute('data-chq-cfp-required-orig', el.required ? '1' : '0');
        }
        var orig = el.getAttribute('data-chq-cfp-required-orig') === '1';
        el.required = visible && orig;
      });
    }
    // DEC-986 clause 2: checkValidity() over the OUTGOING step's controls,
    // reportValidity() on the first invalid one, refuse to advance on
    // failure -- turns a silent dead end into the browser's ordinary
    // validation stop instead of a submit-time abort on a hidden control.
    function validateSection(section){
      if (!section) return true;
      var controls = section.querySelectorAll('[required], [data-chq-cfp-required-orig]');
      for (var i = 0; i < controls.length; i++) {
        var el = controls[i];
        if (typeof el.checkValidity === 'function' && !el.checkValidity()) {
          if (typeof el.reportValidity === 'function') { el.reportValidity(); }
          return false;
        }
      }
      return true;
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
    var next = form.querySelector('.chq-cfp-step-next');
    var back = form.querySelector('.chq-cfp-step-back');
    // DEC-986 clause 3: this handler is the only guard -- the real submit
    // button stays fully validating, unlike Save draft's escape hatch.
    if (next) { next.addEventListener('click', function(){
      if (!validateSection(talkSection)) { return; }
      setStep('2');
    }); }
    if (back) { back.addEventListener('click', function(){ setStep('1'); }); }
    setStep('1');
  });
})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
