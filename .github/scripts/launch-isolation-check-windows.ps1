# Launch isolation check for fork Windows release builds.
#
# The Windows counterpart of launch-isolation-check.sh. Installs the NSIS
# installer into a scratch directory, launches the installed app against a
# scratch USERPROFILE/APPDATA/LOCALAPPDATA, and refuses the release unless
# everything the app creates is fork-owned: ~/.t3-fork must appear (the server
# child owns statev2.sqlite, so its arrival proves the child derived the fork
# base too), the Electron profile must be t3code-fork-v2, and nothing
# upstream-named may exist anywhere under the scratch profile afterwards.
#
# Fork-owned — see .fork/customizations.yaml#fork-desktop-release. Runs
# locally on Windows against any directory holding the built artifacts:
#
#   pwsh .github/scripts/launch-isolation-check-windows.ps1 release
param(
  [Parameter(Mandatory = $true)]
  [string]$ReleaseDir
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not (Test-Path -LiteralPath $ReleaseDir -PathType Container)) {
  throw "Release directory does not exist: $ReleaseDir"
}
$ReleaseDir = (Resolve-Path -LiteralPath $ReleaseDir).Path

function New-ScratchDirectory {
  $path = Join-Path ([System.IO.Path]::GetTempPath()) ("fork-isolation-" + [guid]::NewGuid().ToString("N"))
  (New-Item -ItemType Directory -Path $path).FullName
}

$work = New-ScratchDirectory
$scratch = New-ScratchDirectory
$installDir = Join-Path $work "install"
$appLog = Join-Path $work "app.log"
$appErrLog = Join-Path $work "app.err.log"
$app = $null

function Get-InstalledProcesses {
  # Matching by path is safe here: $installDir is a fresh GUID-named directory
  # this script created, so only processes it launched can live under it.
  Get-Process | Where-Object {
    try { $_.Path -and $_.Path.StartsWith($installDir, [System.StringComparison]::OrdinalIgnoreCase) } catch { $false }
  }
}

function Stop-App {
  if ($null -ne $app -and -not $app.HasExited) {
    & taskkill.exe /T /F /PID $app.Id 2>&1 | Out-Null
  }
  $deadline = (Get-Date).AddSeconds(30)
  while (@(Get-InstalledProcesses).Count -gt 0) {
    if ((Get-Date) -ge $deadline) {
      Get-InstalledProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
      Start-Sleep -Seconds 2
      break
    }
    Start-Sleep -Seconds 1
  }
}

function Show-Diagnostics {
  Write-Host "--- app output ---"
  foreach ($log in @($appLog, $appErrLog)) {
    if (Test-Path -LiteralPath $log) { Get-Content -LiteralPath $log | Write-Host }
  }
  Write-Host "--- scratch tree ---"
  Get-ChildItem -LiteralPath $scratch -Recurse -Depth 3 -Force -ErrorAction SilentlyContinue |
    ForEach-Object { Write-Host $_.FullName }
}

function Fail-Isolation([string]$message, [string]$path) {
  Write-Host "ISOLATION VIOLATED: $message"
  Get-ChildItem -LiteralPath $path -Recurse -Force -ErrorAction SilentlyContinue |
    ForEach-Object { Write-Host $_.FullName }
  exit 1
}

