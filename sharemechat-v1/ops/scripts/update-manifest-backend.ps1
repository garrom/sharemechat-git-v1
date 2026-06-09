<#
.SYNOPSIS
    Actualiza la seccion `backend` del manifest tras un deploy MANUAL del
    backend (scp + restart en EC2). Fase 1 paso 2b, opcion B.

.DESCRIPTION
    Este script SOLO ACTUALIZA EL MANIFEST. NO automatiza el deploy del
    backend, que se sigue haciendo a mano. El operador lo invoca despues
    de hacer el deploy para que el manifest del entorno refleje que JAR +
    que commit quedo desplegado, y asi el check de drift del frontend
    tenga el dato del backend al dia.

    Cierra la Fase 1 del frente de prevencion de drift (Fase 1 paso 1 =
    manifest + check; Fase 1 paso 2a = integracion del check en
    deploy-frontend.ps1; Fase 1 paso 2b = este script para mantener
    fresco el bloque backend sin endpoint vivo).

    Fuente del jar_sha256:
      - Por defecto, se calcula con Get-FileHash SHA256 sobre el JAR
        LOCAL en sharemechat-v1/target/sharemechat-v1-0.0.1-SNAPSHOT.jar
        (o el path que se pase con -JarPath). Esto asume que el JAR
        local es el mismo que se acaba de desplegar al EC2 (workflow
        normal: build local -> scp -> restart -> invocar este script).
      - Con -RemoteVerify, el script tambien se conecta por SSH al
        alias del manifest (m.backend.ec2_alias) y trae el sha256 del
        JAR remoto. Si los sha local y remoto difieren, AVISA y
        registra el remoto (es lo que realmente corre). Si SSH falla
        (como le paso a TEST el 2026-06-08 por connection timeout),
        el script NO falla: registra el local y deja la advertencia
        en verification.notes para que el operador lo revise luego.

    LIMITACION CONOCIDA (la elimina Fase 2):
        Este script asume que HEAD del repo en el momento de invocarlo
        es el commit con el que se construyo el JAR desplegado. Si tras
        construir el JAR el operador hizo commits nuevos antes de
        ejecutar este script, HEAD ya NO representa el JAR.
        Workflow seguro: invocar este script INMEDIATAMENTE tras hacer
        el deploy, antes de cualquier commit nuevo.
        Fase 2 introducira un endpoint /api/health/version + plugin
        git-commit-id en el JAR; con eso el script podra confirmar
        contra el commit real del JAR vivo y la suposicion desaparece.

    No hace commit del manifest: el operador commitea cuando le
    conviene (decision D2).

.PARAMETER Env
    Identificador del entorno: audit, test o prod.

.PARAMETER JarPath
    Path al JAR local cuyo sha256 se calculara. Por defecto:
    sharemechat-v1/target/sharemechat-v1-0.0.1-SNAPSHOT.jar relativo
    al repo root.

.PARAMETER RemoteVerify
    Si se especifica, ssh al alias del manifest y calcula el sha256 del
    JAR remoto para comparar con el local. Si SSH falla, no fallaes este
    script: se queda con el dato local y registra la advertencia en
    verification.notes.

.PARAMETER DryRun
    Muestra que cambios se aplicarian a la seccion backend del manifest
    sin escribir el fichero.

.EXAMPLE
    .\update-manifest-backend.ps1 -Env audit

    Workflow normal: tras hacer scp + restart del JAR a AUDIT, calcular
    sha256 del JAR local, leer HEAD, y actualizar audit.yaml.

.EXAMPLE
    .\update-manifest-backend.ps1 -Env prod -RemoteVerify

    Igual, pero ademas verifica contra el sha256 del JAR remoto via SSH.

.EXAMPLE
    .\update-manifest-backend.ps1 -Env audit -DryRun

    Muestra el diff que se aplicaria al bloque backend de audit.yaml
    sin tocar el fichero.

.NOTES
    Requiere git en PATH, powershell-yaml (instalado on-demand por el
    helper compartido check-deploy-drift.ps1), y SSH configurado con
    el alias del manifest si se usa -RemoteVerify. La invocacion remota
    asume que el operador tiene sudo NOPASSWD en EC2 (mismo supuesto
    que cualquier otro flujo ssh+sudo del proyecto).
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('audit', 'test', 'prod')]
    [string]$Environment,

    [Parameter(Mandatory = $false)]
    [string]$JarPath,

    [Parameter(Mandatory = $false)]
    [switch]$RemoteVerify,

    [Parameter(Mandatory = $false)]
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------
# Dot-source del check para reusar helpers (Get-WorkingTreeCleanForCode,
# Update-DeployStateManifestBackend, _Ensure-Yaml).
# ---------------------------------------------------------------
. (Join-Path $PSScriptRoot 'check-deploy-drift.ps1')

