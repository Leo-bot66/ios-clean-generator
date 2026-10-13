import assert from 'node:assert/strict';
import fs from 'node:fs';
import { merge, eligibleSources } from './site/merge-core.js';

const data = JSON.parse(fs.readFileSync(new URL('./site/data/modules.json', import.meta.url), 'utf8'));
const hot = ['zhihu', 'bilibili', 'weibo', 'xiaohongshu', 'netease_music', 'amap', 'tieba'];
for (const mode of ['full', 'safe']) {
  for (const ids of [hot, data.apps.map(app => app.id)]) {
    const apps = data.apps.filter(app => ids.includes(app.id) && eligibleSources(app, mode).length);
    const result = merge(apps, mode, { updatedAt: data.updatedAt });
    assert(result.text.startsWith('#!name='));
    assert(result.rules > 0 && result.hosts > 0);
    assert(!/jable|xhamster|pornhub|hentai|javdb|18comic|91porn/i.test(result.text));
    assert(!result.text.split('\n').some(line => /%[A-Z]+%/.test(line) && !line.startsWith('hostname = %APPEND%')));
    assert(result.text.includes(data.updatedAt));
    if (mode === 'safe') assert(result.lics.every(lic => ['MIT', 'Apache-2.0'].includes(lic)));
    console.log(`${mode}: ${apps.length} apps, ${result.rules} rules, ${result.hosts} hosts`);
  }
}
const inactive = { sources: [{ lic: 'MIT', sections: { MITM: ['hostname = %APPEND% example.com'] } }] };
assert.equal(eligibleSources(inactive).length, 0, 'MITM-only source must not masquerade as adblocking');
const duplicated = { name: 'test', sources: [{ name: 'test', lic: 'MIT', sections: { Rule: ['DOMAIN,ads.example.com,REJECT', 'DOMAIN,ads.example.com,REJECT'] } }] };
assert.equal(merge([duplicated]).rules, 1, 'duplicate rules are removed');
console.log('Merge checks passed');
