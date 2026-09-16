# 发布手册（GitHub / npm / 插件市场）

## 0. 当前状态（2026-09-17 实测）

| 事项 | 状态 |
| --- | --- |
| 本地仓库 | 已初始化并提交（分支 `main`），工作树干净 |
| GitHub 可达性 | ❌ `github.com` 被 DNS 解析到 `127.0.0.1`，`api.github.com`、`raw.githubusercontent.com` 全部不可达 → **推送需在能访问 GitHub 的网络/代理下进行** |
| GitHub 凭据 | 无 `gh` CLI、无 `~/.ssh`、无 `GITHUB_TOKEN` → 需要你的 PAT 或 SSH key |
| npm registry | ✅ `registry.npmjs.org` 可达；`~/.npmrc` 里**没有**登录凭据 → 需先 `npm login` 或配 `NPM_TOKEN` |
| 插件市场 | 市场实时读取 `https://awesome-dsh-plugin.com/plugins.json`（由 `awesome-dsh-plugin/awesome-dsh-plugin` 仓库 CI 每日刷新，当前 3727 条） |

## 1. 推送到 GitHub

先在 GitHub 上建一个**空仓库**（不要勾选 README/gitignore），然后：

```bash
cd dsh-inapp-chat

# 推送前自检：不应返回 127.0.0.1
#   powershell: Resolve-DnsName github.com
#   bash:       getent hosts github.com

git remote add origin https://github.com/Luminet-LT/dsh-inapp-chat.git
git push -u origin main
```

用 SSH 的话把 URL 换成 `git@github.com:Luminet-LT/dsh-inapp-chat.git`。

**想改仓库名/作者**：改 `package.json` 里的 `repository.url`、`homepage`、`bugs.url` 三处，
以及 README 里的 URL 即可（本仓库按 `Luminet-LT` 预填）。

凭据两种方式：

```bash
# A. HTTPS + PAT（推荐，令牌存到凭据管理器）
git config --global credential.helper manager
# 首次 push 时用户名填 GitHub 用户名，密码填 PAT

# B. SSH
ssh-keygen -t ed25519 -C "2053703304@qq.com"
# 把 ~/.ssh/id_ed25519.pub 加到 GitHub → Settings → SSH keys
```

## 1.5 网络：GitHub 连不上时（中国大陆常见）

**症状**：`Resolve-DnsName github.com` 返回 `127.0.0.1`，`git push` 直接超时或报无法连接 ——
但**网络链路其实是通的**，只有本地 DNS 被污染。

**先确诊**（三行就够）：

```powershell
Resolve-DnsName github.com -Type A                      # 127.0.0.1 => DNS 被污染
Test-NetConnection 20.205.243.166 -Port 443             # True => 链路通，只是名字解析错了
# 用 DoH 查真实 IP（本地解析器不可信时）
node -e "fetch('https://dns.alidns.com/resolve?name=github.com&type=A',{headers:{accept:'application/dns-json'}}).then(r=>r.json()).then(j=>console.log(j.Answer))"
```

**方案 A（推荐，长期）：走代理**

```bash
git config --global http.proxy http://127.0.0.1:7890   # 换成你的代理端口
git config --global --unset http.proxy                  # 取消
```

**方案 B：补 hosts（本机可逆）**
2026-09-17 实测可用的 IP：`github.com 20.205.243.166`、`api.github.com 20.205.243.168`、
`raw.githubusercontent.com 185.199.108.133`。写入 `C:\Windows\System32\drivers\etc\hosts`
需要管理员；用完删掉那几行即可还原。注意 GitHub 的 IP 会变。

**推送前自检**（不鉴权也能看出端点是否正常）：

```powershell
# 期望 200（网站）与 401 "Repository not found."（仓库还没建，端点本身是好的）
node -e "const h=require('https');const g=(p)=>new Promise(r=>h.request({host:'20.205.243.166',servername:'github.com',path:p,headers:{Host:'github.com'}},s=>{r(s.statusCode);s.resume()}).end());(async()=>{console.log(await g('/'));console.log(await g('/Luminet-LT/dsh-inapp-chat.git/info/refs?service=git-receive-pack'))})()"
```

**凭据**：HTTPS 推送时用户名填 GitHub 用户名，密码填 **PAT**（classic 勾 `repo`，或 fine-grained 给该仓库
Contents: Read and write）。开启凭据缓存：

```bash
git config --global credential.helper manager
```

## 2. 发布到 npm

```bash
npm login                       # 或 export NPM_TOKEN=... 并在 .npmrc 写 //registry.npmjs.org/:_authToken=${NPM_TOKEN}
npm pack --dry-run              # 先看清单，应只含 lib/、cordis.patch.yml、README*、CHANGELOG、LICENSE、NOTICE
npm publish --access public
npm view dsh-inapp-chat version # 验证
```

包名 `dsh-inapp-chat` 在 npm 上**未被占用**（已实测 404）。
`package.json` 里的 `files`、`dsh.client.platform`、`dsh.bundle.patch`、`keywords` 都已填好。

## 3. 上架插件市场

市场只允许安装精选列表内的来源，收录方式是在
**https://github.com/awesome-dsh-plugin/awesome-dsh-plugin** 提一个 PR，按该仓库的
CONTRIBUTING / 列表文件格式**加一条**（字段与 `plugins.json` 一致）。可直接粘贴的内容见
[market-entry.md](market-entry.md)。

CI 每日刷新，站点与市场通常**一天内**生效；`npm`、`version`、`stars`、`downloads` 由 CI 自动抓取。

## 4. 截图（可选，但推荐）

市场是 App Store 式截图展示，且**图片只从 GitHub 图床加载**。做法：

1. 截图放进 `docs/screenshots/`（建议 1200×800，PNG）；
2. 在 `README.md` 里用 `https://raw.githubusercontent.com/<owner>/<repo>/main/docs/screenshots/xxx.png` 引用；
3. 推上去后，市场在打开安装弹窗时会自动从 README 抽取；列表若要策展截图，在列表条目里加图床 URL。

建议三张：① 侧边栏入口（展开态）② 应用内对话框窗口（聊天界面）③ 没有桥接时的说明对话框。

> 注意：截图里不要出现你的真实对话内容、账号、token。

## 5. 后续更新流程

```bash
# 1. 改代码/文档
node --check lib/client.js && node --check lib/index.js
# 2. 升版本（package.json / CHANGELOG.md）
npm version patch            # 或 minor/major，会自动打 tag
git push && git push --tags
npm publish
```

## 6. 发布前自检清单

- [ ] `node --check lib/client.js`、`node --check lib/index.js` 通过
- [ ] `npm pack --dry-run` 清单符合预期（无 `tools/app.patched.asar`、无 `.git`）
- [ ] README 首屏有「一句话说明 + 安装命令 + 它解决什么问题」
- [ ] `LICENSE` / `NOTICE` 保留上游署名（MIT 要求）
- [ ] `tools/README.md` 说明了补丁的**可逆性**与「应用更新后需重打」
- [ ] 没有把个人路径、token、截图里的隐私内容提交进去
- [ ] 未提交 `tools/app.patched.asar`（已在 `.gitignore`，应由用户本机生成）

## 7. 已知限制（写进 issue 模板/回复里，避免重复问答）

- chat.deepseek.com 返回 `frame-ancestors 'none'`，**任何插件**都无法把网页作为 iframe 嵌进 harness 页面，只能开窗口；
- 官方 Electron 壳不注入 `window.dsh.desktop`，需要 `tools/` 里的补丁；
- 壳自动更新会覆盖补丁，更新后重跑 `tools/应用补丁并重启.cmd`。
