/** Included in the early synchronous submit handler, before the deferred landing runtime. */
export const ENTRY_FORM_BUSY_SCRIPT = `
function setEntryFormBusy(action,busy) {
  var form=action && action.closest && action.closest('form');
  if(!form)return false;
  var status=form.querySelector('[data-template7-creating]');
  if(busy&&!status){
    status=document.createElement('div');
    status.setAttribute('data-template7-creating','');
    status.setAttribute('role','status');
    status.style.cssText='text-align:center;padding:12px 0';
    status.innerHTML='Creando tu cuenta…<div class="entry-progress" data-start="initial" data-phase="creating" role="progressbar" aria-label="Creando tu cuenta" style="margin:10px auto 0;--entry-primary:var(--t9-primary,currentColor);--entry-accent:var(--t9-secondary,currentColor);--entry-track:rgba(128,128,128,.25)"><span class="entry-progress-track"><span class="entry-progress-fill"></span></span></div>';
    action.after(status);
  }
  if(!status)return false;
  status.hidden=!busy;
  action.hidden=busy;
  // Some custom CTA styles set display explicitly, overriding the native hidden rule.
  if(busy)action.style.display='none';else action.style.removeProperty('display');
  form.querySelectorAll('input[type=text],input[type=tel]').forEach(function(field){field.readOnly=busy});
  return true;
}
`;
