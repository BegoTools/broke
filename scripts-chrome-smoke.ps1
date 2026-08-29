$src = (Resolve-Path build).Path
$ext = "C:\vsd-build-tmp"
if (Test-Path $ext) { Remove-Item -Recurse -Force $ext }
Copy-Item -Recurse $src $ext
$udd = Join-Path $env:TEMP "vsd-chrome-test5"
if (Test-Path $udd) { Remove-Item -Recurse -Force $udd }
New-Item -ItemType Directory -Force -Path $udd | Out-Null
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$args = @("--headless=new","--no-sandbox","--disable-gpu","--user-data-dir=$udd","--load-extension=$ext")
$proc = Start-Process -FilePath $chrome -ArgumentList $args -PassThru -RedirectStandardError "$udd\err.log" -RedirectStandardOutput "$udd\out.log"
Start-Sleep -Seconds 7
if (-not $proc.HasExited) { $proc.Kill() }
Write-Output "=== load/parse errors? ==="
if (Test-Path "$udd\err.log") { Get-Content "$udd\err.log" | Select-String -Pattern "Could not load|Failed to load|Manifest|Unexpected token|SyntaxError|is not defined|Video Source" | Select-Object -First 15 }
Write-Output "done"
