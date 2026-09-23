import { describe, it, expect, afterEach } from 'vitest';
import { createBridge } from '../scripts/bridge.mjs';
import http from 'node:http';
const origin = `chrome-extension://${'a'.repeat(32)}`;
const token = 'fixture-token-not-a-secret';
let server;
afterEach(async () => { if (server) { await new Promise(resolve => server.close(resolve)); server = undefined; } });
async function start(fetcher) {
  ({ server } = createBridge({ origin, token, fetcher }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}/match`;
}
const headers = { Host: '127.0.0.1:3210', Origin: origin, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const body = JSON.stringify({ fields: [{ id: 'a', label: 'Contact details', type: 'text' }], facts: [{ id: 'email', label: 'Email', value: 'alex@example.com' }] });
// Node fetch ignores a custom Host header. Use an HTTP client to exercise rebinding checks.
function request(url, options) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: options.method, headers: options.headers }, res => {
      let text = ''; res.on('data', chunk => text += chunk); res.on('end', () => resolve({ status: res.statusCode, headers: new Headers(res.headers), json: async () => JSON.parse(text) }));
    });
    req.on('error', reject); req.end(options.body);
  });
}
describe('loopback bridge boundary', () => {
  it('requires an extension origin and rejects cloud models', () => {
    expect(() => createBridge()).toThrow(); expect(() => createBridge({ origin: 'https://example.com' })).toThrow(); expect(() => createBridge({ origin, model: 'something:cloud' })).toThrow();
  });
  it('rejects webpage origins, missing tokens, rebinding hosts, and GET', async () => {
    const url = await start(() => { throw new Error('Must not contact Ollama'); });
    for (const changed of [{ Origin: 'https://evil.example' }, { Authorization: '' }, { Host: 'evil.example:3210' }]) {
      expect((await request(url, { method: 'POST', headers: { ...headers, ...changed }, body })).status).toBe(403);
    }
    expect((await request(url, { headers })).status).toBe(403);
  });
  it('forwards approved metadata to loopback Ollama with structured output', async () => {
    let captured;
    const url = await start(async (address, options) => { captured = { address, data: JSON.parse(options.body) }; return new Response(JSON.stringify({ message: { content: '{"matches":[]}' } })); });
    const response = await request(url, { method: 'POST', headers, body });
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ matches: [] });
    expect(captured.address).toBe('http://127.0.0.1:11434/api/chat'); expect(captured.data.stream).toBe(false); expect(captured.data.format.type).toBe('object');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
  });
  it('returns a recoverable error when the model is offline', async () => {
    const url = await start(async () => { throw new Error('Connection refused'); });
    expect((await request(url, { method: 'POST', headers, body })).status).toBe(503);
  });
});