# Resolver paths del repo.
$scriptDir     = Split-Path -Parent $PSCommandPath
$opsDir        = Split-Path -Parent $scriptDir
$sharemechatV1 = Split-Path -Parent $opsDir
$repoRoot      = Split-Path -Parent $sharemechatV1

if (-not $JarPath) {
    $JarPath = Join-Path $sharemechatV1 'target/sharemechat-v1-0.0.1-SNAPSHOT.jar'
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " update-manifest-backend.ps1 -> $($Environment.ToUpper())" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " repoRoot:    $repoRoot"
Write-Host " manifest:    $sharemechatV1/ops/deploy-state/$Environment.yaml"
Write-Host " JarPath:     $JarPath"
Write-Host " RemoteVerify: $RemoteVerify"
Write-Host " DryRun:      $DryRun"
Write-Host ""

# ---------------------------------------------------------------
# HEAD del repo + working tree clean (excluyendo ops/deploy-state/*.yaml).
# ---------------------------------------------------------------
Push-Location $repoRoot
try {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $gitCommitFull  = (& git rev-parse HEAD 2>$null).Trim()
        $gitCommitShort = (& git rev-parse --short HEAD 2>$null).Trim()
    } finally { $ErrorActionPreference = $prev }
} finally { Pop-Location }
if (-not $gitCommitShort) {
    throw "No se pudo resolver HEAD del repo (git rev-parse). Repo en estado invalido?"
}

$wtClean = Get-WorkingTreeCleanForCode

Write-Host " HEAD:        $gitCommitFull ($gitCommitShort)"
Write-Host " WT clean:    $wtClean (excluyendo ops/deploy-state/*.yaml)"

# ---------------------------------------------------------------
# sha256 del JAR local (si existe).
# ---------------------------------------------------------------
$localJarSha   = $null
$localJarMtime = $null
if (Test-Path $JarPath) {
    $localJarSha   = (Get-FileHash -Algorithm SHA256 -Path $JarPath).Hash.ToLower()
    $localJarMtime = (Get-Item $JarPath).LastWriteTimeUtc.ToString("yyyy-MM-ddTHH:mm:ssZ")
    Write-Host " JAR local:   $JarPath"
    Write-Host "   sha256:    $localJarSha"
    Write-Host "   mtime UTC: $localJarMtime"
} else {
    Write-Host " WARN - JAR local no encontrado en $JarPath. jar_sha256 se rellenara solo si -RemoteVerify lo trae del EC2." -ForegroundColor Yellow
}

# ---------------------------------------------------------------
# Leer manifest actual (para diff + para obtener ec2_alias / remote_path
# si pedimos remote verify).
# ---------------------------------------------------------------
_Ensure-Yaml
$manifestFile = Join-Path $sharemechatV1 "ops/deploy-state/$Environment.yaml"
if (-not (Test-Path $manifestFile)) {
    throw "Manifest no encontrado: $manifestFile"
}
$rawBefore = Get-Content $manifestFile -Raw
$mBefore   = ConvertFrom-Yaml $rawBefore

# ---------------------------------------------------------------
# Verify remoto (opcional).
# ---------------------------------------------------------------
$remoteJarSha      = $null
$verificationNotes = $null
$verificationMethod = 'manual_via_update-manifest-backend.ps1'

if ($RemoteVerify) {
    $alias      = [string]$mBefore.backend.ec2_alias
    $remotePath = [string]$mBefore.backend.remote_path
    if (-not $alias -or -not $remotePath) {
        Write-Host " WARN - manifest no expone backend.ec2_alias o backend.remote_path; no se puede hacer remote verify." -ForegroundColor Yellow
    } else {
        Write-Host " Remote verify: ssh -o BatchMode=yes -o ConnectTimeout=10 $alias 'sudo sha256sum $remotePath' ..."
        $prev = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            $remoteOutput = & ssh -o BatchMode=yes -o ConnectTimeout=10 $alias "sudo sha256sum $remotePath" 2>$null
            $sshExitCode = $LASTEXITCODE
        } finally { $ErrorActionPreference = $prev }

        if ($sshExitCode -eq 0 -and $remoteOutput) {
            $remoteJarSha = ($remoteOutput -split '\s+')[0].ToLower()
            Write-Host "   JAR remoto sha256: $remoteJarSha"
            if ($localJarSha -and $localJarSha -ne $remoteJarSha) {
                Write-Host " WARN - sha local y remoto DIFIEREN. Se registra el remoto (lo que realmente corre)." -ForegroundColor Yellow
                $verificationNotes  = "Remote verify: sha local $localJarSha != sha remoto $remoteJarSha. Registrado el REMOTO."
                $verificationMethod = 'manual_via_update-manifest-backend.ps1+remote-verify'
            } else {
                $verificationMethod = 'manual_via_update-manifest-backend.ps1+remote-verify'
            }
        } else {
            Write-Host " WARN - SSH a $alias fallo (exit code $sshExitCode). jar_sha256 se registra del JAR LOCAL si esta disponible." -ForegroundColor Yellow
            $verificationNotes  = "Remote verify intentado pero SSH a $alias fallo (exit $sshExitCode). jar_sha256 registrado = sha del JAR LOCAL; verificar manualmente cuando SSH se restablezca."
            $verificationMethod = 'manual_via_update-manifest-backend.ps1+remote-verify-failed'
        }
    }
}

