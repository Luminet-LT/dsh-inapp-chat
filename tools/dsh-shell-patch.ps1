<#
  dsh-shell-patch.ps1 — 让 Electron 桌面壳支持「应用内网页对话窗口」

  为什么需要它：
    DeepSeek Harness 官方桌面壳（Electron）把外链一律交给系统浏览器
    （main.js 里的 shell.openExternal），也不注入任何应用内开窗接口。
    插件（dsh-inapp-chat）因此只能退回“在系统浏览器打开”。
    本脚本改的是**壳自己**的 main.js / main-preload.js（0.1.x）或
    lib/main.js / lib/preload-app.cjs（0.2.x）：
      · 点击 chat.deepseek.com 入口时在应用内开一个对话框形态的子窗口；
      · 通过 main-preload 暴露标准桥接 window.dsh.desktop.openWindow。

  动作（Action）：
    status   查看当前状态（是否已打补丁、有哪些备份）
    build    从**已安装的官方 app.asar**生成补丁包 app.patched.asar（不联网、无需下载）
    deploy   把 app.patched.asar 换进安装目录（要求应用已退出）
    install  = build + deploy（推荐；配合 -Restart 全自动）
    restore  还原最近一次备份（官方原版）

  用法（推荐直接双击同目录的「应用补丁并重启.cmd」）：
    powershell -ExecutionPolicy Bypass -File dsh-shell-patch.ps1 -Action install -Restart
    powershell -ExecutionPolicy Bypass -File dsh-shell-patch.ps1 -Action status
    powershell -ExecutionPolicy Bypass -File dsh-shell-patch.ps1 -Action restore -Restart

  注意：应用自动更新会把 app.asar 换回官方版本，更新后重新跑一次 install 即可。
#>
[CmdletBinding()]
param(
  [ValidateSet('status', 'build', 'deploy', 'install', 'restore')]
  [string]$Action = 'status',
  [string]$Install = 'D:\Program Files (x86)\dsh',
  [string]$Patched,
  [switch]$Restart
)

$ErrorActionPreference = 'Stop'

# $PSScriptRoot 在 param() 绑定阶段是空的（Windows PowerShell 5.1 用 -File 调用时
# 就是这个行为，双击 .cmd 会踩到），所以脚本目录放到参数绑定之后再解析。
$scriptDir = $PSScriptRoot
if (-not $scriptDir) {
  $cmdPath = $MyInvocation.MyCommand.Path
  if ($cmdPath) { $scriptDir = Split-Path -Parent $cmdPath }
}
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }
if (-not $Patched) { $Patched = Join-Path $scriptDir 'app.patched.asar' }

$asarTool = Join-Path $scriptDir 'asar_tool.cjs'
$res      = Join-Path $Install 'resources'
$target   = Join-Path $res 'app.asar'
$exe      = Join-Path $Install 'DeepSeek Harness.exe'
$markers  = @('dsh-inapp-chat shell patch', '应用内「网页对话」窗口')

function Get-Sha([string]$path) { (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash }

function Get-AppProcesses {
  Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -eq $exe }
}

function Test-Patched([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return $false }
  $text = [System.IO.File]::ReadAllText($path)
  foreach ($marker in $markers) {
    if ($text.Contains($marker)) { return $true }
  }
  return $false
}

function Stop-AppIfAsked {
  if (-not $Restart) { return }
  $running = Get-AppProcesses
  if ($running) {
    "正在退出 DeepSeek Harness（$($running.Count) 个进程）…"
    $running | Stop-Process -Force -ErrorAction SilentlyContinue
  }
  for ($i = 0; $i -lt 40 -and (Get-AppProcesses); $i++) { Start-Sleep -Milliseconds 500 }
}

function Assert-AppStopped {
  $left = Get-AppProcesses
  if ($left) {
    throw "DeepSeek Harness 仍在运行（$($left.Count) 个进程），app.asar 被占用。请先完全退出应用（托盘图标右键 → 退出），或加 -Restart 让脚本自动处理。"
  }
}

function Show-Status {
  "安装目录 : $Install"
  $running = Get-AppProcesses
  "运行状态 : $(if ($running) { "正在运行（$($running.Count) 个进程）" } else { '未运行' })"
  if (Test-Path -LiteralPath $target) {
    "app.asar : $((Get-Item -LiteralPath $target).Length) 字节  补丁 = $(if (Test-Patched $target) { '已应用' } else { '未应用（官方原版）' })"
  } else {
    "app.asar : 不存在（$target）"
  }
  if (Test-Path -LiteralPath $Patched) {
    "补丁包   : $((Get-Item -LiteralPath $Patched).Length) 字节  $Patched"
  } else {
    "补丁包   : 尚未生成（跑 -Action build 或 -Action install）"
  }
  $backups = Get-ChildItem -LiteralPath $res -Filter 'app.asar.*' -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'app.asar.bak-*' -or $_.Name -like 'app.asar.official-*' } |
    Sort-Object LastWriteTime -Descending
  if ($backups) {
    "备份     :"
    $backups | Select-Object -First 5 | ForEach-Object { $kind = if (Test-Patched $_.FullName) { '补丁' } else { '官方' }; "           $($_.Name)  $($_.Length) 字节  $kind  $($_.LastWriteTime)" }
  } else {
    "备份     : 无"
  }
}

