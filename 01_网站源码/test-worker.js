import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from './worker/index.js';
import { merge, eligibleSources } from './site/merge-core.js';

const data = JSON.parse(fs.readFileSync(new URL('./site/data/modules.json', import.meta.url), 'utf8'));
const env = { ASSETS: { async fetch(request) {
  if (new URL(request.url).pathname === '/data/modules.json') return Response.json(data);
  return new Response('<title>{{SITE_ORIGIN}}</title>', { headers: { 'content-type': 'text/html' } });
} } };
const url = 'https://s.tangping.icu/rules/latest.sgmodule?apps=zhihu,bilibili&mode=full';
const response = await worker.fetch(new Request(url), env);
const apps = data.apps.filter(app => ['zhihu', 'bilibili'].includes(app.id) && eligibleSources(app).length);
assert.equal(response.status, 200);
assert.equal(await response.text(), merge(apps, 'full', { updatedAt: data.updatedAt }).text);
assert.equal(response.headers.get('cache-control'), 'no-cache');
assert.equal(response.headers.get('x-rule-updated-at'), data.updatedAt);
const head = await worker.fetch(new Request(url, { method: 'HEAD' }), env);
assert.equal(await head.text(), '');
assert.equal((await worker.fetch(new Request('https://s.tangping.icu/rules/latest.sgmodule?mode=unknown'), env)).status, 400);
assert.equal((await worker.fetch(new Request('https://s.tangping.icu/rules/latest.sgmodule?apps=not-an-app'), env)).status, 400);
assert.equal((await worker.fetch(new Request(url, { method: 'POST' }), env)).status, 405);
assert.equal((await worker.fetch(new Request('https://s.tangping.icu/rules/latest.sgmodule?apps=tencent_video'), env)).status, 404);
const broken = { ASSETS: { fetch: async () => new Response('', { status: 503 }) } };
assert.equal((await worker.fetch(new Request(url), broken)).status, 503);
const page = await worker.fetch(new Request('https://s.tangping.icu/'), env);
assert.equal(await page.text(), '<title>https://s.tangping.icu</title>');
assert.equal(page.headers.get('cache-control'), 'no-cache');
console.log('Subscription and Worker checks passed');
