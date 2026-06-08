<#
.SYNOPSIS
    Compara el manifest de despliegue de un entorno con el estado de origin/main
    y avisa si hay drift backend<->frontend que pueda romper el contrato API.

.DESCRIPTION
    Fase 1 paso 1 (2026-06-09). Lee ops/deploy-state/<env>.yaml y compara los
    commits cortos registrados de backend, frontend_product y frontend_admin
    entre si y contra origin/main. Devuelve una severidad y, en CLI, una tabla
    legible.

    Severidades:
      - OK       : los tres surfaces estan en el MISMO commit corto y
                   working_tree_clean=true para todos los que lo registran.
      - INFO     : commits distintos pero todos <=24h y working_tree_clean=true.
      - WARN     : algun commit con edad >24h, o working_tree_clean=false,
                   o algun frontend_*.git_commit_short es null (no inferible).
      - ALERT    : algun commit >72h, o backend POR DETRAS de cualquier
                   frontend (cualquier surface) sin tocar contrato.
      - CRITICAL : backend POR DETRAS de cualquier frontend Y entre los dos
                   commits hay cambios en ficheros del contrato.

    Modo "ultima informacion conocida": si el manifest declara
    `backend.verification.method` con prefijo `last_known_*` (i.e. no hubo
    verificacion en vivo en la ultima actualizacion), la severidad gana
    minimo WARN aunque el resto este alineado, y el reporte explica que
    el dato del backend es la mejor inferencia documentada.

    Lista hardcoded de ficheros del contrato (Fase 1, ampliable):

        sharemechat-v1/src/main/java/com/sharemechat/dto/UserDTO.java
        sharemechat-v1/src/main/java/com/sharemechat/dto/PublicUserDTO.java
        sharemechat-v1/src/main/java/com/sharemechat/dto/BackofficeUserViewDTO.java
        sharemechat-v1/src/main/java/com/sharemechat/controller/UserController.java
        sharemechat-v1/src/main/java/com/sharemechat/service/ProductOperationalModeService.java
        sharemechat-v1/frontend/src/components/RequireRole.jsx
        sharemechat-v1/frontend/src/components/SessionProvider.jsx
        sharemechat-v1/frontend/src/config/featureFlags.js

.PARAMETER Env
    Identificador del entorno: audit, test, prod. Si se omite y el script se
    invoca directamente, se exige el parametro.

.PARAMETER ManifestPath
    Override opcional de la ruta al manifest. Por defecto:
    <repoRoot>/sharemechat-v1/ops/deploy-state/<env>.yaml.
    Usable en pruebas para inyectar un manifest sintetico.

.EXAMPLE
    .\check-deploy-drift.ps1 -Env audit

    Corre el check contra el manifest real de AUDIT y muestra la tabla.

.EXAMPLE
    . .\check-deploy-drift.ps1
    Invoke-DeployDriftCheck -Env audit

    Dot-source el script y llama a la funcion publica desde otro contexto
    (p.ej. deploy-frontend.ps1 que importara el check al inicio).

.NOTES
    Requiere: git en PATH, powershell-yaml module (se instala on demand
    si falta).

    Este script es READ-ONLY. No modifica el manifest, no toca infra y
    no falla con codigo distinto de 0 en si mismo: emite la severidad
    como propiedad del objeto devuelto. La decision de bloquear un
    deploy queda en el script llamante (Fase 2: deploy-frontend.ps1
    integrara la severidad CRITICAL como abort).
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false, Position = 0)]
    [ValidateSet('audit', 'test', 'prod')]
    [string]$Env,

    [Parameter(Mandatory = $false)]
    [string]$ManifestPath
)

