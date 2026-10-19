import { lookup } from 'node:dns/promises';
import { Agent, fetch } from 'undici';
import ipaddr from 'ipaddr.js';

export function publicAddress(address: string): boolean {
  try {
    const parsed = ipaddr.process(address);
    return parsed.range() === 'unicast';
  } catch { return false; }
}
export function publicUrl(value: string): URL {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Only HTTP(S) URLs without embedded credentials are supported');
  }
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('Only ports 80 and 443 are supported');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || !host.includes('.')) {
    throw new Error('Use a public website, not a local network address');
  }
  if (ipaddr.isValid(host) && !publicAddress(host)) throw new Error('Private or reserved addresses are not supported');
  return url;
}

/** Resolve and pin a public address for every request and redirect. No credentials/cookies. */
export async function publicFetch(value: string, options: { timeoutMs?: number; maxBytes?: number; accept?: string } = {}): Promise<{
  url: string; status: number; ok: boolean; headers: Record<string, string>; body: string;
}> {
  const signal = AbortSignal.timeout(options.timeoutMs ?? 15000);
  let url = publicUrl(value);
  for (let redirect = 0; redirect < 6; redirect++) {
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const addresses = await lookup(host, { all: true });
    if (!addresses.length || addresses.some(a => !publicAddress(a.address))) throw new Error('DNS resolved to a private or reserved address');
    const chosen = addresses[0];
    const dispatcher = new Agent({ connect: { lookup: (_hostname, opts, callback) => {
      if (opts.all) (callback as Function)(null, [chosen]);
      else callback(null, chosen.address, chosen.family);
    } } });
    try {
      const res = await fetch(url, { signal, redirect: 'manual', dispatcher,
        headers: { 'user-agent': 'bizlens/0.1 (+https://github.com/DevelopersGlobal/bizlens)', accept: options.accept ?? 'text/html,application/json;q=0.9,*/*;q=0.5' } });
      if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.get('location')) {
        url = publicUrl(new URL(res.headers.get('location')!, url).href);
        await res.body?.cancel();
        continue;
      }
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (res.body) for await (const chunk of res.body) {
        size += chunk.length;
        if (size > (options.maxBytes ?? 2000000)) throw new Error('Response exceeds size limit');
        chunks.push(chunk);
      }
      return { url: url.href, status: res.status, ok: res.ok, headers: Object.fromEntries(res.headers.entries()), body: Buffer.concat(chunks).toString('utf8') };
    } finally { await dispatcher.destroy(); }
  }
  throw new Error('Too many redirects');
}
