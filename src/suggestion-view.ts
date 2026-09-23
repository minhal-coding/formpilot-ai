import { element as el, inputField } from './ui';
import type { Suggestion, Result } from './types';

export function sourceText(s: Suggestion) {
  return s.method === 'Edited by you'
    ? 'Edited by you · Not a profile fact'
    : `Profile → ${s.fact?.label} · ${s.method}`;
}

export function suggestionRow(s: Suggestion, review: boolean, results: Result[] | undefined, update: () => void) {
  const row = el('section', '', 'field-row');
  const field = s.field;
  if (review && s.status === 'ready' && !results) {
    const selection = el('label', '', 'selection');
    const check = el('input'); check.type = 'checkbox'; check.checked = s.selected;
    check.setAttribute('aria-label', `Fill ${field.label}`);
    const selectionText = el('span', s.selected ? 'Selected for filling' : 'Leave unchanged');
    selection.append(check, selectionText);
    check.addEventListener('change', () => {
      s.selected = check.checked; selectionText.textContent = s.selected ? 'Selected for filling' : 'Leave unchanged'; update();
    });
    const source = el('p', sourceText(s), 'source'); source.id = `source-${field.id}`;
    const error = el('p', '', 'field-error'); error.id = `error-${field.id}`;
    const input = inputField(field.label || 'Unnamed field', s.value, value => {
      s.value = value; s.method = 'Edited by you';
      source.textContent = 'Edited by you · This answer is no longer presented as a profile fact.';
      validate(); update();
    }, field.type === 'textarea' || s.value.length > 80);
    const control = input.querySelector('input,textarea') as HTMLInputElement | HTMLTextAreaElement;
    control.setAttribute('aria-describedby', `${source.id} ${error.id}`);
    function validate() {
      const invalid = s.selected && !s.value.trim();
      control.setAttribute('aria-invalid', String(invalid));
      error.textContent = invalid ? 'Enter an answer or deselect this field.' : '';
    }
    check.addEventListener('change', validate);
    row.append(selection, input, source, error);
    if (s.method === 'Local model') row.append(el('p', 'Model-proposed mapping. Exact fact value checked; confirm that it answers this question.', 'model-note'));
    validate();
  } else {
    const heading = el('div', '', 'row-heading');
    const status = s.method === 'Edited by you' ? 'Edited by you' : s.method === 'Local model' ? 'Model proposal' : { ready: 'Exact match', missing: 'Needs your answer', manual: 'Manual only', existing: 'Already answered' }[s.status];
    heading.append(el('h3', field.label || 'Unnamed field'), el('span', status, `status ${s.status}`));
    row.append(heading);
    if (s.value) row.append(el('p', s.value, 'answer'));
    row.append(el('p', s.status === 'ready' ? sourceText(s) : s.reason, 'source'));
  }
  const result = results?.find(r => r.id === field.id);
  if (result) row.append(el('p', `${result.status === 'filled' ? 'Filled' : 'Skipped'} — ${result.reason}`, `write-result ${result.status}`));
  else if (results && s.status === 'ready') row.append(el('p', 'Not selected — left unchanged.', 'write-result'));
  return row;
}