function Build-Patch {
  if (-not (Test-Path -LiteralPath $asarTool)) { throw "找不到 asar_tool.cjs：$asarTool" }
  if (-not (Test-Path -LiteralPath $target))   { throw "找不到 app.asar：$target" }
  if (Test-Patched $target) {
    throw "当前 app.asar 已经是打过补丁的版本，无法作为构建源。请先 -Action restore，或直接 -Action deploy 复用已有补丁包。"
  }
  $node = (Get-Command node -ErrorAction SilentlyContinue).Source
  if (-not $node) { throw 'PATH 里找不到 node（打补丁需要它读取 app.asar）' }

  # 0.2.x 使用 lib/main.js + lib/preload-app.cjs；0.1.x 使用 main.js + main-preload.js。
  $layout = (& $node $asarTool list $target 2>&1 | Out-String)
  if ($LASTEXITCODE -ne 0) { throw '无法读取 app.asar 文件列表' }
  $modern = ($layout -match '(?m)^lib/main\.js\s') -and ($layout -match '(?m)^lib/preload-app\.cjs\s')
  if ($modern) {
    $modernTool = Join-Path $scriptDir 'build-asar.cjs'
    if (-not (Test-Path -LiteralPath $modernTool)) { throw "0.2.x 补丁工具缺失：$modernTool" }
    & $node $modernTool patch $target $Patched
  } else {
    & $node $asarTool patch $target $Patched
  }
  if ($LASTEXITCODE -ne 0) { throw '补丁构建工具执行失败' }
  if (-not (Test-Path -LiteralPath $Patched)) { throw '补丁包生成失败' }
  if (-not (Test-Patched $Patched)) { throw '生成的补丁包不含预期改动，已中止' }
  $layoutName = if ($modern) { '0.2.x' } else { '0.1.x' }
  "补丁包已生成：$Patched（$((Get-Item -LiteralPath $Patched).Length) 字节，$layoutName 布局）"
}

function Swap-In([string]$sourcePath, [string]$what) {
  if (-not (Test-Path -LiteralPath $target)) { throw "找不到 app.asar：$target" }
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
  $staged = Join-Path $res ("app.asar.staged-$stamp")
  $backup = Join-Path $res ("app.asar.bak-$stamp")
  $replaceBackup = Join-Path $res ("app.asar.preinstall-$stamp")
  $sourceSha = Get-Sha $sourcePath

  Copy-Item -LiteralPath $sourcePath -Destination $staged -Force
  if ((Get-Sha $staged) -ne $sourceSha) {
    throw '暂存副本校验失败，已中止（原文件未改动）'
  }
  "  1/3 已暂存 $what（$((Get-Item -LiteralPath $staged).Length) 字节）"

  Copy-Item -LiteralPath $target -Destination $backup -Force
  $backupSha = Get-Sha $backup
  if ($backupSha -ne (Get-Sha $target)) {
    throw '备份校验失败，已中止（原文件未改动）'
  }
  "  2/3 当前版本已安全备份为 $(Split-Path $backup -Leaf)"

  try {
    [System.IO.File]::Replace($target, $staged, $replaceBackup)
  } catch {
    if (-not (Test-Path -LiteralPath $target) -or (Get-Sha $target) -ne $backupSha) {
      Copy-Item -LiteralPath $backup -Destination $target -Force
    }
    throw "就位失败，已回滚：$($_.Exception.Message)"
  }

  if ((Get-Sha $target) -ne $sourceSha) {
    Copy-Item -LiteralPath $backup -Destination $target -Force
    throw '落盘校验失败，已恢复操作前版本'
  }
  "  3/3 已就位：$target"
}

function Restart-App {
  if ($Restart -and (Test-Path -LiteralPath $exe)) {
    Start-Sleep -Seconds 1
    Start-Process -FilePath $exe
    "已重新启动 DeepSeek Harness。"
  } elseif (-not $Restart) {
    "记得重新打开 DeepSeek Harness 让补丁生效。"
  }
}

$mutex = [Threading.Mutex]::new($false, 'Local\dsh-inapp-chat-shell-patch')
$locked = $false
try {
  $locked = $mutex.WaitOne(0, $false)
  if (-not $locked) { throw '另一个补丁/还原操作正在运行，请稍后再试' }
switch ($Action) {
  'status' { Show-Status; break }

  'build' { Build-Patch; break }

  'deploy' {
    if (-not (Test-Path -LiteralPath $Patched)) { throw "找不到补丁包：$Patched（先跑 -Action build 或 -Action install）" }
    if (-not (Test-Patched $Patched)) { throw "补丁包不含预期改动（$($markers -join ' / ')），拒绝写入" }
    if (Test-Patched $target) { "app.asar 已经是打过补丁的版本，无需重复操作。"; break }
    Stop-AppIfAsked
    Assert-AppStopped
    Swap-In $Patched '补丁'
    ""
    Show-Status
    ""
    "完成。启动应用后，点侧边栏「网页对话」会在应用内弹出对话框窗口。"
    Restart-App
  }

  'install' {
    Stop-AppIfAsked
    Assert-AppStopped
    if (Test-Patched $target) {
      "app.asar 已经是打过补丁的版本，无需重复操作。"
      Show-Status
      Restart-App
      break
    }
    Build-Patch
    Swap-In $Patched '补丁'
    ""
    Show-Status
    ""
    "完成。启动应用后，点侧边栏「网页对话」会在应用内弹出对话框窗口。"
    Restart-App
  }

  'restore' {
    $backup = Get-ChildItem -LiteralPath $res -Filter 'app.asar.*' -ErrorAction SilentlyContinue |
      Where-Object { ($_.Name -like 'app.asar.bak-*' -or $_.Name -like 'app.asar.official-*') -and -not (Test-Patched $_.FullName) } |
      Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $backup) { throw '没有找到未打补丁的官方备份，无法安全还原' }
    Stop-AppIfAsked
    Assert-AppStopped
    Swap-In $backup.FullName "备份 $($backup.Name)"
    ""
    Show-Status
    Restart-App
  }
}
} finally {
  if ($locked) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}
