const fs = require('fs');
const src = fs.readFileSync('site/app.js', 'utf8');
const shim = `
const window = { addEventListener(){} };
const document = { getElementById: () => ({ style:{}, classList:{ add(){}, remove(){} },
  querySelectorAll: () => [], textContent:'', innerHTML:'', href:'', dataset:{} }) };
`;
const fn = new Function(shim + src + '\n;return { merge: merge, CONFIG: CONFIG, setMode:(m)=>{mode=m}, eligible: eligibleSources };');
const api = fn();
const DATA = JSON.parse(fs.readFileSync('site/data/modules.json', 'utf8'));

function run(modeLabel, ids) {
  api.setMode(modeLabel);
  const apps = DATA.apps.filter(a => ids.includes(a.id) && api.eligible(a).length);
  const r = api.merge(apps);
  const lines = r.text.split('\n');
  const secs = lines.filter(l => /^\[.+\]$/.test(l)).map(l => l.slice(1, -1));
  console.log('\n--- mode=' + modeLabel + ' | 传入 ' + ids.length + ' 个 → 实际生效 ' + apps.length + ' 个 ---');
  console.log('规则 ' + r.rules + ' 条 | ' + (r.bytes / 1024).toFixed(1) + ' KB | MITM ' + r.hosts +
              ' | 来源 ' + r.srcs + ' | 许可 ' + r.lics.join('/') + ' | 剔除 ' + r.dropped);
  console.log('段: ' + secs.join(' '));
  const bad = lines.find(l => /%[A-Z]+%/.test(l) && !l.startsWith('hostname = %APPEND%'));
  console.log('异常令牌: ' + (bad ? 'X ' + bad.slice(0, 90) : 'OK 无'));
  const adult = lines.find(l => /jable|xhamster|pornhub|hentai|javdb|18comic|91porn/i.test(l));
  console.log('成人域名: ' + (adult ? 'X ' + adult.slice(0, 90) : 'OK 无'));
  console.log('头部:');
  lines.slice(0, 4).forEach(l => console.log('   ' + l.slice(0, 120)));
}

const HOT = ['zhihu', 'bilibili', 'weibo', 'xiaohongshu', 'netease_music', 'amap', 'tieba'];
run('full', HOT);
run('safe', HOT);
run('full', DATA.apps.map(a => a.id));
run('safe', DATA.apps.map(a => a.id));
