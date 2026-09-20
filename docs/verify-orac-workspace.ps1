$ErrorActionPreference = "Stop"

$repositories = @(
  @{ Name = "Backend API"; Path = "C:\deploy-backend" },
  @{ Name = "Frontend portal"; Path = "C:\Users\BRIAN LUPAO\Desktop\ffims-asset-register\render-deploy\orac-ios-web" }
)

foreach ($repository in $repositories) {
  if (-not (Test-Path (Join-Path $repository.Path ".git"))) {
    throw "$($repository.Name) repository was not found at $($repository.Path)."
  }

  Write-Host "`n$($repository.Name): $($repository.Path)" -ForegroundColor Cyan
  git -C $repository.Path log -1 --format="Commit: %h  %s  (%ad)" --date=short
  git -C $repository.Path status --short --branch
}

Write-Host "`nThis check only reports state. It does not modify source, Git history, Render, or the database." -ForegroundColor Green
