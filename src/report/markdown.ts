import type { EvidencePack } from '../evidence.js';
export function verificationWarnings(analysis: string): string[] {
  return analysis.split('\n').filter(l => /\$\s?\d|\b(?:ARR|MRR)\b/i.test(l) && !/\[(?:observed|inferred from) E\d+(?:, E\d+)*\]/.test(l));
}
const cell = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '&#124;').replace(/[\r\n]/g, ' ').replace(/`/g, '&#96;');
function appendix(pack: EvidencePack): string {
  return ['## Evidence appendix', '', '| ID | Signal | Observation | Source | Excerpt |', '| --- | --- | --- | --- | --- |',
    ...pack.evidence.map(e => `| ${e.id} | ${cell(e.signal)} | ${cell(e.summary)} | ${cell(e.sourceUrl)} | ${cell(e.quote)} |`), '',
    '## Collection limits', '', ...pack.limitations.map(l => `- ${cell(l)}`), '',
    ...pack.pagesFailed.map(f => `- Skipped ${cell(f.url)}: ${cell(f.error)}`), ''].join('\n');
}
export function renderReport(pack: EvidencePack, analysis: string, model: string): string {
  return [`# Business model report: ${pack.domain}`, '', `Target: ${pack.target}`, `Collected: ${pack.fetchedAt}`, `Local model: ${cell(model)}`, '',
    '> AI-generated analysis. Observed means the cited source exposed or claimed it, not independent verification. Inferences are hypotheses. Citation and numeric checks do not prove that a claim follows from its source. Review before relying on it.', '', analysis, '', appendix(pack)].join('\n');
}
export function renderSkeleton(pack: EvidencePack): string {
  return [`# Business evidence: ${pack.domain}`, '', `Collected: ${pack.fetchedAt}`, '',
    'Evidence only. No accepted model analysis is included. This file may result from --no-llm, an unavailable model, or a rejected response. It does not explain the full business model.', '', appendix(pack)].join('\n');
}
