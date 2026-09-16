<#
  把 dsh-inapp-chat 推到 GitHub（含 DNS 与远端状态自检）

  用法：
    # 先看一眼（不改任何东西）
    powershell -ExecutionPolicy Bypass -File .\推送到GitHub.ps1 -Action check

    # DNS 被污染时先修（弹 UAC 写 hosts），然后推送
    powershell -ExecutionPolicy Bypass -File .\推送到GitHub.ps1 -Action push -FixDns

    # DNS 已经正常（走代理/VPN 时）直接推
    powershell -ExecutionPolicy Bypass -File .\推送到GitHub.ps1 -Action push

  推送时会提示登录：用户名填 GitHub 用户名，密码填 PAT（classic 勾 repo，
  或 fine-grained 给该仓库 Contents: Read and write）。
#>
[CmdletBinding()]
param(
  [ValidateSet('check', 'push')]
  [string]$Action = 'check',
  [switch]$FixDns
)

$ErrorActionPreference = 'Stop'
$repo = $PSScriptRoot
$expectedRemote = 'https://github.com/Luminet-LT/dsh-inapp-chat.git'
$expectedRepoPath = '/Luminet-LT/dsh-inapp-chat.git/info/refs?service=git-upload-pack'
$ghIp = '20.205.243.166'
$dnsFix = Join-Path (Split-Path -Parent $repo) '修复github-dns.ps1'

function Test-DnsOk {
  try {
    $ip = (Resolve-DnsName github.com -Type A -ErrorAction Stop | Where-Object { $_.IPAddress } | Select-Object -First 1 -ExpandProperty IPAddress)
  } catch { return @{ ok = $false; ip = '解析失败' } }
  return @{ ok = ($ip -notmatch '^127\.'); ip = $ip }
}

function Get-RemoteRefs {
  $js = @"
const https=require('node:https');
const req=https.request({host:'$ghIp',servername:'github.com',port:443,path:'$expectedRepoPath',headers:{Host:'github.com','User-Agent':'git/2.51.0'},timeout:10000},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{const b=Buffer.concat(c).toString('latin1');const refs=b.split('\n').filter(l=>l.includes('refs/'));console.log(JSON.stringify({status:res.statusCode,refs:refs.map(r=>r.replace(/\u0000.*$/,'').trim())}));});});
req.on('timeout',()=>{req.destroy();console.log(JSON.stringify({status:'TIMEOUT',refs:[]}));});
req.on('error',e=>console.log(JSON.stringify({status:'ERR '+e.code,refs:[]})));
req.end();
"@
  $out = $js | node -
  return ($out | ConvertFrom-Json)
}

function Invoke-Check {
  "仓库目录 : $repo"
  $dns = Test-DnsOk
  "DNS       : github.com -> $($dns.ip) $(if ($dns.ok) { '(可用)' } else { '(被污染，需要 -FixDns 或开代理)' })"

  "remote    : $(git -C $repo remote get-url origin 2>$null)"
  $url = (git -C $repo remote get-url origin 2>$null)
  if ($url -ne $expectedRemote) { "⚠ remote 与预期不一致，将自动改为 $expectedRemote" }

  $branch = (git -C $repo rev-parse --abbrev-ref HEAD 2>$null)
  "分支      : $branch"
  "本地提交  : $((git -C $repo rev-list --count HEAD 2>$null)) 个，工作树改动 $((git -C $repo status --porcelain 2>$null | Measure-Object).Count) 个"

  try {
    $r = Get-RemoteRefs
    if ($r.status -ne 200) { "远端      : 状态 $($r.status)（仓库可能不存在或不可读）" }
    elseif (-not $r.refs -or $r.refs.Count -eq 0) { "远端      : 空仓库，可直接 push ✓" }
    else { "远端      : 已有 $($r.refs.Count) 个 ref（推送前先 pull --rebase 或改用 --force）"; $r.refs | ForEach-Object { "            $_" } }
  } catch {
    "远端      : 自检失败（$($_.Exception.Message)）——多半是 DNS 还没修"
  }
}

Invoke-Check
if ($Action -eq 'check') { ""; "以上只是自检，没有改动任何东西。"; exit 0 }

$dns = Test-DnsOk
if (-not $dns.ok) {
  if ($FixDns) {
    if (-not (Test-Path $dnsFix)) { throw "找不到 $dnsFix，请手动修 DNS 或开启代理" }
    "DNS 被污染，调用 $dnsFix -Action add（会弹 UAC）…"
    & $dnsFix -Action add
    Start-Sleep -Seconds 2
    $dns = Test-DnsOk
    if (-not $dns.ok) { throw "hosts 修完后 github.com 仍解析为 $($dns.ip)。可能被安全软件/浏览器 DoH 覆盖，请改用代理：git config --global http.proxy http://127.0.0.1:<端口>" }
  } else {
    throw "github.com 解析为 $($dns.ip)（DNS 被污染）。加 -FixDns 自动修，或先开代理/ VPN。"
  }
}

if ((git -C $repo remote get-url origin 2>$null) -ne $expectedRemote) {
  git -C $repo remote set-url origin $expectedRemote
  "remote 已更正为 $expectedRemote"
}

"开始推送（提示登录时：用户名=GitHub 用户名，密码=PAT）…"
git -C $repo push -u origin HEAD
if ($LASTEXITCODE -eq 0) {
  ""
  "✓ 推送完成：https://github.com/Luminet-LT/dsh-inapp-chat"
  "下一步：npm publish --access public（在 $repo 目录下，需先 npm login）"
} else {
  ""
  "✗ 推送失败（退出码 $LASTEXITCODE）。常见原因：PAT 无效/权限不足、远端已有内容需要先 rebase。"
}
