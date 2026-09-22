param(
    [string]$EnvironmentFile = ".env.uat.local",
    [Parameter(Mandatory = $true)][string]$EvidenceClass
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if (-not (Test-Path $EnvironmentFile)) { throw "STOP: $EnvironmentFile is required. Copy .env.uat.local.example without committing it." }
node .\scripts\capture-uat-evidence.mjs --env $EnvironmentFile --evidence-class $EvidenceClass
if ($LASTEXITCODE -ne 0) { throw "STOP: UAT capture failed." }
