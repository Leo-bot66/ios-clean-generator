import { merge as mergeRules, eligibleSources as activeSources } from './merge-core.js';

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


/* ---------- 状态 ---------- */
let DATA = null;
let mode = 'full';
let selected = new Set();
let activeCat = '全部';
let lastOutput = '';

/* ---------- DOM ---------- */
const $ = id => document.getElementById(id);

/* ---------- 工具 ---------- */
function eligibleSources(app) { return activeSources(app, mode); }

function bestLic(app) {
  const es = eligibleSources(app);
  if (!es.length) return null;
  if (es.some(s => s.lic === 'MIT')) return 'MIT';
  if (es.some(s => s.lic === 'Apache-2.0')) return 'Apache';
  if (es.some(s => s.lic === 'GPL-3.0' || s.lic === 'GPL-2.0')) return 'GPL';
  return '未声明';
}


/* ---------- 核心：合并 ---------- */
function merge(apps) {
  return mergeRules(apps, mode, { moduleName: CONFIG.moduleName, updatedAt: DATA?.updatedAt });
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
      <span class="lic">${dis ? (a.available === false ? '上游暂无可用规则' : '当前模式不支持') : lic}</span></span>
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
  $('subscribeNote').style.display = 'block';
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
    const res = await fetch('/data/modules.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    DATA = await res.json();
    if (!Array.isArray(DATA.apps) || !DATA.apps.length) throw new Error('Invalid module data');
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
  if ($('ruleStatus') && DATA.updatedAt) {
    const stamp = new Date(DATA.updatedAt);
    const date = stamp.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
    const checked = new Date(DATA.checkedAt || DATA.updatedAt);
    const stale = Date.now() - checked.getTime() > 7 * 24 * 60 * 60 * 1000;
    const available = DATA.apps.filter(a => eligibleSources(a).length).length;
    const checkDate = checked.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
    $('ruleStatus').textContent = `规则版本：${date} · 最近检查：${checkDate} · ${available} 款可用${stale ? ' · 超过 7 天未检查，请留意更新状态' : ''}`;
    $('ruleStatus').className = stale ? 'note warn' : 'note';
  }

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
      if (lastOutput) { $('out').classList.remove('show'); $('acts').style.display = 'none'; $('subscribeNote').style.display = 'none'; lastOutput = ''; $('gen').textContent = '生成配置模块'; }
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
  $('subscribe').onclick = async () => {
    const apps = currentApps();
    if (!apps.length) return;
    const link = new URL('/rules/latest.sgmodule', location.origin);
    link.searchParams.set('apps', apps.map(app => app.id).sort().join(','));
    link.searchParams.set('mode', mode);
    try {
      await navigator.clipboard.writeText(link.href);
      $('subscribe').textContent = '✓ 已复制订阅地址';
    } catch {
      $('shareUrl').textContent = link.href;
      $('shareOut').classList.add('show');
    }
    setTimeout(() => $('subscribe').textContent = '复制长期订阅地址', 1800);
  };

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
