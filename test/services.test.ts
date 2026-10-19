import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { analyzeWithOllama } from '../src/analyze/ollama.js';
import { validateAnalysis } from '../src/analyze/claims.js';
import { EvidenceBuilder } from '../src/evidence.js';
import { hnMentions } from '../src/history/hackernews.js';
// Local server contract check is not a model quality test.
test('Ollama HTTP contract produces validated structured analysis', async () => {
  let request: Record<string,unknown> = {};
  const server = createServer(async (req,res) => { let body=''; for await (const c of req) body += c; request=JSON.parse(body); res.setHeader('content-type','application/json'); res.end(JSON.stringify({response:JSON.stringify({sections:[{title:'Business model',claims:[{text:'The site describes a deployment product',kind:'inferred',evidenceIds:['E1']}]}],unknowns:['Revenue not established']})})); });
  await new Promise<void>(r => server.listen(0,'127.0.0.1',r));
  try {
    const address=server.address(); if (!address || typeof address==='string') throw new Error('No server');
    const raw=await analyzeWithOllama('Evidence', {host:`http://127.0.0.1:${address.port}`,model:'fixture',timeoutMs:1000});
    const pack={target:'https://example.com',domain:'example.com',fetchedAt:'2026-10-19',pagesFetched:[],pagesFailed:[],timeline:[],limitations:[],evidence:[{id:'E1',signal:'meta',summary:'Deploy',quote:'Deploy your app',sourceUrl:'https://example.com',observedAt:'2026-10-19'}]};
    assert.equal(validateAnalysis(raw,pack).sections.length,1); assert.equal(request.format,'json'); assert.equal(request.stream,false);
  } finally { await new Promise<void>((r,j)=>server.close(e=>e?j(e):r())); }
});
test('Ollama cloud and credential endpoints rejected before network', async () => {
  for (const host of ['https://ollama.com','http://u:p@localhost:11434']) await assert.rejects(analyzeWithOllama('x',{host,model:'x',timeoutMs:100}));
});
