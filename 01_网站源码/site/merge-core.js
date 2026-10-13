const ORDER = ["General","Host","Rule","URL Rewrite","Header Rewrite",
               "Body Rewrite","Map Local","Script","MITM"];

const ADULT_KW = ["jable","xhamster","e-hentai","exhentai","pornhub","xvideos","xnxx",
  "redtube","youporn","hanime","missav","javdb","18comic","nhentai","spankbang","91porn",
  "hentai","javbus","avmoo","avsox","javcl","javday","fbjav","javbigo","javhdfree","javporn",
  "javplayer","javsubbed","javfu","javgg","javleaked","javmost","javmvp","jav247","javenglish",
  "javhahaha","jav.land","javside","doodporn","youjizz","tnaflix","beeg","porn"];

const isAdult = s => { const l = s.toLowerCase(); return ADULT_KW.some(k => l.includes(k)); };
const HOST_RE = /^-?[A-Za-z0-9*_.\-]+$/;

const SAFE_LIC = ["MIT","Apache-2.0"];


export function eligibleSources(app, mode = 'full') {
  const active = app.sources.filter(s => Object.entries(s.sections).some(([section, lines]) =>
    section !== 'MITM' && lines.some(line => !/^(#|\/\/|;)/.test(line))));
  return mode === 'safe' ? active.filter(s => SAFE_LIC.includes(s.lic)) : active;
}

function cleanHost(tok) {
  const t = tok.trim().replace('%APPEND%','').replace('%INSERT%','').trim();
  if (!t || t.includes('%') || !HOST_RE.test(t)) return null;
  if (t === '*' || t === '-*' || t.includes('.') || t.startsWith('*')) return t;
  return null;
}

export function merge(apps, mode = 'full', options = {}) {
  const CONFIG = { moduleName: options.moduleName || 'iOS净化配置' };
  const DATA = { updatedAt: options.updatedAt };
  const secs = {}; ORDER.forEach(k => secs[k] = []);
  const seen = {}; ORDER.forEach(k => seen[k] = new Set());
  const hosts = [], hostSeen = new Set();
  const args = new Map(), argsDesc = new Map();
  const srcs = [], lics = new Set();
  let dropped = 0, rules = 0;

  for (const app of apps) {
    for (const s of eligibleSources(app, mode)) {
      srcs.push(`${app.name}·${s.name}`);
      lics.add(s.lic);
      // 参数
      (s.args || '').split(',').forEach(item => {
        item = item.trim(); if (!item) return;
        const i = item.indexOf(':');
        const k = (i < 0 ? item : item.slice(0, i)).trim();
        const v = i < 0 ? '' : item.slice(i + 1).trim();
        if (k && !args.has(k)) args.set(k, v);
      });
      (s.argsDesc || '').split(',').forEach(item => {
        item = item.trim(); if (!item) return;
        const i = item.indexOf(':');
        const k = (i < 0 ? item : item.slice(0, i)).trim();
        const v = i < 0 ? '' : item.slice(i + 1).trim();
        if (k && !argsDesc.has(k)) argsDesc.set(k, v);
      });
      // 各段
      for (const [name, lines] of Object.entries(s.sections)) {
        if (!secs[name]) secs[name] = [];
        if (!seen[name]) seen[name] = new Set();
        for (const raw of lines) {
          const ln = raw.trim();
          if (!ln) continue;
          if (name === 'MITM' && ln.toLowerCase().startsWith('hostname')) continue;
          if (isAdult(ln)) { dropped++; continue; }
          if (seen[name].has(ln)) continue;
          seen[name].add(ln);
          secs[name].push(ln);
          if (name !== 'MITM' && !ln.startsWith('#') && !ln.startsWith('//')) rules++;
        }
      }
      // MITM 主机名
      for (const ln of (s.sections.MITM || [])) {
        if (!ln.toLowerCase().startsWith('hostname')) continue;
        const val = ln.split('=').slice(1).join('=');
        for (const h of val.split(',')) {
          const c = cleanHost(h);
          if (!c || isAdult(c)) { dropped++; continue; }
          if (!hostSeen.has(c)) { hostSeen.add(c); hosts.push(c); }
        }
      }
    }
  }

  /* ---- 拼装 ---- */
  const L = [];
  L.push(`#!name=${CONFIG.moduleName}`);
  L.push(`#!desc=根据你的选择生成，覆盖 ${apps.length} 款 App 的开屏与信息流广告净化。配置步骤见使用教程。`);
  L.push(`#!category=去广告`);
  L.push(`#!remark=生成时间 ${new Date().toISOString().slice(0,10)}｜来源 ${srcs.length} 个模块｜许可 ${[...lics].join(' / ')}`);
  if (DATA?.updatedAt) L.push(`# 规则同步时间: ${DATA.updatedAt}`);
  const argsLine = [...args].filter(([k,v]) => v).map(([k,v]) => `${k}:${v}`).join(', ');
  if (argsLine) L.push(`#!arguments=${argsLine}`);
  const descLine = [...argsDesc].filter(([k,v]) => v).map(([k,v]) => `${k}:${v}`).join(', ');
  if (descLine) L.push(`#!arguments-desc=${descLine}`);
  L.push('');
  L.push(`# ===== 已选 App（${apps.length}）=====`);
  L.push(`# ${apps.map(a => a.name).join('、')}`);
  L.push(`# ===== 合并来源（${srcs.length}）=====`);
  L.push(`# ${srcs.join(' / ')}`);
  for (const app of apps) {
    for (const source of eligibleSources(app, mode)) {
      if (source.url) L.push(`# ${app.name} · ${source.name} · ${source.lic} · ${source.url}`);
    }
  }
  L.push('');

  for (const name of ORDER) {
    const lines = secs[name] || [];
    if (name === 'MITM') {
      if (!hosts.length) continue;
      L.push('[MITM]');
      L.push('hostname = %APPEND% ' + hosts.join(','));
      L.push('');
    } else if (lines.length) {
      L.push(`[${name}]`);
      L.push(...lines);
      L.push('');
    }
  }

  const text = L.join('\n');
  return { text, rules, hosts: hosts.length, srcs: srcs.length, lics: [...lics], dropped,
           bytes: new Blob([text]).size };
}
