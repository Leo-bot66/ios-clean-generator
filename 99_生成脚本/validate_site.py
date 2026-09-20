"""静态检查首页、App 落地页、广告直链和 SEO 输出。"""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "01_网站源码" / "site"
AIRPORT_URL = "https://www.11pa.dpdns.org/"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def first(pattern: str, text: str, label: str) -> str:
    match = re.search(pattern, text, flags=re.I | re.S)
    require(bool(match), f"缺少 {label}")
    return match.group(1).strip()


def main() -> None:
    apps = json.loads((SITE / "data" / "modules.json").read_text(encoding="utf-8"))["apps"]
    titles: set[str] = set()
    descriptions: set[str] = set()

    home = (SITE / "index.html").read_text(encoding="utf-8")
    require(home.count(f'href="{AIRPORT_URL}"') >= 3, "首页机场直链不足 3 处")
    require('rel="canonical" href="{{SITE_ORIGIN}}/"' in home, "首页 canonical 缺失")
    require('type="application/ld+json"' in home, "首页结构化数据缺失")
    require('href="/apps/"' in home, "首页缺少 App 目录内链")
    require('<span class="promo-action">点击直达</span>' in home, "首页推广按钮文字错误")

    for app in apps:
        page_file = SITE / app["id"] / "index.html"
        require(page_file.is_file(), f"落地页不存在: {app['id']}")
        page = page_file.read_text(encoding="utf-8")
        title = first(r"<title>(.*?)</title>", page, f"{app['id']} title")
        description = first(r'<meta name="description" content="(.*?)">', page, f"{app['id']} description")
        require(title not in titles, f"title 重复: {title}")
        require(description not in descriptions, f"description 重复: {description}")
        titles.add(title)
        descriptions.add(description)
        require(f'href="{{{{SITE_ORIGIN}}}}/{app["id"]}/"' in page, f"canonical 错误: {app['id']}")
        require(f'/?pick={app["id"]}#build' in page, f"预选链接错误: {app['id']}")
        require(page.count(f'href="{AIRPORT_URL}"') >= 3, f"机场广告直链不足: {app['id']}")
        related = re.findall(r'<a href="/[^/]+/">[^<]+去广告配置</a>', page)
        require(len(related) >= 4, f"相关 App 内链不足: {app['id']}")
        require('type="application/ld+json"' in page, f"结构化数据缺失: {app['id']}")
        require('"@type":"BreadcrumbList"' in page, f"面包屑结构化数据缺失: {app['id']}")

    directory = (SITE / "apps" / "index.html").read_text(encoding="utf-8")
    require(directory.count('class="directory-group"') >= 5, "App 目录分类不足")
    for app in apps:
        require(f'href="/{app["id"]}/"' in directory, f"App 目录缺少内链: {app['id']}")

    sitemap = (SITE / "sitemap.xml").read_text(encoding="utf-8")
    require(sitemap.count("<url>") == len(apps) + 2, "sitemap URL 数量不正确")
    require("{{SITE_ORIGIN}}/apps/" in sitemap, "sitemap 缺少 App 目录")
    require("{{SITE_ORIGIN}}" in sitemap, "sitemap 缺少运行时域名占位符")
    require("Sitemap: {{SITE_ORIGIN}}/sitemap.xml" in (SITE / "robots.txt").read_text(encoding="utf-8"), "robots sitemap 缺失")

    app_js = (SITE / "app.js").read_text(encoding="utf-8")
    require("URLSearchParams(location.search).get('pick')" in app_js, "首页预选参数未实现")
    require(AIRPORT_URL in app_js, "CTA 未使用机场前端直链")

    worker = (ROOT / "01_网站源码" / "worker" / "index.js").read_text(encoding="utf-8")
    require("replaceAll('{{SITE_ORIGIN}}', url.origin)" in worker, "Worker 未注入 SEO 绝对域名")
    print(f"检查通过：首页 + App 目录 + {len(apps)} 个落地页 + sitemap + 广告直链 + SEO")


if __name__ == "__main__":
    main()
