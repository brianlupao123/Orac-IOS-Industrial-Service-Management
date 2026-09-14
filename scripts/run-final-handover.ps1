param([string]$BaseUrl = "https://orac-industrial-service-portal.onrender.com")

$ErrorActionPreference = "Stop"
$frontend = Split-Path -Parent $PSScriptRoot
$backend = "C:\deploy-backend"
if (-not (Test-Path $backend)) { throw "Backend directory not found: $backend" }
if (-not $env:ORAC_ADMIN_EMAIL -or -not $env:ORAC_ADMIN_PASSWORD) { throw "Set ORAC_<ROLE>_EMAIL and ORAC_<ROLE>_PASSWORD variables first. Admin is required; repeat the pattern for all roles." }

Push-Location $backend
try { npm test } finally { Pop-Location }
Push-Location $frontend
try {
  npm test
  npm run build
  $env:ORAC_BASE_URL = $BaseUrl
  npm run finalize:handover
} finally { Pop-Location }
