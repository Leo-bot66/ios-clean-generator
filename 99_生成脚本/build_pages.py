"""为每款 App 生成可搜索、可内链的静态落地页与 sitemap。"""

from __future__ import annotations

import html
import json
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "01_网站源码" / "site"
DATA_FILE = SITE / "data" / "modules.json"
AIRPORT_URL = "https://www.11pa.dpdns.org/"
SITE_ORIGIN = "{{SITE_ORIGIN}}"

PAIN_BY_CATEGORY = {
    "资讯": "开屏倒计时、首页信息流推广和热点页商业卡片",
    "视频": "开屏广告、首页推荐流推广和播放页营销内容",
    "社区": "开屏广告、推荐信息流推广和详情页营销卡片",
    "音乐": "开屏广告、首页横幅和推荐流推广内容",
    "出行": "开屏广告、首页浮层和出行场景营销卡片",
    "阅读": "开屏广告、书城推荐推广和阅读页营销内容",
    "音频": "开屏广告、首页推荐流和播放页推广内容",
    "社交": "开屏广告、动态信息流推广和活动弹窗",
    "购物": "开屏广告、首页营销浮层和推荐流推广",
    "生活": "开屏广告、首页营销卡片和活动弹窗",
    "工具": "开屏广告、首页横幅和功能页推广内容",
    "运动": "开屏广告、首页推荐和课程营销卡片",
    "通用": "网页横幅、第三方广告 SDK 和常见追踪请求",
}


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def app_description(app: dict) -> str:
    pain = PAIN_BY_CATEGORY.get(app["cat"], "开屏广告、信息流推广和营销弹窗")
    return (
        f"免费在线生成 {app['name']} 去广告配置，针对{pain}进行净化。"
        "勾选即生成专属小火箭（Shadowrocket）模块，免越狱，附完整导入教程。"
    )


def related_apps(app: dict, apps: list[dict], count: int = 6) -> list[dict]:
    same_category = [item for item in apps if item["id"] != app["id"] and item["cat"] == app["cat"]]
    others = [item for item in apps if item["id"] != app["id"] and item not in same_category]
    return (same_category + others)[:count]


def json_ld(app: dict, description: str) -> str:
    app_url = f"{SITE_ORIGIN}/{app['id']}/"
    data = [
        {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": f"{app['name']}去广告配置",
            "url": app_url,
            "description": description,
            "inLanguage": "zh-CN",
            "isPartOf": {
                "@type": "WebSite",
                "name": "小火箭去广告配置生成器",
                "url": f"{SITE_ORIGIN}/",
            },
        },
        {
            "@context": "https://schema.org",
            "@type": "HowTo",
            "name": f"如何安装 {app['name']} 去广告模块",
            "totalTime": "PT3M",
            "step": [
                {"@type": "HowToStep", "name": "生成模块", "text": f"预选 {app['name']} 并生成模块文件。"},
                {"@type": "HowToStep", "name": "导入模块", "text": "在 Shadowrocket 的配置模块页导入文件。"},
                {"@type": "HowToStep", "name": "生成证书", "text": "进入当前配置的 HTTPS 解密页面生成 CA 证书。"},
                {"@type": "HowToStep", "name": "信任证书", "text": "在 iOS 证书信任设置中信任 Shadowrocket 证书。"},
                {"@type": "HowToStep", "name": "开启功能", "text": "打开模块、HTTPS 解密和 Shadowrocket 总开关。"},
            ],
        },
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "首页", "item": f"{SITE_ORIGIN}/"},
                {"@type": "ListItem", "position": 2, "name": "全部 App", "item": f"{SITE_ORIGIN}/apps/"},
                {"@type": "ListItem", "position": 3, "name": f"{app['name']}去广告配置", "item": app_url},
            ],
        },
    ]
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def page_html(app: dict, apps: list[dict]) -> str:
    name = esc(app["name"])
    app_id = esc(app["id"])
    pain = esc(PAIN_BY_CATEGORY.get(app["cat"], "开屏广告、信息流推广和营销弹窗"))
    description = app_description(app)
    related = related_apps(app, apps)
    related_html = "".join(
        f'<a href="/{esc(item["id"])}/">{esc(item["name"])}去广告配置</a>' for item in related
    )

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{name}去广告配置 · 小火箭（Shadowrocket）模块</title>
<meta name="description" content="{esc(description)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<meta name="theme-color" content="#4f46e5">
<link rel="canonical" href="{SITE_ORIGIN}/{app_id}/">
<link rel="alternate" hreflang="zh-CN" href="{SITE_ORIGIN}/{app_id}/">
<link rel="alternate" hreflang="x-default" href="{SITE_ORIGIN}/{app_id}/">
<meta property="og:title" content="{name}去广告配置 · 小火箭模块">
<meta property="og:description" content="{esc(description)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="小火箭去广告配置生成器">
<meta property="og:locale" content="zh_CN">
<meta property="og:url" content="{SITE_ORIGIN}/{app_id}/">
<meta name="twitter:card" content="summary">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/style.css">
<script type="application/ld+json">{json_ld(app, description)}</script>
</head>
<body>
<a class="skip-link" href="#generate">跳到一键生成</a>
<header>
  <div class="wrap hd">
    <a class="brand" href="/" style="color:inherit;text-decoration:none"><span class="dot"></span>小火箭去广告配置生成器<small>Shadowrocket</small></a>
    <nav><a href="/#build">生成配置</a><a href="/apps/">全部 App</a><a href="/#how">安装教程</a><a class="nav-promo" href="{AIRPORT_URL}" target="_blank" rel="sponsored noopener noreferrer">真三网节点</a></nav>
  </div>
