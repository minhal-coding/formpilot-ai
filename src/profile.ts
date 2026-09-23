import type { Fact } from './types';
export const definitions = [
  ['name', 'Full name'], ['email', 'Email'], ['phone', 'Phone'], ['city', 'City'], ['state', 'State'],
  ['school', 'School'], ['education', 'Education'], ['work', 'Work history'],
] as const;
export const blankProfile = (): Fact[] => definitions.map(([id, label]) => ({ id, label, value: '' }));
export const sampleProfile = (): Fact[] => {
  const values = ['Alex Morgan', 'alex@example.com', '202-555-0147', 'Portland', 'Oregon', 'Fictional State University', 'BA in Design, 2022 (fictional)', 'Product designer at Example Studio, 2022–2025 (fictional)'];
  return definitions.map(([id, label], i) => ({ id, label, value: values[i] }));
};
export async function loadProfile(): Promise<Fact[]> {
  const { profile } = await chrome.storage.local.get('profile');
  if (!Array.isArray(profile)) return blankProfile();
  return profile.filter((f: Fact) => typeof f.id === 'string' && typeof f.label === 'string' && typeof f.value === 'string').slice(0, 16);
}
export const saveProfile = (profile: Fact[]) => chrome.storage.local.set({ profile });
