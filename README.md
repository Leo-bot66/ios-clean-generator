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
python -m unittest discover -s 99_生成脚本 -p 'test_*.py'
npm test --prefix 01_网站源码
node --check .\01_网站源码\site\app.js
node --check .\01_网站源码\worker\index.js
```

GitHub Actions 会在每次推送时重新生成落地页并执行 SEO 与语法检查，防止 sitemap、canonical、目录内链或推广直链出现回归。

## 持续规则维护

每天北京时间 09:25，GitHub Actions 同步当前四个来源仓库的最新版本，校验 53 个模块和引用的脚本／规则文件。模块格式异常、上游下载失败或有效规则大幅减少时停止更新，保留上一份快照。检查只确认格式和链接可用，不代替 iPhone 上的实际广告效果验收。

手动同步：`python 99_生成脚本/sync_rules.py`，随后运行上述检查。来源路径见 `99_生成脚本/upstreams.json`，固定提交和检查时间记录在 `site/data/rule-status.json`。上游没有有效规则的应用会标为不可用；目前腾讯视频来源只有 MITM 域名，不能当作有效去广告配置。

生成器提供「复制长期订阅地址」按钮。将该地址作为远程模块导入 Shadowrocket，再使用客户端的模块更新功能，能持续获取本站发布的新快照。本地下载文件和 90 天分享链接是静态快照，不会随仓库更新。

自动上线需要在 GitHub 仓库的 Actions Secrets 中配置 `CLOUDFLARE_API_TOKEN`（限该账户的 Worker 部署权限）及 `CLOUDFLARE_ACCOUNT_ID`。若未配置，规则同步和提交照常完成，部署步骤会明确报错，不会误报已上线。当前定时流程使用 Wrangler 4.149.0。

## 部署

Cloudflare Workers 配置与部署说明见 [`01_网站源码/README_部署指南.md`](01_网站源码/README_部署指南.md)。线上主域名为 `s.tangping.icu`，请避免将 GitHub Pages 配成另一个可索引副本，以免产生重复内容。

## 来源与许可

规则整合自多个开源项目，不同来源采用 MIT、Apache-2.0、GPL-2.0、GPL-3.0 或其他声明。生成结果会标注对应来源；涉及 GPL 来源的再分发应遵守相应许可证。详见 [`06_许可与合规`](06_许可与合规/)。

网站不能保证永久或 100% 去除所有广告；App 更新、服务端策略和客户端交互都可能影响效果。

