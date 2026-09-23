export type Fact = { id: string; label: string; value: string };
export type Field = {
  id: string; label: string; name: string; type: string; context: string;
  populated: boolean; options: { value: string; label: string; disabled: boolean }[];
};
export type Scan = { token: string; url: string; fields: Field[]; warnings: string[] };
export type Suggestion = { field: Field; value: string; fact?: Fact; method: 'Exact match' | 'Local model' | 'Edited by you'; status: 'ready' | 'missing' | 'manual' | 'existing'; reason: string; selected: boolean };
export type Write = { id: string; value: string };
export type Result = { id: string; status: 'filled' | 'skipped'; reason: string };
