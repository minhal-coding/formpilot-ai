import { pageAgent } from './page-agent';
import { manualReason } from './safety';
import type { Scan, Suggestion, Result } from './types';
export type Session = { tabId: number; documentId: string; scan: Scan };
export async function scanCurrentTab(): Promise<Session> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !/^(https?|file):/.test(tab.url)) throw new Error('Open an ordinary web page and click the FormPilot toolbar icon first. Browser settings and store pages cannot be scanned.');
  const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, func: pageAgent, args: ['scan'] });
  if (!result?.result || !result.documentId) throw new Error('Could not read this page.');
  return { tabId: tab.id, documentId: result.documentId, scan: result.result as Scan };
}
export async function fillSelected(session: Session, suggestions: Suggestion[]): Promise<Result[]> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== session.tabId || tab.url !== session.scan.url) throw new Error('Active tab or URL changed. Return to the original page and scan again.');
  const selected = suggestions.filter(s => s.selected && s.status === 'ready' && !manualReason(s.field));
  const [result] = await chrome.scripting.executeScript({ target: { tabId: session.tabId, documentIds: [session.documentId] }, func: pageAgent, args: ['fill', session.scan.token, selected.map(s => ({ id: s.field.id, value: s.value }))] });
  if (!result?.result) throw new Error('Page changed. Scan again.');
  return result.result as Result[];
}
