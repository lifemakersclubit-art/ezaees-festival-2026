# Regenerates backend/Ezaees_Festival_2026_Backend_SingleFile.gs from the
# modular sources in backend/. The single file is what you paste into the
# Apps Script editor, so it must never drift from the modules.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\build-backend.ps1
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$src  = Join-Path $root "backend"
$out  = Join-Path $src  "Ezaees_Festival_2026_Backend_SingleFile.gs"

# Dependency order: config -> helpers -> data -> analytics -> router.
$order = @(
  @{ file = "Config.gs";        label = "CONFIGURATION" },
  @{ file = "Utils.gs";         label = "SHARED UTILITIES" },
  @{ file = "DataService.gs";   label = "DATA ACCESS LAYER" },
  @{ file = "AnalyticsService.gs"; label = "ANALYTICS SERVICE" },
  @{ file = "Code.gs";          label = "API ENTRY POINT (ROUTER)" }
)

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("// ============================================================")
[void]$sb.AppendLine("// EZAEES Festival 2026 - Registration Intelligence Backend")
[void]$sb.AppendLine("// SINGLE FILE EDITION - paste ALL of this into Apps Script Code.gs")
[void]$sb.AppendLine("// GENERATED FILE - do not edit by hand.")
[void]$sb.AppendLine("// Source of truth: the modular files in backend/. Edit those, then re-bundle.")
[void]$sb.AppendLine("// Regenerate with: tools/build-backend.ps1")
[void]$sb.AppendLine("// ============================================================")

foreach ($m in $order) {
  $p = Join-Path $src $m.file
  if (-not (Test-Path $p)) { throw "missing backend module: $($m.file)" }
  [void]$sb.AppendLine("")
  $rule = '=' * (24 + $m.file.Length + $m.label.Length + 3)
  [void]$sb.AppendLine("// =================== SOURCE FILE: $($m.file) ($($m.label)) ===================")
  $text = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
  # normalise to LF and trim trailing blank lines, keep inner content verbatim
  $text = ($text -replace "`r`n", "`n").TrimEnd()
  [void]$sb.AppendLine($text)
}
[void]$sb.AppendLine("")

$text = $sb.ToString()
[System.IO.File]::WriteAllText($out, $text, (New-Object System.Text.UTF8Encoding($false)))

"rebuilt: $out"
"lines  : $(($text -split "`n").Count)"

# --- guard: the bundle must not be stale ---
# NB: read with explicit UTF-8. Get-Content defaults to the ANSI code page on
# Windows PowerShell 5.1, which mangles the Arabic and makes this always fail.
$problems = @()
foreach ($m in $order) {
  $a = [System.IO.File]::ReadAllText((Join-Path $src $m.file), [System.Text.Encoding]::UTF8)
  $a = ($a -replace "`r`n", "`n").TrimEnd()
  if (-not $text.Contains($a)) { $problems += $m.file }
}
if ($problems.Count) {
  "STALE CHECK FAILED for: $($problems -join ', ')"
  exit 1
}
"stale check: ok (all $($order.Count) modules embedded verbatim)"