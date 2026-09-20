/* ============================================================
   iOS 净化配置生成器
   ============================================================ */

/* ---------- 站点配置：改这里即可 ---------- */
const CONFIG = {
  // 机场前端直达地址（广告位与底部 CTA 共用）
  ctaUrl: 'https://www.11pa.dpdns.org/',
  ctaText: '查看真三网节点',
  // 生成文件的基础名
  baseName: 'ios-clean',
  // 生成模块的显示名
  moduleName: 'iOS净化配置',
};

/* ---------- 合并规则 ---------- */
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

/* ---------- 状态 ---------- */
let DATA = null;
let mode = 'full';
let selected = new Set();
let activeCat = '全部';
let lastOutput = '';

/* ---------- DOM ---------- */
const $ = id => document.getElementById(id);

/* ---------- 工具 ---------- */
function eligibleSources(app) {
  if (mode === 'safe') return app.sources.filter(s => SAFE_LIC.includes(s.lic));
  return app.sources;
}

function bestLic(app) {
  const es = eligibleSources(app);
  if (!es.length) return null;
  if (es.some(s => s.lic === 'MIT')) return 'MIT';
  if (es.some(s => s.lic === 'Apache-2.0')) return 'Apache';
  if (es.some(s => s.lic === 'GPL-3.0' || s.lic === 'GPL-2.0')) return 'GPL';
  return '未声明';
}

function cleanHost(tok) {
  const t = tok.trim().replace('%APPEND%','').replace('%INSERT%','').trim();
  if (!t || t.includes('%') || !HOST_RE.test(t)) return null;
  if (t === '*' || t === '-*' || t.includes('.') || t.startsWith('*')) return t;
  return null;
}

