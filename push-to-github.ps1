<#
自动将当前仓库推送到远程 GitHub 的脚本。
用法：在项目根目录运行（会提示输入远程仓库 URL 和提交信息）：
PS> .\scripts\push-to-github.ps1

脚本功能：
- 如果仓库未初始化则运行 `git init` 并创建 `main` 分支
- 设置远程 `origin`（若已存在则提示是否覆盖）
- 添加所有文件、提交并推送到远程 `main` 分支
- 可选择性地下载 ECharts（可选步骤）

注意：请确保本机已安装 Git 并已配置好账号凭证（或使用 HTTPS 并在提示时输入用户名/密码或使用 PAT）。
#>

function Ensure-GitInstalled {
    if(-not (Get-Command git -ErrorAction SilentlyContinue)){
        Write-Error "Git 未安装或未在 PATH 中。请安装 Git 后重试。 https://git-scm.com/"
        exit 1
    }
}

Ensure-GitInstalled

$repoRoot = Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Definition) "..")
Set-Location $repoRoot
Write-Host "当前仓库根目录： $repoRoot"

# 初始化仓库（如未初始化）
if(-not (Test-Path (Join-Path $repoRoot '.git'))){
    Write-Host "未检测到 .git，正在初始化仓库..."
    git init
    git branch -M main
} else {
    Write-Host ".git 已存在，跳过 git init。"
}

# 远程设置
$existing = git remote get-url origin 2>$null
if($LASTEXITCODE -eq 0 -and $existing){
    Write-Host "检测到远程 origin： $existing"
    $useExisting = Read-Host "是否使用已存在的远程 origin？(Y/n)"
    if($useExisting -and $useExisting -ne 'n'){
        $remoteUrl = $existing
    } else {
        $remoteUrl = Read-Host "请输入要添加的远程仓库 URL（例如 https://github.com/你的用户名/仓库.git）"
        git remote remove origin 2>$null
        git remote add origin $remoteUrl
    }
}else{
    $remoteUrl = Read-Host "请输入要添加的远程仓库 URL（例如 https://github.com/你的用户名/仓库.git）"
    git remote add origin $remoteUrl
}

# 可选：下载 echarts
$dl = Read-Host "是否现在下载 echarts.min.js 到仓库以做 CDN 回退？(Y/n)"
if(-not $dl -or $dl -ne 'n'){
    Write-Host "尝试下载 echarts.min.js..."
    try{
        Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js" -OutFile "echarts.min.js" -UseBasicParsing -ErrorAction Stop
        Write-Host "下载完成： echarts.min.js"
    }catch{
        Write-Warning "echarts 下载失败： $($_.Exception.Message)"
    }
}

# 提交并推送
$commitMsg = Read-Host "请输入本次提交信息（默认：prepare for github pages + worker proxy + actions）"
if(-not $commitMsg){ $commitMsg = 'prepare for github pages + worker proxy + actions' }

git add .
# 检查是否有变更需要提交
$changes = git status --porcelain
if($changes){
    git commit -m "$commitMsg"
} else {
    Write-Host "无变化需要提交。"
}

Write-Host "正在推送到远程 origin main..."
try{
    git push -u origin main
    Write-Host "推送完成。"
}catch{
    Write-Warning "推送失败： $($_.Exception.Message)"
    Write-Host "如果是首次推送，请确保远程仓库已存在或你有权限创建。"
}