try {
  $installers = @(Get-ChildItem -LiteralPath $ReleaseDir -Filter "*.exe" -File)
  if ($installers.Count -ne 1) {
    Get-ChildItem -LiteralPath $ReleaseDir | ForEach-Object { Write-Host $_.Name }
    throw "Expected exactly one *.exe installer under $ReleaseDir, found $($installers.Count)"
  }
  $installer = $installers[0].FullName

  # Install the way a user does, silently: the installer is the headline
  # artifact and the file electron-updater downloads, so launching the
  # unpacked build directory would skip the payload users actually receive.
  # /D must be the last argument and unquoted (NSIS rule).
  $install = Start-Process -FilePath $installer -ArgumentList @("/S", "/D=$installDir") -Wait -PassThru
  if ($install.ExitCode -ne 0) {
    throw "Installer exited with status $($install.ExitCode)"
  }
  $executables = @(Get-ChildItem -LiteralPath $installDir -Filter "*.exe" -File |
      Where-Object { -not $_.Name.StartsWith("Uninstall", [System.StringComparison]::OrdinalIgnoreCase) })
  if ($executables.Count -ne 1) {
    Get-ChildItem -LiteralPath $installDir -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_.Name }
    throw "Expected exactly one app executable under $installDir, found $($executables.Count)"
  }
  $binary = $executables[0].FullName

  # The desktop reads its home from os.homedir() (USERPROFILE first) and its
  # Electron profile root from APPDATA, so pointing all three at the scratch
  # profile captures everything the app derives from either.
  $roaming = Join-Path $scratch "AppData\Roaming"
  $local = Join-Path $scratch "AppData\Local"
  New-Item -ItemType Directory -Force -Path $roaming, $local | Out-Null
  $env:USERPROFILE = $scratch
  $env:APPDATA = $roaming
  $env:LOCALAPPDATA = $local
  Remove-Item Env:T3CODE_HOME -ErrorAction SilentlyContinue

  $app = Start-Process -FilePath $binary -PassThru `
    -RedirectStandardOutput $appLog -RedirectStandardError $appErrLog

  $stateDb = Join-Path $scratch ".t3-fork\userdata\statev2.sqlite"
  $deadline = (Get-Date).AddSeconds(180)
  while ($true) {
    # A server-side regression creates ~/.t3 within seconds — fail
    # immediately and with the right message.
    if (Test-Path -LiteralPath (Join-Path $scratch ".t3")) {
      Fail-Isolation "the build created ~/.t3" (Join-Path $scratch ".t3")
    }
    if (Test-Path -LiteralPath $stateDb) { break }
    if ($app.HasExited) {
      Write-Host "App exited (status $($app.ExitCode)) before creating fork state"
      Show-Diagnostics
      exit 1
    }
    if ((Get-Date) -ge $deadline) {
      Write-Host "Server never created $stateDb within 180s"
      Show-Diagnostics
      exit 1
    }
    Start-Sleep -Seconds 2
  }

  # The server child can outlive the Electron main, so wait for the whole
  # tree to be gone before the negative assertions — a lazy write after
  # teardown must still fail the check.
  Stop-App

  # The scratch profile started empty and the app was its only writer, so
  # sweep for anything upstream-named instead of whitelisting known paths.
  # Exact name matches: none of these match their -fork variants.
  $upstreamNames = @(".t3", "t3code", "t3code-v2", "com.t3tools.t3code")
  $strays = @(Get-ChildItem -LiteralPath $scratch -Recurse -Depth 5 -Force -ErrorAction SilentlyContinue |
      Where-Object { $upstreamNames -contains $_.Name })
  if ($strays.Count -gt 0) {
    $strays | ForEach-Object { Write-Host $_.FullName }
    Fail-Isolation "upstream-named paths under the scratch profile" $scratch
  }
  if (-not (Test-Path -LiteralPath (Join-Path $roaming "t3code-fork-v2") -PathType Container)) {
    Write-Host "Expected Electron user-data directory missing: t3code-fork-v2"
    Get-ChildItem -LiteralPath $roaming -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_.Name }
    Show-Diagnostics
    exit 1
  }
  Write-Host "Isolation verified: state under ~/.t3-fork and t3code-fork-v2 only."
  Get-ChildItem -LiteralPath (Join-Path $scratch ".t3-fork") -Recurse -Depth 1 | ForEach-Object { Write-Host $_.FullName }
}
finally {
  Stop-App
  Remove-Item -LiteralPath $work, $scratch -Recurse -Force -ErrorAction SilentlyContinue
}
