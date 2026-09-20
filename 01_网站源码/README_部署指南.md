# iOS 净化配置生成器 · 部署指南

一个静态前端 + Cloudflare Worker 的在线工具：用户勾选 App → 生成专属 `.sgmodule` → 下载或拿一条分享链接。Worker 同时负责把 SEO 占位符替换成当前访问域名。

---

## 一、目录结构

本目录只含网站本体；其余资料在项目根的其他编号目录。

```
01_网站源码/                  ← Cloudflare 部署的只有 site/ 这一个目录
├── site/                     ← 要部署的静态站点
│   ├── index.html
│   ├── style.css
│   ├── app.js                ← 前端逻辑 + 合并引擎
│   ├── robots.txt
│   ├── sitemap.xml           ← 首页 + 46 个 App 页
│   ├── <app-id>/index.html   ← 46 个搜索落地页
│   └── data/modules.json     ← 模块数据（180 KB，46 款 App / 53 个来源）
├── worker/index.js           ← 分享短链 + SEO 绝对域名注入
├── wrangler.toml             ← Cloudflare 部署配置
├── _测试_合并逻辑.js          ← 合并引擎冒烟测试
└── README_部署指南.md         ← 本文件

上级项目根还有：
02_交付物料 / 03_整合包 / 04_营销物料 / 05_教程素材 /
06_许可与合规 / 07_规则原料库 / 99_生成脚本
```

---

## 二、本地预览

```bash
cd "F:/newbee苹果去广告网站/01_网站源码/site"
"C:/Users/1/.workbuddy/binaries/python/versions/3.13.12/python.exe" -m http.server 8787
```
浏览器打开 `http://127.0.0.1:8787`。

> 必须走 HTTP，不能直接双击 `index.html`——浏览器会拦截 `file://` 下的 `fetch`。

---

## 三、部署到 Cloudflare

### 方式 A：Wrangler CLI（推荐，可重复部署）

```bash
cd "F:/newbee苹果去广告网站/01_网站源码"
npx wrangler login          # 首次需要授权
npx wrangler deploy
```
部署完会输出一个 `*.workers.dev` 地址，先访问确认可用。

### 方式 B：Cloudflare Dashboard（不想装工具）

1. 打开 Cloudflare Dashboard → **Workers & Pages** → Create → **Pages** → Upload assets
2. 项目名随意，把 `site/` 目录里的**全部内容**拖进去（注意是内容，不是 `site` 文件夹本身）
3. 部署完成

> 方式 B 只能部署静态部分，**分享链接功能不可用**，而且不会自动把 SEO 中的 `{{SITE_ORIGIN}}` 替换成实际域名。正式上线优先使用方式 A；若必须静态上传，先把该占位符批量替换为最终站点域名。

---

## 四、启用分享链接（可选）

分享链接让用户拿到一条可直接粘贴进工具的地址，而不是下载文件。

```bash
# 1. 创建 KV 命名空间
npx wrangler kv namespace create LINKS
#    输出里会有一行 id = "xxxxxxxx"

# 2. 打开 wrangler.toml，取消注释并填入 id
#    [[kv_namespaces]]
#    binding = "LINKS"
#    id = "xxxxxxxx"

# 3. 重新部署
npx wrangler deploy
```

未配置 KV 时 Worker 自动降级，前端会隐藏「生成分享链接」按钮，其余功能不受影响。

- 分享链接有效期 **90 天**（可在 `worker/index.js` 改 `TTL`）
- 内容是**明文存在 KV 里**的，不要用它存任何敏感信息
- 免费额度：KV 每天 10 万次读 / 1000 次写，够用了

---

## 五、绑定自定义域名

正式域名已经绑定：**`https://s.tangping.icu/`**。

`wrangler.toml` 使用 Custom Domain 配置，后续运行 `npx wrangler deploy` 会继续维护该绑定：

```toml
[[routes]]
pattern = "s.tangping.icu"
custom_domain = true
```

**域名选择建议**：
- 用一个**独立子域或新域名**，不要和主业务（发卡站 / 机场面板）共用主域
- 一旦这个站被判定为关联或违规，共用主域会互相牵连
- 新域名一年几十块，换来的隔离是值得的

---

## 六、机场广告与引流入口

打开 `site/app.js`，最上面有几行配置：

```js
const CONFIG = {
  ctaUrl: 'https://www.11pa.dpdns.org/',    // 机场前端直达地址
  ctaText: '查看真三网节点',
  baseName: 'ios-clean',
  moduleName: 'iOS净化配置',
};
```