# ---------------------------------------------------------------
# Lista hardcoded de ficheros del contrato. Si en el futuro se anaden
# nuevos endpoints/payloads compartidos entre backend y frontend,
# extender esta lista en el mismo PR.
# ---------------------------------------------------------------
$script:ContractFiles = @(
    'sharemechat-v1/src/main/java/com/sharemechat/dto/UserDTO.java'
    'sharemechat-v1/src/main/java/com/sharemechat/dto/PublicUserDTO.java'
    'sharemechat-v1/src/main/java/com/sharemechat/dto/BackofficeUserViewDTO.java'
    'sharemechat-v1/src/main/java/com/sharemechat/controller/UserController.java'
    'sharemechat-v1/src/main/java/com/sharemechat/service/ProductOperationalModeService.java'
    'sharemechat-v1/frontend/src/components/RequireRole.jsx'
    'sharemechat-v1/frontend/src/components/SessionProvider.jsx'
    'sharemechat-v1/frontend/src/config/featureFlags.js'
)

# ---------------------------------------------------------------
# Helpers privados
# ---------------------------------------------------------------

function _Resolve-RepoRoot {
    # El script vive en sharemechat-v1/ops/scripts/. El repo root esta dos
    # niveles arriba del script + un nivel mas (porque hay una carpeta
    # sharemechat-v1/ debajo del repo).
    $scriptDir = Split-Path -Parent $PSCommandPath
    if (-not $scriptDir) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
    # scriptDir = .../sharemechat-v1/ops/scripts
    $sharemechatV1 = Split-Path -Parent (Split-Path -Parent $scriptDir)
    $repoRoot      = Split-Path -Parent $sharemechatV1
    return $repoRoot
}

function _Resolve-ManifestPath {
    param([string]$Env, [string]$Override)
    if ($Override) {
        if (-not (Test-Path $Override)) {
            throw "Manifest override no encontrado: $Override"
        }
        return (Resolve-Path $Override).Path
    }
    $root = _Resolve-RepoRoot
    $path = Join-Path $root "sharemechat-v1/ops/deploy-state/$Env.yaml"
    if (-not (Test-Path $path)) {
        throw "Manifest no encontrado: $path"
    }
    return $path
}

function _Ensure-Yaml {
    if (-not (Get-Module -ListAvailable -Name powershell-yaml)) {
        Write-Host "    Instalando modulo powershell-yaml..." -ForegroundColor DarkGray
        Install-Module -Name powershell-yaml -Scope CurrentUser -Force -ErrorAction Stop
    }
    Import-Module powershell-yaml -ErrorAction Stop
}

function _Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args
    )
    # Invoca git capturando stdout. Si el comando falla, devuelve $null.
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & git @Args 2>$null
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prev
    }
    if ($code -ne 0) { return $null }
    return $output
}

function _Age-Days {
    param([string]$Iso)
    if ([string]::IsNullOrWhiteSpace($Iso)) { return $null }
    try {
        $t = [datetime]::Parse($Iso, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::AssumeUniversal -bor [System.Globalization.DateTimeStyles]::AdjustToUniversal)
        $now = [datetime]::UtcNow
        return [math]::Round(($now - $t).TotalDays, 1)
    } catch {
        return $null
    }
}

function _Is-Ancestor {
    # Devuelve $true si $commitA es ancestor de $commitB. Null si no se puede
    # resolver (commit desconocido en el repo).
    param([string]$CommitA, [string]$CommitB)
    if (-not $CommitA -or -not $CommitB) { return $null }
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & git merge-base --is-ancestor $CommitA $CommitB 2>$null | Out-Null
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prev
    }
    if ($code -eq 0) { return $true }
    if ($code -eq 1) { return $false }
    return $null   # commit no encontrado u otro error
}

function _Contract-Files-Touched {
    # Devuelve la lista de ficheros del contrato modificados entre
    # $From (excl) y $To (incl). Vacio si ninguno.
    param([string]$From, [string]$To)
    if (-not $From -or -not $To) { return @() }
    $diff = _Git @('diff', '--name-only', "$From..$To")
    if (-not $diff) { return @() }
    $touched = @()
    foreach ($f in $diff) {
        $f = $f.Trim()
        if ($script:ContractFiles -contains $f) {
            $touched += $f
        }
    }
    return $touched
}