# Decidir jar_sha256 final: remoto si esta disponible, si no local, si no null.
$finalJarSha = if ($remoteJarSha) { $remoteJarSha } elseif ($localJarSha) { $localJarSha } else { $null }
if (-not $finalJarSha) {
    Write-Host " WARN - Ningun sha256 disponible (ni local ni remoto). jar_sha256 quedara a null en el manifest." -ForegroundColor Yellow
}

# Resolver deployed_by
$deployedBy = "$env:USERNAME@$env:COMPUTERNAME"
$nowUtc     = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

# ---------------------------------------------------------------
# Diff legible (before vs after) sobre la seccion backend.
# ---------------------------------------------------------------
Write-Host ""
Write-Host "=== Cambios que aplicaria al bloque backend de $Environment.yaml ===" -ForegroundColor Cyan

# Lista ordenada para que el orden de salida sea estable.
$fields = @(
    @{ key='jar_sha256';         before=$mBefore.backend.jar_sha256;        after=$finalJarSha }
    @{ key='git_commit_short';   before=$mBefore.backend.git_commit_short;  after=$gitCommitShort }
    @{ key='git_commit';         before=$mBefore.backend.git_commit;        after=$gitCommitFull }
    @{ key='built_at';           before=$mBefore.backend.built_at;          after=$nowUtc }
    @{ key='deployed_at';        before=$mBefore.backend.deployed_at;       after=$nowUtc }
    @{ key='deployed_by';        before=$mBefore.backend.deployed_by;       after=$deployedBy }
    @{ key='working_tree_clean'; before=$mBefore.backend.working_tree_clean; after=$wtClean }
    @{ key='verification.method'; before=$mBefore.backend.verification.method; after=$verificationMethod }
)

$fmt = "{0,-22} {1,-40} {2}"
Write-Host ($fmt -f 'campo','before','after') -ForegroundColor DarkGray
Write-Host ($fmt -f '-----','------','-----') -ForegroundColor DarkGray
foreach ($row in $fields) {
    $b = if ($null -eq $row.before) { '<null>' } else { [string]$row.before }
    $a = if ($null -eq $row.after)  { '<null>' } else { [string]$row.after }
    $bShort = if ($b.Length -gt 38) { $b.Substring(0, 35) + '...' } else { $b }
    $aShort = if ($a.Length -gt 38) { $a.Substring(0, 35) + '...' } else { $a }
    $color = if ($b -ne $a) { 'Yellow' } else { 'DarkGray' }
    Write-Host ($fmt -f $row.key, $bShort, $aShort) -ForegroundColor $color
}

if ($DryRun) {
    Write-Host ""
    Write-Host "[DryRun] No se escribe el manifest. Salida." -ForegroundColor Yellow
    exit 0
}

# ---------------------------------------------------------------
# Confirmacion + escritura.
# ---------------------------------------------------------------
Write-Host ""
$ans = Read-Host "Aplicar al manifest? [s/N]"
if ($ans -notmatch '^(s|si|y|yes)$') {
    Write-Host "Cancelado por el operador. Manifest sin cambios." -ForegroundColor Yellow
    exit 0
}

$result = Update-DeployStateManifestBackend `
    -Env $Environment `
    -JarSha256 $finalJarSha `
    -GitCommitFull $gitCommitFull `
    -GitCommitShort $gitCommitShort `
    -WorkingTreeClean $wtClean `
    -DeployedBy $deployedBy `
    -VerificationMethod $verificationMethod `
    -VerificationNotes $verificationNotes

Write-Host ""
Write-Host "OK - manifest actualizado: $($result.ManifestFile)" -ForegroundColor Green
Write-Host "     UpdatedAt: $($result.UpdatedAt)" -ForegroundColor DarkGray
Write-Host "     (recordatorio: el commit del manifest lo decides tu; no se hace auto-commit.)" -ForegroundColor DarkGray