</header>

<main class="wrap landing">
  <div class="landing-hero">
    <div class="breadcrumbs"><a href="/">首页</a> / <a href="/apps/">全部 App</a> / {name}去广告配置</div>
    <span class="tag">免费 · 免越狱 · 在线生成</span>
    <h1>{name}去广告配置</h1>
    <p>针对 {name} 常见的{pain}进行净化，在线生成可直接导入 Shadowrocket（小火箭）的专属模块。</p>
    <div class="landing-actions" id="generate">
      <a class="btn primary" href="/?pick={app_id}#build">一键生成 {name} 去广告模块</a>
      <a class="btn sec" href="#install">查看安装步骤</a>
    </div>
  </div>

  <aside aria-label="真三网优化机场推广">
    <a class="promo-card" href="{AIRPORT_URL}" target="_blank" rel="sponsored noopener noreferrer">
      <span class="promo-kicker"><span>推广</span> 小火箭用户专享线路</span>
      <span class="promo-copy"><strong>真三网优化 AI 线路</strong><span>独家朝鲜节点 · AI 智能选线 · 多地区高速入口</span></span>
      <span class="promo-badges" aria-hidden="true"><span>三网优化</span><span>AI 选线</span><span>朝鲜节点</span></span>
      <span class="promo-action">点击直达</span>
    </a>
  </aside>

  <section>
    <div class="feature-card">
      <h2>{name}常见广告位</h2>
      <p>{name} 用户通常会遇到{pain}。规则会尽量减少这些干扰，但广告形式会随 App 版本变化，无法承诺永久或 100% 去除。</p>
    </div>
  </section>

  <section id="install">
    <div class="sect-h"><h2>{name}去广告模块安装步骤</h2><span class="hint">约 3 分钟</span></div>
    <ol class="steps">
      <li>点击上面的「一键生成」，页面会自动预选 <b>{name}</b>；确认后生成并下载模块文件</li>
      <li>打开小火箭，进入 <b>「配置」→「模块」→ 右上角 ➕</b>，选择文件下载并开启模块</li>
      <li>回到<b>「配置」</b>页，点当前配置文件右侧的 <b>ⓘ</b> →「HTTPS 解密」→「证书」→「生成新的 CA 证书」</li>
      <li class="key"><b>系统【设置】→【通用】→【关于本机】→【证书信任设置】→ 开启 Shadowrocket</b><small>这是最容易漏掉、也最关键的一步。</small></li>
      <li>回到配置文件的「HTTPS 解密」页面打开总开关，再回首页打开 Shadowrocket 顶部总开关</li>
    </ol>
    <div class="note ok"><b>完成后仍有广告？</b>先强制退出 {name} 再重新打开。规则更新与 App 缓存都可能影响即时效果。</div>
  </section>

  <section>
    <div class="sect-h"><h2>适用范围</h2><span class="hint">先了解边界</span></div>
    <div class="ba">
      <div class="side good"><h3>能处理</h3><ul><li>常见开屏广告</li><li>信息流与横幅推广</li><li>第三方广告 SDK 请求</li><li>部分统计与追踪域名</li></ul></div>
      <div class="side bad"><h3>不承诺处理</h3><ul><li>「摇一摇」等客户端交互</li><li>会员权益或付费内容</li><li>全部版本的 100% 广告</li><li>规则更新后的即时兼容</li></ul></div>
    </div>
  </section>

  <section>
    <div class="sect-h"><h2>相关 App 去广告配置</h2><span class="hint">继续选择</span></div>
    <div class="related-grid">{related_html}</div>
  </section>

  <section>
    <div class="cta cta-airport">
      <span class="ad-label">推广</span>
      <h2>配置好了，还差一条好线路？</h2>
      <p>真三网优化 AI 线路，提供独家朝鲜节点与多地区高速入口。</p>
      <a class="btn primary" href="{AIRPORT_URL}" target="_blank" rel="sponsored noopener noreferrer" style="max-width:280px;margin:0 auto;text-decoration:none">查看真三网节点</a>
    </div>
  </section>

  <footer>
    <p><a href="/">返回小火箭去广告配置生成器</a> · <a href="/apps/">全部 App</a> · <a href="https://github.com/Leo-bot66/ios-clean-generator">GitHub 开源仓库</a> · <a href="{AIRPORT_URL}" target="_blank" rel="sponsored noopener noreferrer">真三网优化 AI 线路</a>（推广）</p>
    <p>本站只提供配置模块，不提供 Shadowrocket 软件本身。规则只作用于你自己的设备，可随时关闭。</p>
  </footer>
