
<#
validate-local.ps1 (ASCII-only)
Checks for echarts.min.js, tries candidate data URLs, prints preview, opens index.html
Usage: run from project root:  .\scripts\validate-local.ps1
#>

try {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
    $repoRoot = Resolve-Path (Join-Path $scriptDir '..')
    Write-Host "Repo root: $repoRoot"

    $lic = Read-Host "Enter licence (may be empty if Worker secret used)"
    $proxy = Read-Host "Enter proxy/data URL (may be empty)"
    if ($lic -eq $null) { $lic = '' }
    if ($proxy -eq $null) { $proxy = '' }

    $echartsPath = Join-Path $repoRoot 'echarts.min.js'
    if (Test-Path $echartsPath) {
        Write-Host "Found echarts.min.js: $echartsPath"
    } else {
        Write-Warning "echarts.min.js not found. Consider running .\scripts\download-echarts.ps1 to download a local copy."
    }

    $today = (Get-Date).ToString('yyyy-MM-dd')
    Write-Host "Test date: $today"

    $candidates = @()
    if (-not [string]::IsNullOrWhiteSpace($proxy)) {
        if ($proxy -match '\{date\}' -and $proxy -match '\{lic\}') {
            $u = $proxy -replace '\{date\}', $today -replace '\{lic\}', $lic
            $candidates += $u
        } else {
            if ($proxy.Contains('?')) { $sep = '&' } else { $sep = '?' }
            $u = $proxy + $sep + 'd=' + $today + '&lic=' + $lic
            $candidates += $u
        }
    } else {
        $candidates += 'https://ahighbar2.hjzhao86.workers.dev?d=' + $today + '&lic=' + $lic
        $candidates += 'https://api.biyingapi.com/hslt/ztgc/' + $today + '/' + $lic
    }

    Write-Host "Will try these URLs in order:"
    foreach ($c in $candidates) { Write-Host " - $c" }

    $success = $false
    foreach ($url in $candidates) {
        Write-Host "`nTrying: $url"
        try {
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
            if ($null -ne $r.StatusCode) {
                Write-Host "HTTP status: $($r.StatusCode)"
            } else {
                Write-Host "HTTP response received"
            }
            $body = $r.Content
            if ($null -eq $body -and $r.RawContent) { $body = $r.RawContent }
            if ([string]::IsNullOrEmpty($body)) {
                Write-Warning "Empty response"
            } else {
                $len = 0
                try { $len = $body.Length } catch { $len = 0 }
                if ($len -gt 1000) {
                    Write-Host "Response length: $len bytes; preview (first 800 chars):"
                    try { Write-Host $body.Substring(0, [Math]::Min(800, $len)) } catch { Write-Host $body }
                } else {
                    Write-Host "Response body:"
                    Write-Host $body
                }
            }
            $success = $true
            break
        } catch {
            # Print full exception for debugging
            $ex = $_.Exception
            if ($ex -ne $null) {
                Write-Warning "Request failed: $($ex.GetType().FullName) - $($ex.Message)"
                Write-Host $ex.ToString()
            } else {
                Write-Warning "Request failed: unknown error"
            }
        }
    }

    if (-not $success) {
        Write-Warning "All candidate URLs failed. Check network, licence or proxy settings."
    }

    $localIndex = Join-Path $repoRoot 'index.html'
    if (Test-Path $localIndex) {
        Write-Host "Opening local page: $localIndex"
        try {
            Start-Process $localIndex
        } catch {
            Write-Warning "Failed to open local page directly: $($_.Exception.Message)"
            try {
                # Fallback: use cmd start to open in default browser
                Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'start', '""', $localIndex
            } catch {
                Write-Warning "Fallback open also failed: $($_.Exception.Message)"
            }
        }
    } else {
        Write-Warning "index.html not found in repo root."
    }

    Write-Host "Done. Check browser console (F12) for further errors (CORS, scripts)."
} catch {
    Write-Error "Script error: $($_.Exception.Message)"
    exit 1
}