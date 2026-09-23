import { loadProfile, saveProfile, sampleProfile, blankProfile } from './profile';
import { scanCurrentTab, fillSelected, type Session } from './browser';
import { suggest } from './matching';
import { aiEligible, askLocalModel } from './local-ai';
import { element as el, button, inputField } from './ui';
import { suggestionRow } from './suggestion-view';
import type { Fact, Suggestion, Result } from './types';

const app = document.querySelector<HTMLElement>('#app')!;
const notice = document.querySelector<HTMLElement>('#notice')!;
let facts: Fact[] = blankProfile();
let session: Session | undefined;
let suggestions: Suggestion[] = [];
let results: Result[] | undefined;
let step = 'profile';
let busy = false;
let dirty = false;
let aiToken = '';
let modelOpen = false;
let feedbackScope = 'profile';
let feedbackTone = 'info';
const aiFacts = new Set<string>();
const profileErrors = new Map<string, string>();

function announce(message: string, tone = 'info') {
  feedbackTone = tone;
  notice.textContent = message;
  notice.className = `notice ${tone}`;
  notice.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  notice.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite');
}
function placeNotice(container: HTMLElement, scope: string) {
  if (feedbackScope === scope) container.append(notice);
}
function focusHeading() { const heading = app.querySelector('h1'); if (heading) { heading.tabIndex = -1; heading.focus(); } }
function navigate(next: string) { step = next; announce(''); feedbackScope = next === 'profile' ? 'profile' : 'scan'; render(); focusHeading(); }
function invalidate() { session = undefined; suggestions = []; results = undefined; }
function edited() {
  dirty = true; invalidate();
  const status = document.querySelector('#save-state'); if (status) status.textContent = 'Unsaved changes';
}

