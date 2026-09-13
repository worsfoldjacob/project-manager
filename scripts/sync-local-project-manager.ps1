param(
  [string]$Endpoint = $env:PROJECT_MANAGER_SYNC_ENDPOINT,
  [string]$Token = $env:PROJECT_MANAGER_SYNC_TOKEN,
  [string]$TasksPath = $env:CAYDE_PM_TASKS_PATH
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
if ([string]::IsNullOrWhiteSpace($TasksPath) -and -not [string]::IsNullOrWhiteSpace($env:CAYDE_STATE_ROOT)) { $TasksPath = Join-Path $env:CAYDE_STATE_ROOT 'project-manager\tasks.jsonl' }
if ([string]::IsNullOrWhiteSpace($TasksPath)) { throw 'Set CAYDE_PM_TASKS_PATH or CAYDE_STATE_ROOT, or pass -TasksPath.' }
$endpointUri = $null
if (-not [Uri]::TryCreate($Endpoint, [UriKind]::Absolute, [ref]$endpointUri) -or $endpointUri.Scheme -ne 'https' -or $endpointUri.UserInfo -or $endpointUri.Host -notmatch '^[a-z0-9-]+\.supabase\.co$' -or $endpointUri.AbsolutePath -ne '/functions/v1/pm-sync') { throw 'PROJECT_MANAGER_SYNC_ENDPOINT_INVALID' }
if (-not (Test-Path -LiteralPath $TasksPath)) { throw "Tasks file not found: $TasksPath" }
$latest = @{}
$order = @()
foreach ($line in Get-Content -LiteralPath $TasksPath) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $record = $line | ConvertFrom-Json
  $task = if ($record.state -and $record.taskId) { $record.state } else { $record }
  $id = if ($task.taskId) { [string]$task.taskId } else { [string]$task.id }
  if ([string]::IsNullOrWhiteSpace($id)) { continue }
  if (-not $latest.ContainsKey($id)) { $order += $id }
  $latest[$id] = $task
}
$tasks = @($order | ForEach-Object { $latest[$_] })
$body = @{ tasks = $tasks } | ConvertTo-Json -Depth 32
$headers = @{ 'x-pm-sync-token' = $Token }
$response = Invoke-RestMethod -Uri $Endpoint -Method Post -Headers $headers -ContentType 'application/json' -Body $body
if ($null -eq $response.synced -or [int]$response.synced -ne $tasks.Count) { throw 'PROJECT_MANAGER_SYNC_COUNT_MISMATCH' }
$response | ConvertTo-Json -Depth 5
