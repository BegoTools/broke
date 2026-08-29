$src = (Resolve-Path build).Path
$ext = "C:\vsd-build-tmp"
if (Test-Path $ext) { Remove-Item -Recurse -Force $ext }
Copy-Item -Recurse $src $ext
$udd = Join-Path $env:TEMP "vsd-chrome-key"
if (Test-Path $udd) { Remove-Item -Recurse -Force $udd }
New-Item -ItemType Directory -Force -Path $udd | Out-Null
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$args = @("--headless=new","--no-sandbox","--disable-gpu","--user-data-dir=$udd","--load-extension=$ext","--remote-debugging-port=9333")
$proc = Start-Process -FilePath $chrome -ArgumentList $args -PassThru -RedirectStandardError "$udd\err.log" -RedirectStandardOutput "$udd\out.log"
Start-Sleep -Seconds 5
# Use DevTools protocol to open the extension's service worker and run storage.set
$list = Invoke-RestMethod -Uri "http://127.0.0.1:9333/json/version" -ErrorAction SilentlyContinue
Write-Output "devtools: $($list -ne $null)"
$targets = Invoke-RestMethod -Uri "http://127.0.0.1:9333/json" -ErrorAction SilentlyContinue
$sw = $targets | Where-Object { $_.type -eq "service_worker" -or $_.url -like "*service-worker*" } | Select-Object -First 1
Write-Output "sw target: $($sw.url)"
if (-not $proc.HasExited) { $proc.Kill() }
Write-Output "done"
