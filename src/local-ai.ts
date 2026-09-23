import type { Fact, Field, Suggestion } from './types';
import { manualReason, normalize } from './safety';
import { exactOption } from './matching';

// Unknown questions remain manual. The model only resolves these bounded neutral labels.
export const aiEligible = (field: Field) => !manualReason(field) && !field.populated && ['contact', 'contact details', 'location', 'professional background'].includes(normalize(field.label));
export function validateModelOutput(raw: unknown, fields: Field[], facts: Fact[]): Suggestion[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).join() !== 'matches') throw new Error('Invalid model schema.');
  const matches = (raw as { matches: unknown }).matches;
  if (!Array.isArray(matches) || matches.length > fields.length) throw new Error('Invalid model matches.');
  const seen = new Set<string>();
  return matches.map(item => {
    if (!item || typeof item !== 'object' || Object.keys(item).sort().join() !== 'factId,fieldId,value' || !['fieldId', 'factId', 'value'].every(key => typeof item[key] === 'string')) throw new Error('Invalid model entry.');
    const field = fields.find(f => f.id === item.fieldId);
    const fact = facts.find(f => f.id === item.factId);
    if (!field || !aiEligible(field) || !fact || !fact.value.trim() || item.value !== fact.value || seen.has(field.id)) throw new Error('Unsupported model evidence.');
    if (field.type === 'select-one' && exactOption(field, fact.value) === undefined) throw new Error('Model answer has no exact option.');
    seen.add(field.id);
    return { field, fact, value: fact.value, method: 'Local model', status: 'ready', selected: false, reason: 'Local model proposed this field-to-fact mapping. Exact fact value verified; review its meaning yourself.' };
  });
}
export async function askLocalModel(fields: Field[], facts: Fact[], token: string, timeout = 20000): Promise<Suggestion[]> {
  const response = await fetch('http://127.0.0.1:3210/match', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(timeout),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fields: fields.filter(aiEligible).map(({ id, label, type, options }) => ({ id, label, type, options })), facts }),
  });
  if (!response.ok) throw new Error(`Local bridge returned ${response.status}.`);
  return validateModelOutput(await response.json(), fields, facts);
}
