# This-is-a-a-highBar

这是一个 A 股“高标连线（最高连板）”可视化页面，基于必盈 API 获取涨停股池并绘制历史最高连板曲线。

本仓库已做的修改：
- 支持配置 `代理/数据 URL`（页面输入 `proxyUrl`）用于解决 CORS 问题。
- 动态加载 ECharts（优先 CDN，失败回退到仓库内的 `echarts.min.js`）。
- 提供 Cloudflare Worker 示例作为跨域代理（`cloudflare-worker/worker.js`）。
- 提供 GitHub Actions workflow 示例，用于定时抓取并将数据写入 `data/`（`.github/workflows/fetch-data.yml`）。
- 提供 PowerShell 下载脚本 `scripts/download-echarts.ps1` 用于抓取 ECharts 到仓库。

## 快速部署（推荐：GitHub Pages + Cloudflare Worker 代理）

1) 将本仓库推到 GitHub：

```powershell
cd 'c:\Users\oo\Downloads\This-is-a-a-highBar-main\This-is-a-a-highBar-main'
git init
git add .
git commit -m "initial commit - highbar"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

2) 配置 GitHub Pages：
	- 在仓库 Settings -> Pages 中把 Branch 选 `main`，Folder 选 `/(root)`。
	- `index.html` 已在仓库根目录；页面将通过 `https://<你的用户名>.github.io/<仓库名>/` 访问。

3) 下载 ECharts 本地文件以作为 CDN 回退（推荐）：

```powershell
# 在项目根目录运行
.\scripts\download-echarts.ps1
git add echarts.min.js
git commit -m "add local echarts for CDN fallback"
git push
```

4) 部署 Cloudflare Worker（推荐）
	- 在 Cloudflare 仪表盘中新建 Worker，把 `cloudflare-worker/worker.js` 的内容粘贴进去并保存。
	- 如需保密 licence（不在前端公开），使用 `wrangler` 设置 secret：

```bash
# 安装 wrangler 并登录
npm install -g wrangler
wrangler login
wrangler secret put BIYING_LIC
```

	- 部署 Worker 并拿到 Worker URL，例如 `https://your-worker.workers.dev`，把该 URL 填入页面中的 `代理/数据 URL`。

5) GitHub Actions（可选替代方案）
	- 将你的 licence 作为仓库 Secret `BIYING_LIC`（Settings -> Secrets）保存。
	- `.github/workflows/fetch-data.yml` 会每 15 分钟运行一次并把当天数据保存到 `data/YYYY-MM-DD.json`。
	- 前端可以在没有代理的情况下直接读取 `data/` 下的静态 JSON（同源），从而避免 CORS。

## 安全与注意事项
- 如果 licence 是付费或敏感凭证，请勿在前端暴露，使用 Worker Secret 或 Actions Secret 来保护它。
- 浏览器的“Tracking Prevention”可能会阻止第三方 CDN 脚本访问存储，建议将 `echarts.min.js` 放到仓库并通过 GitHub Pages 提供本地副本以避免问题。

## 我可以继续帮你做的事
- 我可以帮你一步步部署 Cloudflare Worker（包含 `wrangler` 命令、如何设置 secret），并测试代理是否工作；
- 我可以把仓库调整为更适合 Pages 的结构（例如把 `highbar.html` 重命名为 `index.html` ——已完成）；
- 我可以修改前端让它默认使用内置 Worker URL（如果你同意把 Worker 部署到公开地址）；
- 我可以帮助把 GitHub Actions 的抓取频率或保存策略调整为你需要的方式。

如果你希望我继续自动化部署（例如：生成 `git` 命令脚本，或帮你准备 `wrangler` 部署步骤），告诉我你偏好的部署目标（Cloudflare Worker / 仅 GitHub Actions / 两者都需要）。
