import type { EvidencePack } from '../evidence.js';
export const SECTIONS = [
  'What this business does', 'Business model', 'Pricing', 'Distribution and growth',
  'How it was built - timeline', 'What appears to be working well',
  'Ideas to try when starting from scratch', 'Risks and gaps', 'Unknowns and limitations',
] as const;
export interface Claim { text: string; kind: 'observed' | 'inferred'; evidenceIds: string[]; }
export interface Analysis { sections: { title: string; claims: Claim[] }[]; unknowns: string[]; }
const numbers = (text: string): string[] => text.match(/\d[\d,.]*(?:\s?(?:million|billion|crore|lakh|[kmb])\b)?/gi) ?? [];
const normalize = (s: string): string => s.toLowerCase().replace(/[\s,]/g, '');
export function validateAnalysis(value: unknown, pack: EvidencePack): Analysis {
  if (!value || typeof value !== 'object') throw new Error('Model did not return an object');
  const a = value as Analysis;
  if (!Array.isArray(a.sections) || !Array.isArray(a.unknowns)) throw new Error('Model output must contain sections and unknowns arrays');
  const ids = new Map(pack.evidence.map(e => [e.id, e]));
  if (!a.sections.length || a.sections.length > SECTIONS.length) throw new Error('Invalid section count');
  const titles = new Set<string>();
  for (const section of a.sections) {
    if (!(SECTIONS as readonly string[]).includes(section.title) || titles.has(section.title) || !Array.isArray(section.claims)) throw new Error('Invalid/duplicate report section');
    titles.add(section.title);
    for (const c of section.claims) {
      if (!c || typeof c.text !== 'string' || !c.text.trim() || c.text.length > 1500 || !['observed', 'inferred'].includes(c.kind)) throw new Error('Invalid claim');
      if (!Array.isArray(c.evidenceIds) || !c.evidenceIds.length || c.evidenceIds.some(id => typeof id !== 'string' || !ids.has(id))) throw new Error('Claim has missing or nonexistent evidence IDs');
      const source = c.evidenceIds.map(id => { const e = ids.get(id)!; return e.quote; }).join(' ');
      const allowed = numbers(source).map(normalize);
      if (numbers(c.text).some(n => !allowed.includes(normalize(n)))) throw new Error('Claim includes a number absent from its cited evidence');
      // Structural checks do not prove semantic entailment; reports state that clearly.
    }
  }
  if (a.unknowns.some(u => typeof u !== 'string' || u.length > 1000)) throw new Error('Invalid unknowns');
  return a;
}
export function analysisMarkdown(a: Analysis): string {
  const parts: string[] = [];
  for (const title of SECTIONS) {
    const s = a.sections.find(s => s.title === title);
    parts.push(`## ${title}`, '');
    for (const c of s?.claims ?? []) {
      const plain = c.text.replace(/[<>\[\]`]/g, '').replace(/\s+/g, ' ').trim();
      parts.push(`- ${plain} [${c.kind === 'inferred' ? 'inferred from' : 'observed'} ${c.evidenceIds.join(', ')}]`);
    }
    if (!s?.claims.length) parts.push('Not established by the collected evidence.');
    if (title === 'Unknowns and limitations') for (const u of a.unknowns) parts.push(`- Model-reported unknown: ${u.replace(/[<>\[\]`]/g, '').replace(/\s+/g, ' ')}`);
    parts.push('');
  }
  return parts.join('\n');
}
