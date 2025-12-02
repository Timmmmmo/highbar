# 在项目根目录运行此脚本以下载 ECharts 到同目录（用于 CDN 回退）
$uri = 'https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js'
$out = Join-Path -Path (Get-Location) -ChildPath 'echarts.min.js'
Write-Host "Downloading $uri to $out"
Invoke-WebRequest -Uri $uri -OutFile $out -UseBasicParsing
Write-Host "Done. Don't forget to git add and push the file if you want it on GitHub Pages."