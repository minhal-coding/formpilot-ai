import { loadProfile, saveProfile, sampleProfile, blankProfile } from './profile';
import { scanCurrentTab, fillSelected, type Session } from './browser';
import { suggest } from './matching';
import { aiEligible, askLocalModel } from './local-ai';
import { element as el, button, inputField } from './ui';
import type { Fact, Suggestion, Result } from './types';

const app = document.querySelector<HTMLElement>('#app')!;
const notice = document.querySelector<HTMLElement>('#notice')!;
let facts: Fact[] = await loadProfile();
let session: Session | undefined;
let suggestions: Suggestion[] = [];
let results: Result[] | undefined;
let step = 'profile';
let busy = false;
let aiToken = '';
const aiFacts = new Set<string>();
const announce = (message: string) => { notice.textContent = message; };
async function run(action: () => Promise<void>) {
  if (busy) return;
  busy = true; app.setAttribute('aria-busy', 'true'); document.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.disabled = true);
  try { await action(); } catch (error) { announce(`${error instanceof Error ? error.message : 'Action failed.'} Your profile is still available.`); }
  finally { busy = false; app.removeAttribute('aria-busy'); render(); }
}
function invalidate() { session = undefined; suggestions = []; results = undefined; }
async function scan() {
  await run(async () => {
    invalidate(); session = await scanCurrentTab(); suggestions = session.scan.fields.map(field => suggest(field, facts)); step = 'suggestions';
    announce(`Found ${suggestions.length} fields. ${suggestions.filter(s => s.status === 'ready').length} sourced suggestions. Nothing has been filled.`);
  });
}
function showProfile() {
  app.append(el('h1', 'Your profile'), el('p', 'Saved only in this browser.', 'subtle'));
  const actions = el('div', '', 'actions');
  actions.append(button('Use fictional sample', async () => run(async () => { facts = sampleProfile(); await saveProfile(facts); invalidate(); announce('Fictional sample saved. All people, schools, and work details are made up.'); }), 'outline'),
    button('Delete data', async () => run(async () => { await chrome.storage.local.clear(); await chrome.storage.session.clear(); facts = blankProfile(); aiToken = ''; aiFacts.clear(); invalidate(); announce('Stored profile deleted and this panel cleared. Values already filled on websites are not removed.'); }), 'danger'));
  app.append(actions);
  for (const fact of facts) {
    const wrapper = el('div', '', fact.id.startsWith('custom-') ? 'custom' : '');
    if (fact.id.startsWith('custom-')) wrapper.append(inputField('Custom fact label', fact.label, value => { fact.label = value; invalidate(); }));
    wrapper.append(inputField(fact.id.startsWith('custom-') ? 'Approved answer' : fact.label, fact.value, value => { fact.value = value; invalidate(); }, ['education', 'work'].includes(fact.id)));
    if (fact.id.startsWith('custom-')) wrapper.append(button('Remove fact', () => { facts = facts.filter(f => f !== fact); invalidate(); render(); }));
    app.append(wrapper);
  }
  if (facts.length < 13) app.append(button('Add custom fact', () => { facts.push({ id: `custom-${crypto.randomUUID()}`, label: '', value: '' }); invalidate(); render(); }, 'wide'));
  app.append(el('p', 'Only add facts you approve for forms. Keep sensitive information out of this profile.', 'source'));
  app.append(button('Save profile', async () => run(async () => { await saveProfile(facts); invalidate(); announce('Profile saved locally. It is not encrypted by FormPilot.'); }), 'primary wide'));
  app.append(button('Scan current tab', scan, 'outline wide'));
  const details = el('details'); details.append(el('summary', 'Optional local model'));
  details.append(el('p', 'Exact matching works without AI. To use a local model, run the paired loopback bridge described in the README. Its pairing token stays in this panel’s memory.', 'source'));
  const tokenField = inputField('Bridge pairing token', aiToken, value => { aiToken = value; }); tokenField.querySelector('input')!.type = 'password'; details.append(tokenField);
  details.append(el('p', 'Choose which facts may be sent to your local model. Only these facts and neutral unresolved field metadata are sent.', 'source'));
  for (const fact of facts.filter(f => f.value.trim())) {
    const label = el('label', '', 'check'); const check = el('input'); check.type = 'checkbox'; check.checked = aiFacts.has(fact.id);
    check.addEventListener('change', () => { if (check.checked) aiFacts.add(fact.id); else aiFacts.delete(fact.id); }); label.append(check, document.createTextNode(fact.label)); details.append(label);
  }
  details.append(button('Allow local bridge', async () => {
    const granted = await chrome.permissions.request({ origins: ['http://127.0.0.1/*'] }); announce(granted ? 'Loopback access allowed. Scan, then choose Try local model. No model request sent yet.' : 'Permission declined. Exact matching remains available.');
  }, 'wide'));
  app.append(details);
}
function showSuggestions(review: boolean) {
  app.append(el('h1', review ? 'You’re in control' : 'Answers with a source'), el('p', review ? 'Review and edit answers before filling.' : 'Review every answer before filling.', 'subtle'));
  if (!session) { const empty = el('div', '', 'empty'); empty.append(el('p', 'Start with your profile, then scan the form beside this panel.'), button('Scan current tab', scan, 'primary wide')); app.append(empty); return; }
  app.append(el('p', session.scan.url, 'url'));
  if (review) app.append(el('p', 'Some websites autosave when a field changes. Fill selected sends input/change events. FormPilot never clicks submit.', 'warning'));
  if (results) {
    const count = results.filter(r => r.status === 'filled').length;
    app.append(el('p', `${count} fields filled · ${results.length - count} skipped. No submit action was taken by FormPilot.`, 'success'));
  }
  for (const suggestion of suggestions) {
    const row = el('section', '', 'field-row'); const { field } = suggestion;
    if (review && suggestion.status === 'ready' && !results) {
      const line = el('div', '', 'check'); const check = el('input'); check.type = 'checkbox'; check.checked = suggestion.selected; check.setAttribute('aria-label', `Fill ${field.label}`);
      check.addEventListener('change', () => { suggestion.selected = check.checked; updateFillButton(); });
      const group = el('div'); group.style.flex = '1'; group.style.minWidth = '0';
      const input = inputField(field.label || 'Unnamed field', suggestion.value, value => { suggestion.value = value; suggestion.method = 'Edited by you'; source.textContent = 'Edited by you · This answer is no longer presented as a profile fact.'; updateFillButton(); }, field.type === 'textarea');
      input.classList.add('review-answer'); const source = el('p', sourceText(suggestion), 'source'); group.append(input, source); line.append(check, group); row.append(line);
    } else {
      row.append(el('h2', field.label || 'Unnamed field'));
      if (suggestion.value) row.append(el('p', suggestion.value));
      row.append(el('span', suggestion.method === 'Edited by you' ? 'Edited by you' : { ready: 'From profile', missing: 'No clear match', manual: 'Manual only', existing: 'Already answered' }[suggestion.status], `status ${suggestion.status}`));
      row.append(el('p', suggestion.status === 'ready' ? sourceText(suggestion) : suggestion.reason, 'source'));
    }
    const result = results?.find(r => r.id === field.id);
    if (result) row.append(el('p', `${result.status === 'filled' ? 'Filled' : 'Skipped'} — ${result.reason}`, 'source'));
    else if (results && suggestion.status === 'ready') row.append(el('p', 'Not selected — left unchanged.', 'source'));
    app.append(row);
  }
  if (!suggestions.length) app.append(el('p', 'No supported visible form controls found.'));
  if (!review) {
    app.append(button('Review answers', () => { step = 'review'; render(); }, 'primary wide'));
    if (suggestions.some(s => s.status === 'missing' && aiEligible(s.field))) app.append(button('Try local model', async () => run(async () => {
      if (!aiToken.trim() || !aiFacts.size) throw new Error('Choose facts and enter the bridge token under Profile → Optional local model.');
      if (!(await chrome.permissions.contains({ origins: ['http://127.0.0.1/*'] }))) throw new Error('Allow the local bridge under Profile first.');
      const fields = suggestions.filter(s => s.status === 'missing').map(s => s.field);
      try {
        const matches = await askLocalModel(fields, facts.filter(f => aiFacts.has(f.id)), aiToken);
        suggestions = suggestions.map(s => matches.find(m => m.field.id === s.field.id) ?? s); announce(`${matches.length} local model suggestions validated. They are unchecked until you select them.`);
      } catch { announce('Local model unavailable or output rejected. Exact matches remain usable. Check the bridge and model, then retry.'); }
    }), 'outline wide'));
  } else if (!results) {
    const fill = button('Fill selected', async () => run(async () => { if (!session) return; results = await fillSelected(session, suggestions); announce('Write complete. Review filled and skipped fields below.'); }), 'primary wide'); fill.id = 'fill'; app.append(fill); updateFillButton();
  }
  app.append(button('Scan again', scan, 'wide'));
  const limitations = el('details'); limitations.append(el('summary', 'Scan coverage')); session.scan.warnings.forEach(w => limitations.append(el('p', w, 'source'))); app.append(limitations);
}
function sourceText(s: Suggestion) { return s.method === 'Edited by you' ? 'Edited by you · Not a profile fact' : `Profile → ${s.fact?.label} · ${s.method}`; }
function updateFillButton() { const fill = document.querySelector<HTMLButtonElement>('#fill'); if (fill) { const count = suggestions.filter(s => s.status === 'ready' && s.selected && s.value.trim()).length; fill.textContent = `Fill selected (${count})`; fill.disabled = count === 0 || busy; } }
function render() {
  const focusWasInApp = app.contains(document.activeElement);
  app.replaceChildren(); document.querySelectorAll<HTMLButtonElement>('nav button').forEach(b => { b.disabled = false; if (b.dataset.step === step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
  if (step === 'profile') showProfile(); else showSuggestions(step === 'review');
  if (focusWasInApp) { const heading = app.querySelector('h1'); if (heading) { heading.tabIndex = -1; heading.focus(); } }
}
document.querySelectorAll<HTMLButtonElement>('nav button').forEach(b => b.addEventListener('click', () => { if (busy) return; step = b.dataset.step!; render(); }));
render();
