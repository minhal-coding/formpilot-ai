import type { Scan, Field, Write, Result } from './types';

/** Self-contained: serialized into the isolated world by chrome.scripting. */
export function pageAgent(command: 'scan' | 'fill', token = '', writes: Write[] = []): Scan | Result[] {
  type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  type Snapshot = { node: Control; field: Field; fingerprint: string };
  type State = { token: string; url: string; nodes: Map<string, Snapshot> };
  const scope = globalThis as typeof globalThis & { __formpilot?: State };
  const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
  const visible = (el: Control) => {
    if (el.disabled || el.matches(':disabled') || ('readOnly' in el && el.readOnly) || el.closest('[inert],[hidden],[aria-hidden="true"],[data-formpilot-ui]')) return false;
    if (el instanceof HTMLInputElement && el.type === 'hidden') return false;
    for (let p: Element | null = el; p; p = p.parentElement) {
      const style = getComputedStyle(p);
      if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 2 && rect.height > 2 && rect.right + scrollX > 0 && rect.bottom + scrollY > 0;
  };
  const read = (el: Control, id: string): Field => {
    const labelled = (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).map(id => document.getElementById(id)?.textContent ?? '').join(' ');
    const labels = Array.from(el.labels ?? []).map(l => l.textContent ?? '').join(' ');
    const described = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).map(id => document.getElementById(id)?.textContent ?? '').join(' ');
    const label = clean(labelled || el.getAttribute('aria-label') || labels || el.getAttribute('placeholder') || el.name || el.id);
    const context = clean([described, el.getAttribute('title'), el.getAttribute('autocomplete'), el.closest('fieldset')?.querySelector('legend')?.textContent, el.parentElement?.textContent?.slice(0, 1000)].filter(Boolean).join(' '));
    return { id, label, name: el.name, type: el instanceof HTMLTextAreaElement ? 'textarea' : el.type, context,
      populated: el.value !== '', options: el instanceof HTMLSelectElement ? Array.from(el.options).map(o => ({ value: o.value, label: o.text, disabled: o.disabled || (o.parentElement instanceof HTMLOptGroupElement && o.parentElement.disabled) })) : [] };
  };
  const fingerprint = (el: Control, field: Field) => JSON.stringify({ label: field.label, name: field.name, type: field.type, context: field.context, options: field.options, id: el.id, htmlType: el.getAttribute('type'), placeholder: el.getAttribute('placeholder'), maxLength: el.getAttribute('maxlength'), pattern: el.getAttribute('pattern'), form: el.form?.id, action: el.form?.action });
  if (command === 'scan') {
    const state: State = { token: crypto.randomUUID(), url: location.href, nodes: new Map() };
    const fields: Field[] = [];
    for (const node of document.querySelectorAll<Control>('input,textarea,select')) {
      if (!visible(node) || /honeypot|leave.?blank|website.?confirm/i.test(node.name + ' ' + node.id)) continue;
      const id = crypto.randomUUID();
      const field = read(node, id);
      fields.push(field); state.nodes.set(id, { node, field, fingerprint: fingerprint(node, field) });
    }
    scope.__formpilot = state;
    const warnings = ['Only ordinary controls in the top-level page are supported. Shadow DOM and custom widgets are not scanned.'];
    if (document.querySelector('iframe,frame')) warnings.push('Embedded frames are not scanned, including cross-origin forms.');
    return { token: state.token, url: state.url, fields, warnings };
  }
  const state = scope.__formpilot;
  return writes.map(write => {
    const skip = (reason: string): Result => ({ id: write.id, status: 'skipped', reason });
    if (!state || state.token !== token || state.url !== location.href) return skip('Page or scan changed. Scan again.');
    const snapshot = state.nodes.get(write.id);
    if (!snapshot || !snapshot.node.isConnected || !visible(snapshot.node)) return skip('Field removed, hidden, or no longer editable.');
    const { node } = snapshot;
    const current = read(node, write.id);
    if (fingerprint(node, current) !== snapshot.fingerprint) return skip('Field identity, question, or options changed.');
    if (node.value !== '') return skip('Already has an answer.');
    if (!['text', 'email', 'tel', 'url', 'textarea', 'select-one'].includes(current.type)) return skip('Unsupported control.');
    if (typeof write.value !== 'string' || !write.value.trim() || write.value.length > 10000) return skip('Empty or oversized answer.');
    let value = write.value;
    if (node instanceof HTMLSelectElement) {
      const normalize = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[_\W]+/g, ' ').trim();
      const options = current.options.filter(o => !o.disabled && o.value && (normalize(o.label) === normalize(value) || normalize(o.value) === normalize(value)));
      if (options.length !== 1) return skip('No single exact available option.');
      value = options[0].value;
    } else if (node.maxLength >= 0 && value.length > node.maxLength) return skip('Answer exceeds field length limit.');
    const prototype = node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(node, value);
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
    return { id: write.id, status: 'filled', reason: 'Filled; input and change events sent.' };
  });
}
