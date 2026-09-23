import type { Field } from './types';
export const normalize = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[_\W]+/g, ' ').trim();
const sensitive = /password|passcode|one.?time|\botp\b|captcha|credit|debit|card number|payment|bank|routing|social security|\bssn\b|passport|government|national id|tax id|driver.?s? licen|birth|\bage\b|citizen|visa|immigra|sponsor|authoriz|eligible|eligibility|right to work|legally|legal|attest|certif|declar|consent|agree|signature|gender|\bsex\b|race|ethnic|religio|veteran|disab|health|medical|diagnos|accommodation|pregnan|marital|criminal|convict|background check|screening|clearance|security question|mother.?s maiden|maiden name|ignore|instruction|system prompt|override|secret|token|honey|leave.*blank/i;
export function manualReason(field: Field): string | undefined {
  if (!['text', 'email', 'tel', 'url', 'textarea', 'select-one'].includes(field.type)) return 'Unsupported control or declaration — complete manually.';
  if (sensitive.test([field.label, field.name, field.context].join(' '))) return 'Sensitive, uncertain, or instruction-like question — complete manually.';
}
