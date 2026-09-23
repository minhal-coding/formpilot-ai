export function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
}
export function button(text: string, action: () => void | Promise<void>, className = ''): HTMLButtonElement {
  const node = element('button', text, className); node.type = 'button'; node.addEventListener('click', () => { void action(); }); return node;
}
export function inputField(label: string, value: string, onInput: (value: string) => void, multiline = false) {
  const wrapper = element('div'); const id = `input-${crypto.randomUUID()}`;
  const caption = element('label', label); caption.htmlFor = id;
  const input = multiline ? element('textarea') : element('input'); input.id = id; input.value = value; input.maxLength = 3000;
  input.addEventListener('input', () => onInput(input.value)); wrapper.append(caption, input); return wrapper;
}