</main>
</body>
</html>
"""


def apps_index_html(apps: list[dict]) -> str:
    groups: dict[str, list[dict]] = {}
    for app in apps:
        groups.setdefault(app["cat"], []).append(app)

    groups_html = "".join(
        f'''<section class="directory-group">
    <div class="sect-h"><h2>{esc(category)}类 App</h2><span class="hint">{len(items)} 款</span></div>
    <div class="directory-grid">{''.join(
        f'<a href="/{esc(item["id"])}/"><span>{esc(item["emoji"])}</span><strong>{esc(item["name"])}去广告</strong><small>Shadowrocket 模块</small></a>'
        for item in items
    )}</div>
  </section>'''
        for category, items in groups.items()
    )

    item_list = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "小火箭去广告配置 App 目录",
        "numberOfItems": len(apps),
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": index,
                "name": f"{app['name']}去广告配置",
                "url": f"{SITE_ORIGIN}/{app['id']}/",
            }
            for index, app in enumerate(apps, start=1)
        ],
    }
    item_list_json = json.dumps(item_list, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")

    return f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>全部 App 去广告配置 · Shadowrocket 小火箭模块目录</title>
<meta name="description" content="浏览全部 {len(apps)} 款 App 的小火箭去广告配置，覆盖视频、资讯、音乐、购物、生活、社交等分类，一键进入并生成专属 Shadowrocket 模块。">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<meta name="theme-color" content="#4f46e5">
<link rel="canonical" href="{SITE_ORIGIN}/apps/">
<link rel="alternate" hreflang="zh-CN" href="{SITE_ORIGIN}/apps/">
<link rel="alternate" hreflang="x-default" href="{SITE_ORIGIN}/apps/">
<meta property="og:title" content="全部 App 去广告配置 · 小火箭模块目录">
<meta property="og:description" content="按分类查找 {len(apps)} 款 App 的 Shadowrocket 去广告配置。">
<meta property="og:type" content="website">
<meta property="og:site_name" content="小火箭去广告配置生成器">
<meta property="og:locale" content="zh_CN">
<meta property="og:url" content="{SITE_ORIGIN}/apps/">
<meta name="twitter:card" content="summary">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/style.css">
<script type="application/ld+json">{item_list_json}</script>
</head>
<body>
<a class="skip-link" href="#apps">跳到 App 目录</a>
<header><div class="wrap hd">
  <a class="brand" href="/" style="color:inherit;text-decoration:none"><span class="dot"></span>小火箭去广告配置生成器<small>Shadowrocket</small></a>
  <nav><a href="/#build">生成配置</a><a href="/apps/">全部 App</a><a href="/#how">安装教程</a><a class="nav-promo" href="{AIRPORT_URL}" target="_blank" rel="sponsored noopener noreferrer">真三网节点</a></nav>
</div></header>
<main class="wrap landing app-directory" id="apps">
  <div class="landing-hero">
    <div class="breadcrumbs"><a href="/">首页</a> / 全部 App</div>
    <span class="tag">{len(apps)} 款 App · 分类查找</span>
    <h1>全部 App 去广告配置</h1>
    <p>选择常用 App，进入专属说明页并一键生成 Shadowrocket（小火箭）去广告模块。</p>
  </div>
  {groups_html}
  <section><div class="cta cta-airport"><span class="ad-label">推广</span><h2>需要更稳定的网络线路？</h2><p>真三网优化 AI 线路，提供独家朝鲜节点与多地区高速入口。</p><a class="btn primary" href="{AIRPORT_URL}" target="_blank" rel="sponsored noopener noreferrer" style="max-width:280px;margin:0 auto;text-decoration:none">点击直达</a></div></section>
  <footer><p><a href="/">返回首页</a> · <a href="https://github.com/Leo-bot66/ios-clean-generator">GitHub 开源仓库</a></p><p>规则效果会随 App 版本变化，无法承诺永久或 100% 去除。</p></footer>
</main>
</body>
</html>
'''


def sitemap_xml(apps: list[dict]) -> str:
    today = date.today().isoformat()
    urls = [f"{SITE_ORIGIN}/", f"{SITE_ORIGIN}/apps/"] + [f"{SITE_ORIGIN}/{app['id']}/" for app in apps]
    entries = "\n".join(
        f"  <url><loc>{esc(url)}</loc><lastmod>{today}</lastmod></url>" for url in urls
    )
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{entries}\n</urlset>\n'


def main() -> None:
    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    apps = data["apps"]

    for app in apps:
        target = SITE / app["id"] / "index.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(page_html(app, apps), encoding="utf-8", newline="\n")

    apps_index = SITE / "apps" / "index.html"
    apps_index.parent.mkdir(parents=True, exist_ok=True)
    apps_index.write_text(apps_index_html(apps), encoding="utf-8", newline="\n")

    (SITE / "sitemap.xml").write_text(sitemap_xml(apps), encoding="utf-8", newline="\n")
    print(f"已生成 {len(apps)} 个 App 落地页、App 目录页与 sitemap.xml")


if __name__ == "__main__":
    main()