改完重新部署即可。

首页导航、首屏下方主横幅、页面后段 CTA 和页脚都直接指向同一机场前端。广告明确标注「推广」，不使用弹窗、遮罩或自动跳转。

---

## 七、数据更新

上游规则更新后，重新生成数据并部署：

```bash
cd "F:/newbee苹果去广告网站/99_生成脚本"
"C:/Users/1/.workbuddy/binaries/python/versions/3.13.12/python.exe" build_data.py
"C:/Users/1/.workbuddy/binaries/python/versions/3.13.12/python.exe" build_pages.py
"C:/Users/1/.workbuddy/binaries/python/versions/3.13.12/python.exe" validate_site.py
cd ../01_网站源码 && npx wrangler deploy
```

要增删 App，改 `99_生成脚本/build_data.py` 里的 `APPS` 列表（每行：id、中文名、分类、图标、来源列表）。
脚本内路径全部相对项目根，整个文件夹换位置也不用改。

---

## 八、验证清单

- [ ] 本地预览能打开、能勾选、能生成、能下载
- [ ] 生成的模块用文本编辑器打开，`#!name=` 开头、各段完整
- [ ] 导入真机测试一遍，确认开屏广告确实没了
- [ ] 部署后 `*.workers.dev` 地址可访问
- [x] 已绑定 `s.tangping.icu`，HTTPS 正常
- [x] `CONFIG.ctaUrl` 已改成机场前端直达地址
- [x] 46 个 App 落地页、sitemap、canonical 与结构化数据已生成
- [ ] 页脚的开源来源列表与实际数据一致

### 已完成的校验（2026-09-20）

**教学内容核对**：教程里的界面路径已对照两本社区手册
（[LOWERTOP/Shadowrocket](https://github.com/LOWERTOP/Shadowrocket)、[Varygod/Shadowrocket](https://github.com/Varygod/Shadowrocket)）逐条核实。
**原稿有误，已修正**：「HTTPS 解密」的正确入口是
**「配置」页 → 点当前配置文件的 ⓘ →「HTTPS 解密」→「证书」**，不是底部「设置」页。
模块导入路径「配置 → 模块 → 右上角 ➕」经核实无误。

**功能校验**：
- `app.js`、`worker/index.js` 通过 `node --check` 语法检查
- 合并引擎 Node 冒烟测试：全选 46 个 App → 481 条规则 / 148.9 KB / 552 个域名，无异常令牌、无成人域名
- 本地服务 `/`、`/style.css`、`/app.js`、`/data/modules.json`、`/robots.txt` 全部 200
- HTML 标签配对、id 唯一性、锚点有效性全部通过
- 46 个落地页均有唯一 title / description、自指 canonical、至少 4 条内链和预选参数
- Worker 会按当前访问域名注入 canonical、Open Graph URL、robots 与 sitemap 的绝对地址
- 首页、哔哩哔哩落地页和 `?pick=bilibili` 预选生成链路已在桌面与手机尺寸复测

**文案修正**：
- 合规模式覆盖数由「约 12 款」更正为 **14 款**（实测值）
- 删除「不存储用户数据」的不实表述，改为如实说明分享链接会临时存储 90 天
- 效果区原写「减少误触跳转」，与边界区「不承诺处理摇一摇跳转」自相矛盾，已删除该条
- 新增「说明与边界」区块，明确列出能处理与不承诺处理的范围

### 上线前还需要补的

| 项 | 说明 |
|---|---|
| 工具站独立域名 | 仍需在 Cloudflare 绑定；Worker 会自动把 SEO 地址换成该域名 |
| 搜索引擎提交 | 上线后把 `/sitemap.xml` 提交到百度、必应和 Google Search Console |
| 真机验收 | iPhone 上走完生成、下载、导入、证书信任和 HTTPS 解密全流程 |

---

## 九、几个容易踩的坑

| 问题 | 处理 |
|---|---|
| 本地打开白屏、控制台报 fetch 失败 | `file://` 用不了 fetch，必须起 HTTP 服务 |
| 部署后 404 | 确认 `wrangler.toml` 里 `assets.directory` 是 `./site` |
| 中文 App 名乱码 | 文件本身就是 UTF-8，别用记事本另存为 GBK |
| 分享链接点了没反应 | KV 没配。`/api/health` 返回 `share:false` 就是没配 |
| 生成的模块导入后没效果 | 正常，还需要装证书并信任（见站点上的安装教程） |
