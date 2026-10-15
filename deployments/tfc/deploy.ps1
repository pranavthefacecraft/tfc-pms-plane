# Builds the TFC PMS images on this machine and deploys them to the server.
# Usage (from the repo root):
#   powershell -ExecutionPolicy Bypass -File .\deployments\tfc\deploy.ps1 [-SshHost tfcpmsplain] [-Services web,api]
param(
  [string]$SshHost = "tfcpmsplain",
  [string[]]$Services = @("api", "web", "admin", "space", "live", "proxy")
)
$ErrorActionPreference = "Stop"
# `-File` passes "web,api" as one string, so split it here
$Services = $Services -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ }
$compose = Join-Path $PSScriptRoot "docker-compose.yml"

$imageFor = @{
  api = "tfcpms/plane-backend:latest"; web = "tfcpms/plane-frontend:latest"; admin = "tfcpms/plane-admin:latest"
  space = "tfcpms/plane-space:latest"; live = "tfcpms/plane-live:latest"; proxy = "tfcpms/plane-proxy:latest"
}

# compose needs an env file to interpolate; the real secrets only live on the server
$localEnv = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $localEnv)) { Copy-Item (Join-Path $PSScriptRoot ".env.example") $localEnv }

Write-Host "Building $($Services -join ', ')..."
docker compose -f $compose build @Services
if ($LASTEXITCODE -ne 0) { throw "docker build failed" }

$images = ($Services | ForEach-Object { $imageFor[$_] }) -join " "
Write-Host "Streaming images to $SshHost..."
# cmd.exe keeps the binary pipe intact (Windows PowerShell 5 would re-encode it)
cmd /c "docker save $images | ssh -C $SshHost docker load"
if ($LASTEXITCODE -ne 0) { throw "image transfer failed" }

scp -q $compose "${SshHost}:/opt/tfcpms/docker-compose.yml"
$backend = if ($Services -contains "api") { "api worker beat-worker migrator" } else { "" }
$targets = (($Services | Where-Object { $_ -ne "api" }) -join " ") + " " + $backend
ssh $SshHost "cd /opt/tfcpms && docker compose up -d --no-build $targets && docker image prune -f >/dev/null && docker compose ps --format '{{.Service}}\t{{.Status}}'"
