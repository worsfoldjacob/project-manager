$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
function Assert-Contains([string]$Path,[string]$Pattern,[string]$Message){
  if((Get-Content -Raw -LiteralPath $Path)-cnotmatch$Pattern){throw $Message}
}
Assert-Contains (Join-Path $root 'app.js') '"DONE - ABANDONED": "done"' 'Dashboard does not map DONE - ABANDONED to Done.'
Assert-Contains (Join-Path $root 'app.js') '"DONE - ABANDONED": "ABANDONED"' 'Dashboard does not use the distinct ABANDONED label.'
Assert-Contains (Join-Path $root 'app.js') 'status !== "DONE" && status !== "DONE - ABANDONED"' 'Date filter does not treat abandonment as terminal.'
Assert-Contains (Join-Path $root 'styles.css') '\.status-done-abandoned\{' 'Distinct abandoned status-pill styling is missing.'
Assert-Contains (Join-Path $root 'index.html') 'DONE, DONE - ABANDONED' 'Dashboard legend omits abandonment.'
Assert-Contains (Join-Path $root 'supabase\functions\pm-sync\task-mapping.ts') '"DONE - ABANDONED": "done"' 'PM sync does not map abandonment to Done.'
'done-abandoned-status.tests.ps1 passed'
