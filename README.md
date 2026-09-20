# 小火箭去广告配置生成器

在线地址：[s.tangping.icu](https://s.tangping.icu/)

这是一个面向 iOS / Shadowrocket 用户的在线配置生成器。用户可以按 App 勾选需要的净化规则，在浏览器中生成可导入的小火箭模块。网站提供 46 款常用 App 的独立说明页、完整 App 目录、安装教程和规则边界说明。

## 主要功能

- 按 App 选择并生成 Shadowrocket 去广告模块
- 全量模式与合规模式
- 46 个独立 App 落地页与可抓取目录页
- 自动生成 sitemap、canonical、结构化数据和站内关联链接
- Cloudflare Workers + 静态资源部署
- 机场推广链接按广告链接规范标注 `rel="sponsored"`

## 本地检查

```powershell
python .\99_生成脚本\build_pages.py
python .\99_生成脚本\validate_site.py
node --check .\01_网站源码\site\app.js
node --check .\01_网站源码\worker\index.js
```

GitHub Actions 会在每次推送时重新生成落地页并执行 SEO 与语法检查，防止 sitemap、canonical、目录内链或推广直链出现回归。

## 部署

Cloudflare Workers 配置与部署说明见 [`01_网站源码/README_部署指南.md`](01_网站源码/README_部署指南.md)。线上主域名为 `s.tangping.icu`，请避免将 GitHub Pages 配成另一个可索引副本，以免产生重复内容。

## 来源与许可

规则整合自多个开源项目，不同来源采用 MIT、Apache-2.0、GPL-2.0、GPL-3.0 或其他声明。生成结果会标注对应来源；涉及 GPL 来源的再分发应遵守相应许可证。详见 [`06_许可与合规`](06_许可与合规/)。

网站不能保证永久或 100% 去除所有广告；App 更新、服务端策略和客户端交互都可能影响效果。

