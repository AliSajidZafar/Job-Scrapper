# Daily scrape on the PC — run by the Windows Task Scheduler task
# "Mavericks daily LinkedIn scrape" (7:00 PM). The scraper itself reports the
# outcome to n8n (SCRAPE_REPORT_URL in .env.local), which emails on failure.
Set-Location (Split-Path $PSScriptRoot -Parent)
New-Item -ItemType Directory -Force logs | Out-Null
$log = "logs\scrape-$(Get-Date -Format yyyy-MM-dd).log"

cmd /c "node scraper\index.js >> `"$log`" 2>&1"

# Keep a month of logs.
Get-ChildItem logs -Filter 'scrape-*.log' |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
  Remove-Item -ErrorAction SilentlyContinue
