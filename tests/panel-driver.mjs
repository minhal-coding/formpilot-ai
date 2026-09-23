import { writeFile } from 'node:fs/promises';

/** Native side panels aren't exposed as Playwright Pages. Use their actual CDP target. */
export async function attachPanel(browserCdp, targetId) {
  const { sessionId } = await browserCdp.send('Target.attachToTarget', { targetId, flatten: false });
  const pending = new Map(); let nextId = 1;
  browserCdp.on('Target.receivedMessageFromTarget', event => {
    if (event.sessionId !== sessionId) return;
    const message = JSON.parse(event.message);
    const task = pending.get(message.id);
    if (task) { pending.delete(message.id); if (message.error) task.reject(new Error(message.error.message)); else task.resolve(message.result); }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++; pending.set(id, { resolve, reject });
    browserCdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) }).catch(reject);
  });
  async function evaluate(fn, arg) {
    const expression = `(${fn.toString()})(${JSON.stringify(arg) ?? ''})`;
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  }
  async function wait(fn, arg) {
    for (let i = 0; i < 100; i++) { if (await evaluate(fn, arg)) return; await new Promise(r => setTimeout(r, 100)); }
    throw new Error(`Panel wait timed out: ${await evaluate(() => document.body.innerText)}`);
  }
  async function click(text) {
    await wait(text => Array.from(document.querySelectorAll('button')).some(b => b.textContent === text && !b.disabled), text);
    const point = await evaluate(text => { const b = Array.from(document.querySelectorAll('button')).find(b => b.textContent === text); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, text);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  }
  async function fill(label, value) {
    await evaluate(label => { const caption = Array.from(document.querySelectorAll('label')).find(l => l.textContent === label); const input = document.getElementById(caption.htmlFor); input.focus(); input.select(); }, label);
    await send('Input.insertText', { text: value });
  }
  async function screenshot(file, fullPage = true) {
    if (!fullPage) await evaluate(() => scrollTo(0, 0));
    const { cssContentSize } = await send('Page.getLayoutMetrics');
    const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: fullPage, ...(fullPage ? { clip: { x: 0, y: 0, width: cssContentSize.width, height: cssContentSize.height, scale: 1 } } : {}) });
    await writeFile(file, Buffer.from(result.data, 'base64'));
  }
  await send('Runtime.enable'); await send('Page.enable');
  return { send, evaluate, wait, click, fill, screenshot };
}