async function run(action: () => Promise<void>, label: string, scope = 'scan') {
  if (busy) return;
  busy = true; feedbackScope = scope; announce(label, 'loading');
  const previousFocus = document.activeElement;
  const trigger = previousFocus instanceof HTMLButtonElement ? previousFocus.textContent : null;
  const slot = document.querySelector<HTMLElement>(`[data-feedback="${scope}"]`);
  if (slot) slot.append(notice);
  app.setAttribute('aria-busy', 'true');
  document.querySelectorAll<HTMLInputElement | HTMLButtonElement>('button,input,textarea').forEach(c => c.disabled = true);
  try { await action(); }
  catch (error) { announce(`${error instanceof Error ? error.message : 'Action failed.'} Your profile is still available.`, 'error'); }
  finally {
    busy = false; app.removeAttribute('aria-busy'); render();
    if (feedbackTone === 'error') { notice.tabIndex = -1; notice.focus(); }
    else if (trigger) {
      const replacement = Array.from(app.querySelectorAll('button')).find(b => b.textContent === trigger);
      if (replacement) replacement.focus(); else focusHeading();
    }
  }
}
async function scan() {
  await run(async () => {
    invalidate(); session = await scanCurrentTab();
    suggestions = session.scan.fields.map(field => suggest(field, facts)); step = 'suggestions'; feedbackScope = 'scan';
    announce(`Found ${suggestions.length} fields. ${suggestions.filter(s => s.status === 'ready').length} sourced suggestions. Nothing has been filled.`, 'success');
  }, 'Scanning the current page…', step === 'profile' ? 'profile' : 'scan');
  if (session) { feedbackScope = 'scan'; render(); focusHeading(); }
}
function confirmAction(title: string, description: string, confirmText: string, action: () => Promise<void>) {
  const previous = document.activeElement as HTMLElement | null;
  const dialog = el('dialog'); dialog.setAttribute('aria-labelledby', 'confirm-title');
  const heading = el('h2', title); heading.id = 'confirm-title';
  const actions = el('div', '', 'actions');
  const cancel = button('Cancel', () => dialog.close()); cancel.autofocus = true;
  actions.append(cancel, button(confirmText, async () => { dialog.close(); await action(); }, 'danger'));
  dialog.append(heading, el('p', description), actions);
  dialog.addEventListener('close', () => { dialog.remove(); previous?.focus(); });
  document.body.append(dialog); dialog.showModal();
}
function actionPanel(title: string, scope: string) {
  const panel = el('aside', '', 'action-panel'); panel.setAttribute('aria-label', title);
  panel.append(el('h2', title));
  const feedback = el('div'); feedback.dataset.feedback = scope;
  placeNotice(feedback, scope); panel.append(feedback);
  return panel;
}
function heading(title: string, subtitle: string, number: number) {
  const intro = el('div', '', 'intro');
  intro.append(el('p', `Step ${number} of 3`, 'step-label'), el('h1', title), el('p', subtitle, 'subtle'));
  app.append(intro);
}
function profileField(fact: Fact) {
  const wrapper = el('div', '', fact.id.startsWith('custom-') ? 'custom' : '');
  if (fact.id.startsWith('custom-')) wrapper.append(inputField('Custom fact label', fact.label, value => { fact.label = value; edited(); }));
  const input = inputField(fact.id.startsWith('custom-') ? 'Approved answer' : fact.label, fact.value, value => { fact.value = value; edited(); }, ['education', 'work'].includes(fact.id));
  const control = input.querySelector('input,textarea')!;
  if (control instanceof HTMLInputElement) control.type = fact.id === 'email' ? 'email' : fact.id === 'phone' ? 'tel' : 'text';
  if (profileErrors.has(fact.id)) {
    const error = el('p', profileErrors.get(fact.id)!, 'field-error'); error.id = `profile-error-${fact.id}`;
    control.setAttribute('aria-invalid', 'true'); control.setAttribute('aria-describedby', error.id); input.append(error);
  }
  wrapper.append(input);
  if (fact.id.startsWith('custom-')) wrapper.append(button('Remove fact', () => { facts = facts.filter(f => f !== fact); edited(); render(); focusHeading(); }, 'text-button'));
  return wrapper;
}
async function save() {
  profileErrors.clear();
  for (const fact of facts) {
    if (fact.id === 'email' && app.querySelector<HTMLInputElement>('input[type=email]')?.validity.typeMismatch) profileErrors.set(fact.id, 'Enter an email address such as alex@example.com, or leave it blank.');
    if (fact.id.startsWith('custom-') && (!fact.label.trim() || !fact.value.trim())) profileErrors.set(fact.id, 'Add a label and an approved answer, or remove this fact.');
  }
  if (profileErrors.size) { feedbackScope = 'profile'; announce('Check the highlighted profile fields before saving.', 'error'); render(); app.querySelector<HTMLElement>('[aria-invalid=true]')?.focus(); return; }
  await run(async () => { await saveProfile(facts); dirty = false; invalidate(); announce('Profile saved locally. It is not encrypted by FormPilot.', 'success'); }, 'Saving your profile…', 'profile');
}
function showProfile() {
  heading('Your profile', 'Save your approved facts once. Decide where they go, every time.', 1);
  const workspace = el('div', '', 'workspace');
  const actions = actionPanel('Ready for a form?', 'profile');
  const saveState = el('p', dirty ? 'Unsaved changes' : 'Saved only in this browser.', 'subtle'); saveState.id = 'save-state'; actions.append(saveState);
  actions.append(button('Scan current tab', scan, 'primary wide'), button('Save profile', save, 'wide'));
  actions.append(el('p', 'Scan previews fields without writing. Save to keep your edits.', 'source'));
  const sample = async () => run(async () => { facts = sampleProfile(); await saveProfile(facts); dirty = false; profileErrors.clear(); invalidate(); announce('Fictional sample saved. All sample details are made up.', 'success'); }, 'Loading the fictional sample…', 'profile');
  actions.append(button('Use fictional sample', () => {
    if (facts.some(f => f.value)) confirmAction('Replace your profile?', 'The fictional sample will replace the profile saved in this browser.', 'Replace with sample', sample);
    else return sample();
  }, 'text-button wide'));
  const content = el('div', '', 'content-column');
  for (const [title, ids] of [['Contact details', ['name', 'email', 'phone', 'city', 'state']], ['Education & experience', ['school', 'education', 'work']]] as const) {
    const section = el('section', '', 'profile-section'); section.append(el('h2', title));
    const fields = el('div', '', 'profile-fields'); facts.filter(f => (ids as readonly string[]).includes(f.id)).forEach(f => fields.append(profileField(f))); section.append(fields); content.append(section);
  }
  const custom = el('section', '', 'profile-section'); custom.append(el('h2', 'Custom facts'), el('p', 'Add an exact field label and the answer you approve. Sensitive questions remain manual-only.', 'source'));
  facts.filter(f => f.id.startsWith('custom-')).forEach(f => custom.append(profileField(f)));
  if (facts.length < 13) custom.append(button('Add custom fact', () => { facts.push({ id: `custom-${crypto.randomUUID()}`, label: '', value: '' }); edited(); render(); app.querySelector<HTMLElement>('.custom:last-of-type input')?.focus(); }));
  content.append(custom, modelSettings());
  const privacy = el('section', '', 'profile-section'); privacy.append(el('h2', 'Your data stays yours'), el('p', 'No account, analytics, or profile sync. Local storage is not encrypted by FormPilot. Deleting it will not remove answers already filled on websites.', 'source'));
  privacy.append(button('Delete data', () => confirmAction('Delete your saved profile?', 'This clears all saved facts and local model settings in this panel. Answers already filled on websites will stay there.', 'Delete saved profile', async () => run(async () => {
    await chrome.storage.local.clear(); await chrome.storage.session.clear(); facts = blankProfile(); aiToken = ''; aiFacts.clear(); dirty = false; profileErrors.clear(); invalidate(); announce('Stored profile deleted and this panel cleared. Values already filled on websites are not removed.', 'success');
  }, 'Deleting saved facts…', 'profile')), 'danger'));
  content.append(privacy); workspace.append(actions, content); app.append(workspace);
}
function modelSettings() {
  const details = el('details', '', 'settings'); details.open = modelOpen; details.append(el('summary', 'Optional local model'));
  details.addEventListener('toggle', () => { modelOpen = details.open; });
  details.append(el('p', 'Off unless you request it. Exact matching works without a model.', 'model-note'));
  details.append(el('p', 'Run the paired loopback bridge from the README. Select only the facts it may receive. Its token stays in this panel’s memory.', 'source'));
  const tokenField = inputField('Bridge pairing token', aiToken, value => { aiToken = value; }); tokenField.querySelector('input')!.type = 'password'; details.append(tokenField);
  const available = facts.filter(f => f.value.trim());
  if (!available.length) details.append(el('p', 'Add profile facts first to choose what the model may see.', 'source'));
  for (const fact of available) {
    const label = el('label', '', 'selection'); const check = el('input'); check.type = 'checkbox'; check.checked = aiFacts.has(fact.id);
    check.addEventListener('change', () => { if (check.checked) aiFacts.add(fact.id); else aiFacts.delete(fact.id); }); label.append(check, document.createTextNode(fact.label)); details.append(label);
  }
  const feedback = el('div'); feedback.dataset.feedback = 'model'; placeNotice(feedback, 'model'); details.append(feedback);
  details.append(button('Allow local bridge', async () => {
    // Request immediately within the click gesture, before any asynchronous work.
    const permission = chrome.permissions.request({ origins: ['http://127.0.0.1/*'] });
    await run(async () => { const granted = await permission; announce(granted ? 'Loopback access allowed. Scan, then choose Try local model. No model request sent yet.' : 'Permission declined. Exact matching remains available.', granted ? 'success' : 'info'); }, 'Waiting for local bridge permission…', 'model');
  }, 'wide'));
  return details;
}
async function tryModel() {
  await run(async () => {
    if (!aiToken.trim() || !aiFacts.size) throw new Error('Choose facts and enter the bridge token under Profile → Optional local model.');
    if (!(await chrome.permissions.contains({ origins: ['http://127.0.0.1/*'] }))) throw new Error('Allow the local bridge under Profile first.');
    try {
      const fields = suggestions.filter(s => s.status === 'missing').map(s => s.field);
      const matches = await askLocalModel(fields, facts.filter(f => aiFacts.has(f.id)), aiToken);
      suggestions = suggestions.map(s => matches.find(m => m.field.id === s.field.id) ?? s);
      announce(`${matches.length} local model suggestions validated. They are unchecked until you select them.`, 'success');
    } catch { announce('Local model unavailable or output rejected. Exact matches remain usable. Check the bridge and model, then retry.', 'error'); }
  }, 'Asking your local model… Exact matching remains available after this request.', 'scan');
}
function showSuggestions(review: boolean) {
  heading(results && review ? 'Your fill results' : review ? 'You’re in control' : 'Answers with a source', results && review ? 'See what was filled and why anything was skipped.' : review ? 'Choose exactly what gets written to the page.' : 'Every suggestion is tied to a fact you approved.', review ? 3 : 2);
  if (!session) {
    const empty = el('section', '', 'empty'); empty.append(el('h2', 'No page scanned yet'), el('p', 'Open a form, click the FormPilot toolbar icon, then scan it here. Your profile stays local until you approve a fill.'));
    const feedback = el('div'); feedback.dataset.feedback = 'scan'; placeNotice(feedback, 'scan'); empty.append(feedback, button('Scan current tab', scan, 'primary'), button('Edit profile', () => navigate('profile'))); app.append(empty); return;
  }
  app.append(el('p', session.scan.url, 'url'));
  const workspace = el('div', '', 'workspace'); const content = el('div', '', 'content-column');
  const ready = suggestions.filter(s => s.status === 'ready');
  const other = suggestions.filter(s => s.status !== 'ready');
  const actions = actionPanel(results ? 'Write complete' : review ? 'Approve the write' : 'Next: review answers', 'scan');
  if (results) {
    const count = results.filter(r => r.status === 'filled').length;
    actions.append(el('p', `${count} fields filled · ${results.length - count} skipped. No submit action was taken by FormPilot.`, count ? 'success' : 'warning'));
  } else if (review) {
    actions.append(el('p', 'Some websites autosave when fields change. Only selected answers will be filled. FormPilot never clicks submit.', 'warning'));
    const selected = el('p', '', 'selection-summary'); selected.id = 'selection-summary'; selected.setAttribute('aria-live', 'polite'); actions.append(selected);
    const fill = button('Fill selected', async () => run(async () => {
      if (!session) return; results = await fillSelected(session, suggestions); announce('Write complete. Review filled and skipped fields below.', 'success');
    }, 'Filling approved fields… Rechecking the original page before each write.'), 'primary wide'); fill.id = 'fill'; actions.append(fill);
  } else {
    actions.append(el('p', `${ready.length} sourced suggestions · ${other.length} left for you`, 'summary-count'));
    actions.append(el('p', 'Exact matches use rules, not AI. You can edit or deselect each answer before filling.', 'source'));
    const reviewButton = button('Review answers', () => navigate('review'), 'primary wide'); reviewButton.disabled = ready.length === 0; actions.append(reviewButton);
    if (suggestions.some(s => s.status === 'missing' && aiEligible(s.field))) {
      const optional = el('details', '', 'optional-model'); optional.open = feedbackTone === 'error';
      optional.append(el('summary', 'Need a local model?'), el('p', 'Optional. Sends only the facts you choose to your paired local bridge.', 'source'), button('Try local model', tryModel, 'wide')); actions.append(optional);
    }
  }
  const tools = el('div', '', 'scan-tools'); tools.append(button('Scan again', scan, 'text-button'));
  if (feedbackTone === 'error') actions.append(button('Edit profile & model settings', () => { modelOpen = true; navigate('profile'); }, 'text-button wide'));
  const coverage = el('details'); coverage.append(el('summary', 'Scan coverage')); session.scan.warnings.forEach(w => coverage.append(el('p', w, 'source'))); tools.append(coverage); actions.append(tools);
  const readySection = el('section'); readySection.append(el('h2', results ? 'Reviewed answers' : 'Sourced answers'));
  if (!ready.length) readySection.append(el('p', suggestions.length ? 'No clear matches yet. Add a matching fact to your profile, or complete the question yourself.' : 'No supported visible form controls found. Check Scan coverage, then try an ordinary form.', 'empty-message'));
  ready.forEach(s => readySection.append(suggestionRow(s, review, results, updateFillButton))); content.append(readySection);
  if (other.length) {
    const rest = el('section', '', 'manual-section'); rest.append(el('h2', 'Left for you'), el('p', 'These fields will not be filled by FormPilot.', 'source'));
    other.forEach(s => rest.append(suggestionRow(s, review, results, updateFillButton))); content.append(rest);
  }
  workspace.append(actions, content); app.append(workspace); updateFillButton();
}
function updateFillButton() {
  const fill = document.querySelector<HTMLButtonElement>('#fill');
  if (!fill) return;
  const selected = suggestions.filter(s => s.status === 'ready' && s.selected);
  const invalid = selected.some(s => !s.value.trim());
  fill.textContent = `Fill selected (${selected.length})`; fill.disabled = selected.length === 0 || invalid || busy;
  document.querySelector('#selection-summary')!.textContent = invalid ? 'An answer is empty. Add a value or deselect it.' : `${selected.length} of ${suggestions.filter(s => s.status === 'ready').length} sourced answers selected. ${selected.length ? 'Nothing is written until you approve.' : 'Select an answer below to enable filling.'}`;
}
function render() {
  notice.remove(); app.replaceChildren();
  document.querySelectorAll<HTMLButtonElement>('nav button').forEach(b => { b.disabled = busy; if (b.dataset.step === step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
  if (step === 'profile') showProfile(); else showSuggestions(step === 'review');
  if (!notice.isConnected) { notice.textContent = ''; app.append(notice); }
}
document.querySelectorAll<HTMLButtonElement>('nav button').forEach(b => b.addEventListener('click', () => { if (!busy) navigate(b.dataset.step!); }));
try { facts = await loadProfile(); } catch { announce('The saved profile could not be loaded. Try reopening FormPilot; you can still enter facts for this session.', 'error'); }
render();
