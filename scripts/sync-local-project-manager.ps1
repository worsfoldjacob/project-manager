param(
  [string]$Endpoint = $env:PROJECT_MANAGER_SYNC_ENDPOINT,
  [string]$Token = $env:PROJECT_MANAGER_SYNC_TOKEN,
  [string]$TasksPath = 'C:\Users\cayde6\.openclaw\workspace\project-management\tasks.jsonl'
)
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot '.env'
if (([string]::IsNullOrWhiteSpace($Endpoint) -or [string]::IsNullOrWhiteSpace($Token)) -and (Test-Path -LiteralPath $envPath)) {
  foreach ($line in Get-Content -LiteralPath $envPath) {
    if ($line -match '^\s*(PROJECT_MANAGER_SYNC_ENDPOINT|PROJECT_MANAGER_SYNC_TOKEN)\s*=\s*(.*)\s*$') {
      $name = $Matches[1]
      $value = $Matches[2].Trim()
      if ($value -match '^"(.*)"$') { $value = $Matches[1] }
      if ($name -eq 'PROJECT_MANAGER_SYNC_ENDPOINT' -and [string]::IsNullOrWhiteSpace($Endpoint)) { $Endpoint = $value }
      if ($name -eq 'PROJECT_MANAGER_SYNC_TOKEN' -and [string]::IsNullOrWhiteSpace($Token)) { $Token = $value }
    }
  }
}
if ([string]::IsNullOrWhiteSpace($Endpoint) -or [string]::IsNullOrWhiteSpace($Token)) { throw 'Set PROJECT_MANAGER_SYNC_ENDPOINT and PROJECT_MANAGER_SYNC_TOKEN.' }
if (-not (Test-Path -LiteralPath $TasksPath)) { throw "Tasks file not found: $TasksPath" }
$latest = @{}
$order = @()
foreach ($line in Get-Content -LiteralPath $TasksPath) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $task = $line | ConvertFrom-Json
  $id = [string]$task.id
  if ([string]::IsNullOrWhiteSpace($id)) { continue }
  if (-not $latest.ContainsKey($id)) { $order += $id }
  $latest[$id] = $task
}
$tasks = @($order | ForEach-Object { $latest[$_] })
$body = @{ tasks = $tasks } | ConvertTo-Json -Depth 12
$headers = @{ 'x-pm-sync-token' = $Token }
$response = Invoke-RestMethod -Uri $Endpoint -Method Post -Headers $headers -ContentType 'application/json' -Body $body
$response | ConvertTo-Json -Depth 5
