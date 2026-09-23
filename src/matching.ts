import type { Fact, Field, Suggestion } from './types';
import { manualReason, normalize } from './safety';
const aliases: Record<string, string[]> = {
  name: ['full name', 'name', 'your name', 'applicant name'],
  email: ['email', 'email address', 'e mail', 'contact email'],
  phone: ['phone', 'phone number', 'telephone', 'mobile', 'mobile number'],
  city: ['city', 'current city'], state: ['state', 'province', 'state province'],
  school: ['school', 'university', 'college', 'school name'],
  education: ['education', 'education summary'], work: ['work history', 'employment history'],
};
export function exactOption(field: Field, value: string): string | undefined {
  const matches = field.options.filter(o => !o.disabled && o.value !== '' && (normalize(o.label) === normalize(value) || normalize(o.value) === normalize(value)));
  return matches.length === 1 ? matches[0].value : undefined;
}
export function suggest(field: Field, facts: Fact[]): Suggestion {
  const base: Suggestion = { field, value: '', method: 'Exact match', status: 'missing', reason: 'No unambiguous approved fact. Complete manually.', selected: false };
  const reason = manualReason(field);
  if (reason) return { ...base, status: 'manual', reason };
  if (field.populated) return { ...base, status: 'existing', reason: 'Already has an answer. FormPilot will not overwrite it.' };
  // Prefer human-visible labels. A generic machine name cannot overrule an unfamiliar question.
  const key = normalize(field.label || field.name);
  const matches = facts.filter(f => f.value.trim() && (aliases[f.id] ?? [normalize(f.label)]).includes(key));
  if (matches.length !== 1) return base;
  const fact = matches[0];
  if (field.type === 'select-one' && exactOption(field, fact.value) === undefined) return { ...base, reason: 'No single exact available option matches the fact.' };
  return { ...base, fact, value: fact.value, status: 'ready', selected: true, reason: 'Exact field label matched an approved profile fact.' };
}