/* ---------- 核心：合并 ---------- */
function merge(apps) {
  const secs = {}; ORDER.forEach(k => secs[k] = []);
  const seen = {}; ORDER.forEach(k => seen[k] = new Set());
  const hosts = [], hostSeen = new Set();
  const args = new Map(), argsDesc = new Map();
  const srcs = [], lics = new Set();
  let dropped = 0, rules = 0;

  for (const app of apps) {
    for (const s of eligibleSources(app)) {
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
  const argsLine = [...args].filter(([k,v]) => v).map(([k,v]) => `${k}:${v}`).join(', ');
  if (argsLine) L.push(`#!arguments=${argsLine}`);
  const descLine = [...argsDesc].filter(([k,v]) => v).map(([k,v]) => `${k}:${v}`).join(', ');
  if (descLine) L.push(`#!arguments-desc=${descLine}`);
  L.push('');
  L.push(`# ===== 已选 App（${apps.length}）=====`);
  L.push(`# ${apps.map(a => a.name).join('、')}`);
  L.push(`# ===== 合并来源（${srcs.length}）=====`);
  L.push(`# ${srcs.join(' / ')}`);
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

/* ---------- 渲染 ---------- */
function renderCats() {
  const cats = ['全部', ...new Set(DATA.apps.map(a => a.cat))];
  $('cats').innerHTML = cats.map(c =>
    `<button type="button" class="chip${c === activeCat ? ' on' : ''}" data-cat="${c}" aria-pressed="${c === activeCat}">${c}</button>`).join('');
  $('cats').querySelectorAll('.chip').forEach(b => b.onclick = () => {
    activeCat = b.dataset.cat; renderCats(); renderGrid();
  });
}

function renderGrid() {
  const list = DATA.apps.filter(a => activeCat === '全部' || a.cat === activeCat);
  $('grid').innerHTML = list.map(a => {
    const lic = bestLic(a);
    const on = selected.has(a.id);
    const dis = lic === null;
    return `<button type="button" class="app${on ? ' on' : ''}" data-id="${a.id}" aria-pressed="${on}" ${dis ? 'disabled' : ''}>
      <span class="tick">✓</span>
      <span class="ico">${a.emoji}</span>
      <span class="tx"><span class="nm">${a.name}</span>
      <span class="lic">${dis ? '当前模式不支持' : lic}</span></span>
    </button>`;
  }).join('');
  $('grid').querySelectorAll('.app').forEach(b => {
    b.onclick = () => {
      const id = b.dataset.id;
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      renderGrid(); updateCount();
    };
  });
  updateCount();
}

function updateCount() {
  $('cnt').textContent = `已选 ${selected.size} 个`;
  $('s-apps').textContent = selected.size;
}

function currentApps() {
  return DATA.apps.filter(a => selected.has(a.id) && eligibleSources(a).length);
}

/* ---------- 生成 ---------- */
function doGenerate() {
  const apps = currentApps();
  if (!apps.length) return;
  const r = merge(apps);
  lastOutput = r.text;

  $('s-rules').textContent = r.rules.toLocaleString();
  $('s-size').textContent = (r.bytes / 1024).toFixed(1) + ' KB';
  $('out-name').textContent = `${CONFIG.baseName}.sgmodule`;
  $('out-meta').textContent = `${r.srcs} 个来源 · ${r.hosts} 个域名`;

  $('preview').textContent = r.text.split('\n').slice(0, 42).join('\n') +
    (r.text.split('\n').length > 42 ? '\n\n… （完整内容请下载文件）' : '');

  $('out').classList.add('show');
  $('acts').style.display = 'flex';
  $('shareOut').classList.remove('show');
  $('gen').textContent = '重新生成';

  const needsGpl = r.lics.some(l => l.startsWith('GPL'));
  const noLic = r.lics.includes('未声明');
  const note = $('licNote');
  note.style.display = 'block';
  if (noLic) {
    note.className = 'note warn';
    note.innerHTML = `<b>⚠️ 本次生成包含"未声明许可"的来源</b>（${r.lics.join(' / ')}）。<br>
      这些项目的作者未声明开源许可证，默认保留全部权利。自用没问题，但<b>请勿对外分发或用于商业交付</b>。<br>
      想要可安全商用的版本，请切换到「合规模式」重新生成。`;
  } else if (needsGpl) {
    note.className = 'note warn';
    note.innerHTML = `<b>许可提示</b>：本次生成包含 GPL-2.0 / GPL-3.0 来源（${r.lics.join(' / ')}）。<br>
      自己使用没有任何限制；<b>如果要把生成结果对外分发，需要整体以 GPL 开源并提供源码</b>。<br>
      如需可安全商用的版本，请切换到「合规模式」。`;
  } else {
    note.className = 'note ok';
    note.innerHTML = `<b>✓ 许可干净</b>：本次生成仅包含 ${r.lics.join(' / ')} 来源，可安全用于商业交付。`;
  }
  if (r.dropped) {
    note.innerHTML += `<br><span style="opacity:.75">已自动剔除 ${r.dropped} 条无关/不合规规则。</span>`;
  }
}

/* ---------- 事件 ---------- */
window.addEventListener('DOMContentLoaded', async () => {
  $('ctaBtn').textContent = CONFIG.ctaText;
  $('ctaBtn').href = CONFIG.ctaUrl;

  try {
    const res = await fetch('data/modules.json');
    DATA = await res.json();
  } catch (e) {
    $('grid').innerHTML = '<div class="note warn">模块数据加载失败，请通过 HTTP 访问本页面。</div>';
    return;
  }

  // 落地页通过 ?pick=app-id 预选应用；支持逗号分隔多个 id。
  const requested = (new URLSearchParams(location.search).get('pick') || '')
    .split(',').map(x => x.trim()).filter(Boolean);
  const requestedApps = requested.map(id => DATA.apps.find(a => a.id === id)).filter(Boolean);
  requestedApps.forEach(a => selected.add(a.id));
  if (requestedApps.length === 1) activeCat = requestedApps[0].cat;

  renderCats(); renderGrid();

  document.querySelectorAll('#modes .mode').forEach(m => {
    m.onclick = () => {
      document.querySelectorAll('#modes .mode').forEach(x => x.classList.remove('on'));
      document.querySelectorAll('#modes .mode').forEach(x => x.setAttribute('aria-pressed', 'false'));
      m.classList.add('on');
      m.setAttribute('aria-pressed', 'true');
      mode = m.dataset.mode;
      // 清掉在新模式下不再可用的选择
      [...selected].forEach(id => {
        const a = DATA.apps.find(x => x.id === id);
        if (!a || !eligibleSources(a).length) selected.delete(id);
      });
      renderGrid();
      if (lastOutput) { $('out').classList.remove('show'); $('acts').style.display = 'none'; lastOutput = ''; $('gen').textContent = '生成配置模块'; }
    };
  });

  const HOT = ['zhihu','bilibili','weibo','xiaohongshu','netease_music','amap','tieba'];
  $('pickHot').onclick = () => {
    HOT.forEach(id => { const a = DATA.apps.find(x => x.id === id); if (a && eligibleSources(a).length) selected.add(id); });
    renderGrid();
  };
  $('pickAll').onclick = () => {
    DATA.apps.forEach(a => { if (eligibleSources(a).length) selected.add(a.id); });
    renderGrid();
  };
  $('clearAll').onclick = () => { selected.clear(); renderGrid(); };

  $('gen').onclick = doGenerate;

  $('dl').onclick = () => {
    const blob = new Blob([lastOutput], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${CONFIG.baseName}.sgmodule`;
    a.click();
    URL.revokeObjectURL(a.href);
    $('dl').textContent = '✓ 已下载';
    setTimeout(() => $('dl').textContent = '下载模块文件', 1800);
  };

  $('cp').onclick = async () => {
    try { await navigator.clipboard.writeText(lastOutput); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = lastOutput; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
    }
    $('cp').textContent = '✓ 已复制';
    setTimeout(() => $('cp').textContent = '复制全部内容', 1800);
  };

  /* ---- 分享链接（需部署 Worker + KV） ---- */
  let shareEnabled = false;
  try {
    const h = await fetch('api/health');
    if (h.ok) shareEnabled = !!(await h.json()).share;
  } catch {}
  if (shareEnabled) $('share').style.display = 'inline-flex';

  $('share').onclick = async () => {
    if (!lastOutput) return;
    $('share').textContent = '生成中…';
    try {
      const r = await fetch('api/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: lastOutput }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'failed');
      $('shareUrl').textContent = d.url;
      $('shareOut').classList.add('show');
      $('share').textContent = '🔗 生成分享链接';
    } catch (e) {
      $('share').textContent = '✗ 生成失败';
      setTimeout(() => $('share').textContent = '🔗 生成分享链接', 1800);
    }
  };

  $('shareUrl').onclick = async () => {
    try {
      await navigator.clipboard.writeText($('shareUrl').textContent);
      $('shareUrl').style.color = 'var(--ok)';
      setTimeout(() => $('shareUrl').style.color = '', 1200);
    } catch {}
  };
});

// 生成按钮状态跟随选择
const _orig = updateCount;
updateCount = function () {
  _orig();
  const n = currentApps().length;
  const g = $('gen');
  if (g && !lastOutput) {
    g.disabled = n === 0;
    g.textContent = n === 0 ? '请先选择 App' : `生成配置模块（${n} 个 App）`;
  }
};