# ---------------------------------------------------------------
# Funcion publica: Invoke-DeployDriftCheck
# ---------------------------------------------------------------

function Invoke-DeployDriftCheck {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('audit', 'test', 'prod')]
        [string]$Env,

        [Parameter(Mandatory = $false)]
        [string]$ManifestPath
    )

    _Ensure-Yaml
    $manifestFile = _Resolve-ManifestPath -Env $Env -Override $ManifestPath
    $raw = Get-Content $manifestFile -Raw
    $m = ConvertFrom-Yaml $raw

    # 1) Refrescar origin/main para tener referencia comparable.
    #    Fallible (sin red, ofuscado, etc.); si falla, seguimos con la
    #    informacion local y lo anotamos.
    $fetchOk = $true
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & git fetch origin main 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) { $fetchOk = $false }
    } finally {
        $ErrorActionPreference = $prev
    }
    $originMain = _Git @('rev-parse', '--short', 'origin/main')
    if (-not $originMain) { $originMain = _Git @('rev-parse', '--short', 'HEAD') }

    # 2) Extraer commits + edades de los 3 surfaces.
    $backendCommit  = [string]$m.backend.git_commit_short
    $productCommit  = [string]$m.frontend_product.git_commit_short
    $adminCommit    = [string]$m.frontend_admin.git_commit_short

    $backendAge = _Age-Days $m.backend.deployed_at
    $productAge = _Age-Days $m.frontend_product.deployed_at
    $adminAge   = _Age-Days $m.frontend_admin.deployed_at

    $backendClean = $true   # backend no expone working_tree_clean en este schema
    $productClean = ($m.frontend_product.working_tree_clean -eq $true)
    $adminClean   = ($m.frontend_admin.working_tree_clean -eq $true)

    # `working_tree_clean: null` o ausente no es false: es desconocido.
    $productCleanRecorded = ($null -ne $m.frontend_product.working_tree_clean)
    $adminCleanRecorded   = ($null -ne $m.frontend_admin.working_tree_clean)

    # 3) Modo "last known": el backend del manifest no fue verificado en
    #    vivo en la ultima actualizacion.
    $backendMethod = [string]$m.backend.verification.method
    $isLastKnown = $backendMethod -like 'last_known_*'

    # 4) Severidad. Lo construimos acumulando: cada regla puede subir el
    #    nivel pero no bajarlo.
    $severity = 'OK'
    $reasons = New-Object System.Collections.Generic.List[string]
    $criticalContract = @()

    # 4.a) Commits identicos en los 3 surfaces?
    $allSame = ($backendCommit -and $productCommit -and $adminCommit -and
                 ($backendCommit -eq $productCommit) -and
                 ($backendCommit -eq $adminCommit))

    if (-not $allSame) {
        $severity = 'INFO'
        $reasons.Add("Commits distintos entre backend ($backendCommit), frontend_product ($productCommit), frontend_admin ($adminCommit).")
    }

    # 4.b) Edades > 24h o > 72h.
    foreach ($pair in @(@('backend',$backendAge), @('frontend_product',$productAge), @('frontend_admin',$adminAge))) {
        $label = $pair[0]; $age = $pair[1]
        if ($null -eq $age) { continue }
        if ($age -gt 3) {
            if ($severity -in @('OK','INFO','WARN')) { $severity = 'ALERT' }
            $reasons.Add("$label edad ${age}d (>72h).")
        } elseif ($age -gt 1) {
            if ($severity -in @('OK','INFO')) { $severity = 'WARN' }
            $reasons.Add("$label edad ${age}d (>24h).")
        }
    }

    # 4.c) working_tree_clean=false en cualquiera de los frontend.
    if ($productCleanRecorded -and -not $productClean) {
        if ($severity -in @('OK','INFO')) { $severity = 'WARN' }
        $reasons.Add("frontend_product construido con working tree DIRTY.")
    }
    if ($adminCleanRecorded -and -not $adminClean) {
        if ($severity -in @('OK','INFO')) { $severity = 'WARN' }
        $reasons.Add("frontend_admin construido con working tree DIRTY.")
    }

    # 4.d) Algun frontend commit es null (no inferible) -> WARN.
    if (-not $productCommit) {
        if ($severity -in @('OK','INFO')) { $severity = 'WARN' }
        $reasons.Add("frontend_product.git_commit_short es null (no inferible).")
    }
    if (-not $adminCommit) {
        if ($severity -in @('OK','INFO')) { $severity = 'WARN' }
        $reasons.Add("frontend_admin.git_commit_short es null (no inferible).")
    }

    # 4.e) Backend por detras de cualquier frontend? -> ALERT, y CRITICAL
    #      si entre ambos commits se tocan ficheros del contrato.
    foreach ($pair in @(@('frontend_product',$productCommit), @('frontend_admin',$adminCommit))) {
        $label = $pair[0]; $feCommit = $pair[1]
        if (-not $backendCommit -or -not $feCommit) { continue }
        $isAnc = _Is-Ancestor -CommitA $backendCommit -CommitB $feCommit
        if ($isAnc -eq $true -and $backendCommit -ne $feCommit) {
            if ($severity -in @('OK','INFO','WARN')) { $severity = 'ALERT' }
            $reasons.Add("backend ($backendCommit) esta POR DETRAS de $label ($feCommit).")
            $touched = _Contract-Files-Touched -From $backendCommit -To $feCommit
            if ($touched.Count -gt 0) {
                $severity = 'CRITICAL'
                foreach ($t in $touched) { $criticalContract += @{ surface = $label; file = $t } }
                $reasons.Add("Entre backend y $label se tocaron ficheros del contrato: $($touched -join ', ').")
            }
        }
    }

    # 4.f) Modo last_known del backend -> minimo WARN.
    if ($isLastKnown) {
        if ($severity -in @('OK','INFO')) { $severity = 'WARN' }
        $reasons.Add("backend.verification.method='$backendMethod' (sin verificacion en vivo; ultima info conocida).")
    }

    # 4.g) Comparar contra origin/main para informacion contextual.
    $behindOriginMain = $null
    if ($originMain -and $backendCommit) {
        $cnt = _Git @('rev-list', '--count', "$backendCommit..$originMain")
        if ($cnt) { $behindOriginMain = [int]$cnt }
    }

    # 5) Resultado.
    $result = [PSCustomObject]@{
        Env                  = $Env
        ManifestFile         = $manifestFile
        OriginMain           = $originMain
        FetchOk              = $fetchOk
        Severity             = $severity
        Reasons              = $reasons.ToArray()
        BackendCommit        = $backendCommit
        BackendAgeDays       = $backendAge
        BackendIsLastKnown   = $isLastKnown
        BackendBehindOriginMain = $behindOriginMain
        ProductCommit        = $productCommit
        ProductAgeDays       = $productAge
        ProductWorkingClean  = if ($productCleanRecorded) { $productClean } else { $null }
        AdminCommit          = $adminCommit
        AdminAgeDays         = $adminAge
        AdminWorkingClean    = if ($adminCleanRecorded) { $adminClean } else { $null }
        ContractFilesTouched = $criticalContract
    }
    return $result
}

