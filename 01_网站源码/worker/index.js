/**
 * iOS 净化配置生成器 · Cloudflare Worker
 * 静态资源由 ASSETS 绑定提供；本 Worker 额外提供「生成分享链接」能力：
 *   POST /api/save      存入 KV，返回短链
 *   GET  /m/<id>.sgmodule  读取并返回模块内容
 *   GET  /api/health    健康检查（前端用它决定是否显示分享按钮）
 *
 * KV 未配置时自动降级：/api/health 返回 available:false，前端隐藏分享按钮。
 */

import { merge, eligibleSources } from '../site/merge-core.js';

const ID_CHARS = 'abcdefghijkmnpqrstuvwxyz23456789';
const MAX_BYTES = 2 * 1024 * 1024;   // KV 单值上限内，保守取 2MB
const TTL = 60 * 60 * 24 * 90;       // 90 天过期
const TEXT_TYPES = ['text/html', 'text/xml', 'application/xml', 'text/plain'];

function newId(len = 10) {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, b => ID_CHARS[b % ID_CHARS.length]).join('');
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json;charset=utf-8', 'cache-control': 'no-store' },
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const hasKV = !!env.LINKS;

    /* ---------- 长期订阅：每次更新读取当前部署的规则快照 ---------- */
    if (path === '/rules/latest.sgmodule') {
      if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
      const mode = url.searchParams.get('mode') || 'full';
      if (!['full', 'safe'].includes(mode)) return json({ error: 'INVALID_MODE' }, 400);
      const response = await env.ASSETS.fetch(new Request(`${url.origin}/data/modules.json`));
      if (!response.ok) return json({ error: 'RULE_DATA_UNAVAILABLE' }, 503);
      const data = await response.json();
      const ids = [...new Set((url.searchParams.get('apps') || '').split(',').filter(Boolean))];
      if (ids.some(id => !data.apps.some(app => app.id === id))) return json({ error: 'UNKNOWN_APP' }, 400);
      const apps = data.apps.filter(app => (!ids.length || ids.includes(app.id)) && eligibleSources(app, mode).length);
      if (!apps.length) return json({ error: 'NO_AVAILABLE_RULES' }, 404);
      const result = merge(apps, mode, { updatedAt: data.updatedAt });
      return new Response(request.method === 'HEAD' ? null : result.text, {
        headers: { 'content-type': 'text/plain;charset=utf-8', 'cache-control': 'no-cache',
                   'x-robots-tag': 'noindex', 'x-rule-updated-at': data.updatedAt || '' },
      });
    }

    /* ---------- 健康检查 ---------- */
    if (path === '/api/health') {
      return json({ ok: true, share: hasKV });
    }

    /* ---------- 保存并生成短链 ---------- */
    if (path === '/api/save' && request.method === 'POST') {
      if (!hasKV) return json({ ok: false, error: 'KV_NOT_CONFIGURED' }, 503);
      let body;
      try { body = await request.json(); }
      catch { return json({ ok: false, error: 'BAD_JSON' }, 400); }

      const content = typeof body?.content === 'string' ? body.content : '';
      if (!content || content.length > MAX_BYTES) {
        return json({ ok: false, error: 'BAD_CONTENT' }, 400);
      }
      if (!content.startsWith('#!name=')) {
        return json({ ok: false, error: 'NOT_A_MODULE' }, 400);
      }

      const id = newId(10);
      await env.LINKS.put(`m:${id}`, content, { expirationTtl: TTL });

      return json({
        ok: true,
        id,
        url: `${url.origin}/m/${id}.sgmodule`,
        expiresInDays: 90,
      });
    }

    /* ---------- 读取模块 ---------- */
    const m = path.match(/^\/m\/([a-z0-9]{6,16})\.sgmodule$/);
    if (m) {
      if (!hasKV) return new Response('分享功能未启用', { status: 503 });
      const content = await env.LINKS.get(`m:${m[1]}`);
      if (!content) return new Response('链接已过期或不存在', { status: 404 });
      return new Response(content, {
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'public, max-age=300',
        },
      });
    }

    /* ---------- 静态资源 + SEO 绝对网址注入 ---------- */
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    headers.set('x-content-type-options', 'nosniff');
    headers.set('referrer-policy', 'strict-origin-when-cross-origin');
    headers.set('x-frame-options', 'DENY');
    headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');

    const type = headers.get('content-type') || '';
    if (path.startsWith('/data/') || type.includes('text/html') || path.endsWith('.js')) {
      headers.set('cache-control', 'no-cache');
    }
    if (asset.ok && TEXT_TYPES.some(t => type.includes(t))) {
      const text = (await asset.text()).replaceAll('{{SITE_ORIGIN}}', url.origin);
      headers.delete('content-length');
      return new Response(text, { status: asset.status, statusText: asset.statusText, headers });
    }

    return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
  },
};
