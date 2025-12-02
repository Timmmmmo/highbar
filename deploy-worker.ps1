<#
辅助部署 Cloudflare Worker 的 PowerShell 脚本（帮助你执行常用 wrangler 操作）
用法：在 `cloudflare-worker` 目录运行脚本或从项目根目录运行，脚本会引导你完成下列步骤：
 - 检查 wrangler 是否安装
 - 登录 wrangler（如果未登录，会提示）
 - 可选择性设置 account_id 到 wrangler.toml（交互式提示）
 - 创建 Worker secret `BIYING_LIC`（可选）
 - 执行 `wrangler publish` 发布 Worker

注意：脚本假定你已经在本地安装 Node.js 与 npm，并且已全局安装 wrangler（或愿意按提示安装）。
#>

function Ensure-CommandExists($name, $installHint){
    if(-not (Get-Command $name -ErrorAction SilentlyContinue)){
        Write-Warning "$name 未安装或未在 PATH 中。$installHint"
        $ok = Read-Host "是否现在尝试安装 $name ? (Y/n)"
        if(-not $ok -or $ok -eq 'n'){
            Write-Error "$name 未安装，脚本无法继续。"
            exit 1
        }
        if($name -eq 'wrangler'){
            npm install -g wrangler
        }
    }
}

Ensure-CommandExists -name 'wrangler' -installHint '请参考 https://developers.cloudflare.com/workers/cli-wrangler/ 进行安装'

$cwd = Get-Location
$workerDir = Join-Path $cwd 'cloudflare-worker'
if(-not (Test-Path $workerDir)){
    Write-Warning "未找到 cloudflare-worker 目录： $workerDir 。请先确认文件存在。"
    exit 1
}

Set-Location $workerDir
Write-Host "当前目录： $(Get-Location)"

# 读取 wrangler.toml 并提示填写 account_id
$toml = Join-Path $workerDir 'wrangler.toml'
if(Test-Path $toml){
    Write-Host "检测到 wrangler.toml。请确认其中的 name 与 account_id 是否正确。"
    $content = Get-Content $toml -Raw
    Write-Host $content
    $fill = Read-Host "是否需要交互式填写 account_id 或 name？(Y/n)"
    if(-not $fill -or $fill -ne 'n'){
        $acc = Read-Host "请输入 Cloudflare account_id（留空跳过）"
        if($acc){
            (Get-Content $toml) -replace 'account_id\s*=\s*".*"','account_id = "'+$acc+'"' | Set-Content $toml
            Write-Host "已更新 wrangler.toml 的 account_id。"
        }
    }
} else {
    Write-Warning "wrangler.toml 未找到，请先编辑 cloudflare-worker/wrangler.toml 后再运行此脚本。"
}

# 可选：写入 secret
$setSecret = Read-Host "是否需要把 licence 写入 Worker Secret (BIYING_LIC)？(Y/n)"
if(-not $setSecret -or $setSecret -ne 'n'){
    $lic = Read-Host "请输入 licence（将作为 Worker Secret 存储）"
    if($lic){
        Write-Host "正在设置 secret BIYING_LIC..."
        # wrangler secret put 会要求交互输入 secret 内容
        wrangler secret put BIYING_LIC
    }
}

# 发布 Worker
$pub = Read-Host "准备发布 Worker 吗？(Y/n)"
if(-not $pub -or $pub -ne 'n'){
    Write-Host "运行: wrangler publish"
    wrangler publish
    Write-Host "发布完成。请记录返回的 Worker URL 并填入页面的代理输入框。"
} else {
    Write-Host "已跳过发布。你可以在 cloudflare-worker 目录运行 'wrangler publish' 手动发布。"
}

Set-Location $cwd
Write-Host "返回项目根目录: $cwd"