# ---------------------------------------------------------------
# Render CLI (legible cuando se invoca directamente)
# ---------------------------------------------------------------

function Write-DeployDriftReport {
    param([Parameter(Mandatory = $true)]$Result)

    $r = $Result
    $color = switch ($r.Severity) {
        'OK'       { 'Green' }
        'INFO'     { 'Cyan' }
        'WARN'     { 'Yellow' }
        'ALERT'    { 'DarkYellow' }
        'CRITICAL' { 'Red' }
        default    { 'White' }
    }

    Write-Host ""
    Write-Host "=== Drift check: $($r.Env.ToUpper()) ===" -ForegroundColor $color
    Write-Host "Manifest:       $($r.ManifestFile)"
    if ($r.FetchOk) {
        Write-Host "origin/main:    $($r.OriginMain)"
    } else {
        Write-Host "origin/main:    $($r.OriginMain) (fetch fallo; usando referencia local)"
    }
    Write-Host ""

    $fmt = "{0,-20} {1,-12} {2,-10} {3,-22}"
    Write-Host ($fmt -f 'surface','commit','age(d)','working-tree') -ForegroundColor DarkGray
    Write-Host ($fmt -f '-------','------','------','------------') -ForegroundColor DarkGray
    $bC  = if ($r.BackendCommit) { $r.BackendCommit } else { '-' }
    $bA  = if ($null -ne $r.BackendAgeDays) { [string]$r.BackendAgeDays } else { '-' }
    $bWT = if ($r.BackendIsLastKnown) { 'last_known (no live)' } else { '-' }
    $pC  = if ($r.ProductCommit) { $r.ProductCommit } else { '-' }
    $pA  = if ($null -ne $r.ProductAgeDays) { [string]$r.ProductAgeDays } else { '-' }
    $pWT = if ($null -eq $r.ProductWorkingClean) { 'unknown' } elseif ($r.ProductWorkingClean) { 'clean' } else { 'DIRTY' }
    $aC  = if ($r.AdminCommit) { $r.AdminCommit } else { '-' }
    $aA  = if ($null -ne $r.AdminAgeDays) { [string]$r.AdminAgeDays } else { '-' }
    $aWT = if ($null -eq $r.AdminWorkingClean) { 'unknown' } elseif ($r.AdminWorkingClean) { 'clean' } else { 'DIRTY' }
    Write-Host ($fmt -f 'backend',          $bC, $bA, $bWT)
    Write-Host ($fmt -f 'frontend_product', $pC, $pA, $pWT)
    Write-Host ($fmt -f 'frontend_admin',   $aC, $aA, $aWT)

    if ($null -ne $r.BackendBehindOriginMain) {
        Write-Host ""
        Write-Host "Backend esta $($r.BackendBehindOriginMain) commit(s) por detras de origin/main." -ForegroundColor DarkGray
    }

    Write-Host ""
    Write-Host "Severity: $($r.Severity)" -ForegroundColor $color

    if ($r.Reasons -and $r.Reasons.Count -gt 0) {
        Write-Host "Razones:" -ForegroundColor $color
        foreach ($reason in $r.Reasons) {
            Write-Host "  - $reason" -ForegroundColor $color
        }
    }

    if ($r.ContractFilesTouched -and $r.ContractFilesTouched.Count -gt 0) {
        Write-Host ""
        Write-Host "Ficheros del contrato tocados entre backend y frontend:" -ForegroundColor $color
        foreach ($t in $r.ContractFilesTouched) {
            Write-Host ("  - [{0}] {1}" -f $t.surface, $t.file) -ForegroundColor $color
        }
    }
    Write-Host ""
}

# ---------------------------------------------------------------
# Entry point: solo si el script se invoca directamente (no dot-source).
# Si se dot-source, solo expone las funciones publicas.
# ---------------------------------------------------------------

if ($MyInvocation.InvocationName -ne '.' -and $MyInvocation.Line -notmatch '^\s*\.\s') {
    if (-not $Env) {
        Write-Host "Uso: .\check-deploy-drift.ps1 -Env <audit|test|prod> [-ManifestPath <path>]" -ForegroundColor Yellow
        exit 2
    }
    $result = Invoke-DeployDriftCheck -Env $Env -ManifestPath $ManifestPath
    Write-DeployDriftReport -Result $result
    # No salir con codigo distinto de 0 segun severidad: la decision de
    # bloquear la toma el script llamante (Fase 2). Aqui solo informamos.
    exit 0
}
