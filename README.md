<div align="center">

# dsh-inapp-chat

**在 DeepSeek Harness 里，随手打开 DeepSeek 网页对话。**

边做项目，边查资料、解报错、确认方案，不再来回切换浏览器。

[![dsh plugin](https://img.shields.io/badge/dsh-plugin-4D6BFE)](https://github.com/Luminet-LT/dsh-inapp-chat)
[![version](https://img.shields.io/badge/version-0.1.2-4D6BFE)](https://github.com/Luminet-LT/dsh-inapp-chat)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

[功能](#功能) · [安装](#安装) · [使用](#使用) · [常见问题](#常见问题)

</div>

---

## 界面预览

### 侧边栏入口

<img src="docs/images/sidebar-entry.png" alt="侧边栏网页对话入口" width="360">

### 应用内网页对话

<img src="docs/images/in-app-chat-window.png" alt="应用内网页对话窗口" width="720">

## 为什么用它

做项目时，经常会有一些需要临时问 AI 的情况：

- 查一段 API、配置项或工具用法；
- 确认一个报错到底是什么意思；
- 比较几种实现方案；
- 问一个和当前任务关系不大的小问题。

如果每次都切到浏览器，工作流会被打断；如果把这些问答都塞进当前项目会话，又会占用大量上下文，消耗更多 token。

**dsh-inapp-chat** 在 DeepSeek Harness 侧边栏增加一个「网页对话」入口。点开后，DeepSeek 网页对话会直接出现在应用内窗口中，可以边工作边查、边问、边确认。

### 更适合这样的工作方式

- 查资料、解报错、问方案，在独立窗口完成；
- 不频繁切换应用，不打断当前项目；
- 网页对话有独立的会话和登录空间，不会自动带入项目文件和聊天历史；
- 只把真正有用的结论复制回项目会话，减少无关上下文和 token 消耗。

一句话：**临时问题在窗口里问，重要结论再带回项目。**

## 功能

- **应用内打开**：点击侧边栏「网页对话」，在应用内打开 DeepSeek 网页对话。
- **适合多任务**：做项目时随时查资料、排查问题和确认方案。
- **上下文更清爽**：网页对话独立运行，不会自动混入当前项目上下文。
- **节约 token**：短问题不必放进主会话，只把最终答案带回来。
- **随时隐藏入口**：可在「设置 → 通用」中关闭侧边栏入口。
- **登录状态独立**：首次在对话窗口中登录一次即可，之后继续使用。

## 安装

在 DeepSeek Harness 的插件管理中添加：

```bash
dsh plugin --profile desktop add git+https://github.com/Luminet-LT/dsh-inapp-chat.git
```

也可以从本地源码安装：

```bash
dsh plugin --profile desktop add link:<项目目录>
```

安装完成后，重启 DeepSeek Harness。

## 使用

1. 打开 DeepSeek Harness。
2. 在左侧边栏点击「网页对话」。
3. 第一次使用时，在打开的窗口中登录 DeepSeek。
4. 查资料、问问题或排查报错，完成后关闭窗口即可。

如果暂时不想看到入口，可以在「设置 → 通用」中关闭「网页对话入口」。

## 点击后仍然跳浏览器？

部分桌面版本需要先启用应用内窗口。仓库的 `tools` 目录提供了一键工具：

```text
tools\应用补丁并重启.cmd
```

工具会自动备份当前版本，并在处理失败时恢复。需要还原时运行：

```powershell
powershell -ExecutionPolicy Bypass -File tools\dsh-shell-patch.ps1 -Action restore -Restart
```

应用更新后如果入口再次跳转到浏览器，重新运行一次安装工具即可。

## 常见问题

### 它会读取我当前项目的内容吗？

不会自动读取，也不会把网页对话中的内容自动带回项目。你可以自行复制需要的信息。

### 为什么不直接在 Harness 当前会话里问？

当然可以。但临时查资料、解释报错和确认方案会产生大量无关上下文。放到独立窗口里问，再把结论带回来，主会话会更干净，也更省 token。

### 需要单独登录吗？

第一次使用时需要在网页对话窗口里登录一次。登录状态会保留，之后打开即可继续使用。

### 可以隐藏侧边栏入口吗？

可以。进入「设置 → 通用」，关闭「网页对话入口」即可。

## 开发与反馈

```bash
npm test
npm run check
```

遇到问题或有功能建议，欢迎提交 [Issue](https://github.com/Luminet-LT/dsh-inapp-chat/issues)。

## License

MIT © 2026 caoganghui（上游部分）、Luminet-LT（本项目改动）