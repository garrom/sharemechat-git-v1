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
# Helper: Get-WorkingTreeCleanForCode
#   Devuelve $true si el working tree esta limpio EN CODIGO.
#   Excluye ops/deploy-state/*.yaml porque esos ficheros los actualiza
#   el propio paso [5.5/N] del deploy y ensuciarian el flag en cada
#   deploy posterior. La exclusion se aplica con un regex sobre la
#   ruta tal como la emite `git status --porcelain` (paths relativos
#   al repo root con `/`).
# ---------------------------------------------------------------

function Get-WorkingTreeCleanForCode {
    [CmdletBinding()]
    param()
    $repoRoot = _Resolve-RepoRoot
    Push-Location $repoRoot
    try {
        $prev = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            $porcelain = & git status --porcelain 2>$null
        } finally {
            $ErrorActionPreference = $prev
        }
        if (-not $porcelain) { return $true }
        $codeDirty = @()
        foreach ($line in $porcelain) {
            # Formato: 'XY path' (X=staged, Y=working tree). path empieza en col 4.
            if ($line.Length -lt 4) { continue }
            $p = $line.Substring(3).Trim()
            # Quitar `prefix -> ` de renombrados
            if ($p -match ' -> ') { $p = $p -replace '^.* -> ', '' }
            if ($p -match '^sharemechat-v1/ops/deploy-state/[^/]+\.yaml$') { continue }
            $codeDirty += $p
        }
        return ($codeDirty.Count -eq 0)
    } finally {
        Pop-Location
    }
}

# ---------------------------------------------------------------
# Funcion publica: Invoke-DeployCandidateDriftCheck
#   Compara el commit CANDIDATO a desplegar (HEAD del repo, para el
#   surface indicado) contra el backend ya desplegado segun el
#   manifest del entorno. Pensada para que la llame deploy-frontend.ps1
#   en su paso [0.5/N] pre-deploy.
# ---------------------------------------------------------------

function Invoke-DeployCandidateDriftCheck {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('audit', 'test', 'prod')]
        [string]$Env,

        [Parameter(Mandatory = $true)]
        [ValidateSet('product', 'admin')]
        [string]$Surface,

        [Parameter(Mandatory = $true)]
        [string]$CandidateCommitShort,

        [Parameter(Mandatory = $false)]
        [Nullable[bool]]$CandidateWorkingTreeClean,

        [Parameter(Mandatory = $false)]
        [string]$ManifestPath
    )

    _Ensure-Yaml
    $manifestFile = _Resolve-ManifestPath -Env $Env -Override $ManifestPath
    $raw = Get-Content $manifestFile -Raw
    $m = ConvertFrom-Yaml $raw

    # Refrescar origin/main para anotar cuanto va por detras el backend.
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

    $backendCommit = [string]$m.backend.git_commit_short
    $backendAge    = _Age-Days $m.backend.deployed_at
    $backendMethod = [string]$m.backend.verification.method
    $isLastKnown   = $backendMethod -like 'last_known_*'

    # El OTRO surface frontend del manifest (no el candidato) se anota
    # solo a titulo informativo en el reporte; no afecta la severidad
    # del candidato.
    $otherSurfaceKey = if ($Surface -eq 'product') { 'frontend_admin' } else { 'frontend_product' }
    $otherCommit = [string]$m.$otherSurfaceKey.git_commit_short
    $otherAge    = _Age-Days $m.$otherSurfaceKey.deployed_at

    $severity = 'OK'
    $reasons = New-Object System.Collections.Generic.List[string]
    $criticalContract = @()

    # 1) Backend == candidato? OK directo.
    $sameCommit = ($backendCommit -and $CandidateCommitShort -and
                   ($backendCommit -eq $CandidateCommitShort))
    if (-not $sameCommit) {
        $severity = 'INFO'
        $reasons.Add("backend (${backendCommit}) != candidato a desplegar ($CandidateCommitShort).")
    }

    # 2) Backend edad > 24h / > 72h
    if ($null -ne $backendAge) {
        if ($backendAge -gt 3) {
            if ($severity -in @('OK','INFO','WARN')) { $severity = 'ALERT' }
            $reasons.Add("backend desplegado hace ${backendAge}d (>72h).")
        } elseif ($backendAge -gt 1) {
            if ($severity -in @('OK','INFO')) { $severity = 'WARN' }
            $reasons.Add("backend desplegado hace ${backendAge}d (>24h).")
        }
    }

    # 3) Working tree del candidato sucio -> WARN
    if ($null -ne $CandidateWorkingTreeClean -and -not $CandidateWorkingTreeClean) {
        if ($severity -in @('OK','INFO')) { $severity = 'WARN' }
        $reasons.Add("working tree del repo SUCIO al construir (cambios de codigo sin commitear).")
    }

    # 4) Backend por detras del candidato? Si toca contrato -> CRITICAL.
    if ($backendCommit -and $CandidateCommitShort -and $backendCommit -ne $CandidateCommitShort) {
        $isAnc = _Is-Ancestor -CommitA $backendCommit -CommitB $CandidateCommitShort
        if ($isAnc -eq $true) {
            if ($severity -in @('OK','INFO','WARN')) { $severity = 'ALERT' }
            $reasons.Add("backend ($backendCommit) esta POR DETRAS del candidato ($CandidateCommitShort).")
            $touched = _Contract-Files-Touched -From $backendCommit -To $CandidateCommitShort
            if ($touched.Count -gt 0) {
                $severity = 'CRITICAL'
                foreach ($t in $touched) { $criticalContract += @{ surface = "frontend_$Surface"; file = $t } }
                $reasons.Add("Entre backend y candidato se tocaron ficheros del contrato: $($touched -join ', ').")
            }
        } elseif ($isAnc -eq $false) {
            # Candidato esta por detras o son ramas divergentes.
            if ($severity -in @('OK','INFO','WARN')) { $severity = 'ALERT' }
            $reasons.Add("candidato ($CandidateCommitShort) NO contiene el commit del backend ($backendCommit); el deploy regresaria codigo frente al backend actual.")
        }
    }

    # 5) Modo last_known del backend -> WARN minimo.
    if ($isLastKnown) {
        if ($severity -in @('OK','INFO')) { $severity = 'WARN' }
        $reasons.Add("backend.verification.method='$backendMethod' (sin verificacion en vivo; dato del backend es la ultima informacion conocida).")
    }

    # 6) Cuanto va por detras del origin/main el backend (informativo).
    $behindOriginMain = $null
    if ($originMain -and $backendCommit) {
        $cnt = _Git @('rev-list', '--count', "$backendCommit..$originMain")
        if ($cnt) { $behindOriginMain = [int]$cnt }
    }

    return [PSCustomObject]@{
        Env                       = $Env
        Surface                   = $Surface
        ManifestFile              = $manifestFile
        OriginMain                = $originMain
        FetchOk                   = $fetchOk
        Severity                  = $severity
        Reasons                   = $reasons.ToArray()
        BackendCommit             = $backendCommit
        BackendAgeDays            = $backendAge
        BackendIsLastKnown        = $isLastKnown
        BackendBehindOriginMain   = $behindOriginMain
        CandidateCommit           = $CandidateCommitShort
        CandidateWorkingTreeClean = $CandidateWorkingTreeClean
        OtherSurfaceKey           = $otherSurfaceKey
        OtherSurfaceCommit        = $otherCommit
        OtherSurfaceAgeDays       = $otherAge
        ContractFilesTouched      = $criticalContract
    }
}

# ---------------------------------------------------------------
# Render CLI del reporte CANDIDATO
# ---------------------------------------------------------------

function Write-DeployCandidateDriftReport {
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
    Write-Host "=== Drift pre-deploy: $($r.Env.ToUpper()) / frontend_$($r.Surface) ===" -ForegroundColor $color
    Write-Host "Manifest:       $($r.ManifestFile)"
    if ($r.FetchOk) {
        Write-Host "origin/main:    $($r.OriginMain)"
    } else {
        Write-Host "origin/main:    $($r.OriginMain) (fetch fallo; usando referencia local)"
    }
    Write-Host ""

    $fmt = "{0,-30} {1,-12} {2,-10} {3,-22}"
    Write-Host ($fmt -f 'surface','commit','age(d)','working-tree') -ForegroundColor DarkGray
    Write-Host ($fmt -f '-------','------','------','------------') -ForegroundColor DarkGray
    $bC  = if ($r.BackendCommit) { $r.BackendCommit } else { '-' }
    $bA  = if ($null -ne $r.BackendAgeDays) { [string]$r.BackendAgeDays } else { '-' }
    $bWT = if ($r.BackendIsLastKnown) { 'last_known (no live)' } else { '-' }
    $oC  = if ($r.OtherSurfaceCommit) { $r.OtherSurfaceCommit } else { '-' }
    $oA  = if ($null -ne $r.OtherSurfaceAgeDays) { [string]$r.OtherSurfaceAgeDays } else { '-' }
    $cC  = if ($r.CandidateCommit) { $r.CandidateCommit } else { '-' }
    $cWT = if ($null -eq $r.CandidateWorkingTreeClean) { 'unknown' } elseif ($r.CandidateWorkingTreeClean) { 'clean' } else { 'DIRTY' }
    Write-Host ($fmt -f 'backend (desplegado)',        $bC, $bA, $bWT)
    Write-Host ($fmt -f "$($r.OtherSurfaceKey) (desplegado)", $oC, $oA, '-')
    Write-Host ($fmt -f "frontend_$($r.Surface) (CANDIDATO)", $cC, '-', $cWT)

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
        Write-Host "Ficheros del contrato tocados entre backend desplegado y candidato:" -ForegroundColor $color
        foreach ($t in $r.ContractFilesTouched) {
            Write-Host ("  - [{0}] {1}" -f $t.surface, $t.file) -ForegroundColor $color
        }
    }
    Write-Host ""
}

# ---------------------------------------------------------------
# Helper: Update-DeployStateManifest
#   Actualiza el manifest del entorno para un surface frontend tras
#   un deploy exitoso. SOLO escribe el fichero; no hace commit. El
#   operador commitea cuando le va bien (decision D2).
# ---------------------------------------------------------------

function Update-DeployStateManifest {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('audit', 'test', 'prod')]
        [string]$Env,

        [Parameter(Mandatory = $true)]
        [ValidateSet('product', 'admin')]
        [string]$Surface,

        [Parameter(Mandatory = $true)]
        [string]$Bundle,

        [Parameter(Mandatory = $false)]
        [string]$BundleSha256,

        [Parameter(Mandatory = $true)]
        [string]$GitCommitFull,

        [Parameter(Mandatory = $true)]
        [string]$GitCommitShort,

        [Parameter(Mandatory = $true)]
        [bool]$WorkingTreeClean,

        [Parameter(Mandatory = $true)]
        [string]$DeployedBy,

        [Parameter(Mandatory = $true)]
        [string]$Bucket,

        [Parameter(Mandatory = $true)]
        [string]$CloudfrontDistribution,

        [Parameter(Mandatory = $false)]
        [string]$CloudfrontInvalidationId
    )

    _Ensure-Yaml
    $manifestFile = _Resolve-ManifestPath -Env $Env
    $raw = Get-Content $manifestFile -Raw
    $m = ConvertFrom-Yaml $raw

    $surfaceKey = "frontend_$Surface"
    $now = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

    $m.last_updated_at = $now
    $m.last_update_by  = $DeployedBy
    $m.last_update_source = 'deploy-frontend.ps1-fase1-paso2a'

    if (-not $m.$surfaceKey) {
        throw ("Manifest no contiene bloque {0}: {1}" -f $surfaceKey, $manifestFile)
    }
    $m.$surfaceKey.bundle = $Bundle
    if ($BundleSha256) {
        $m.$surfaceKey.bundle_sha256 = $BundleSha256
    } elseif (-not ($m.$surfaceKey.PSObject.Properties.Match('bundle_sha256').Count -gt 0)) {
        # No habia campo; lo dejamos ausente.
    }
    $m.$surfaceKey.git_commit_short = $GitCommitShort
    $m.$surfaceKey.git_commit = $GitCommitFull
    $m.$surfaceKey.built_at = $now      # built_at ~ deployed_at en este flujo
    $m.$surfaceKey.deployed_at = $now
    $m.$surfaceKey.deployed_by = $DeployedBy
    $m.$surfaceKey.working_tree_clean = $WorkingTreeClean
    $m.$surfaceKey.bucket = $Bucket
    $m.$surfaceKey.cloudfront_distribution = $CloudfrontDistribution
    $m.$surfaceKey.cloudfront_invalidation_id = $CloudfrontInvalidationId

    # verification: marca el origen del dato.
    if (-not $m.$surfaceKey.verification) {
        $m.$surfaceKey.verification = @{}
    }
    $m.$surfaceKey.verification.method = "deploy-frontend.ps1-live-build_$now"
    $m.$surfaceKey.verification.git_commit_provenance = 'recorded_by_deploy_script'
    $m.$surfaceKey.verification.notes = "Actualizado automaticamente por deploy-frontend.ps1 (Fase 1 paso 2a) tras smoke OK del propio script."

    # Conservar el resto del fichero. ConvertTo-Yaml puede reordenar
    # claves; aceptable porque el manifest es legible y autodescriptivo.
    $newYaml = ConvertTo-Yaml $m
    # Encabezado para indicar que el fichero esta auto-gestionado.
    $header = @(
        "# Manifest de estado de despliegue - entorno $($Env.ToUpper())"
        "# Schema v1. Auto-gestionado por deploy-frontend.ps1 (Fase 1"
        "# paso 2a). El paso [5.5/N] de cada deploy escribe el bloque"
        "# correspondiente al surface desplegado tras smoke OK. NO se"
        "# hace commit automatico: el operador commitea el manifest"
        "# cuando le conviene (decision D2)."
        "#"
    ) -join "`n"
    Set-Content -Path $manifestFile -Value ($header + "`n" + $newYaml) -Encoding UTF8

    return [PSCustomObject]@{
        ManifestFile = $manifestFile
        Surface      = $Surface
        UpdatedAt    = $now
    }
}

# ---------------------------------------------------------------
# Helper: Update-DeployStateManifestBackend
#   Actualiza la seccion `backend` del manifest del entorno tras un
#   deploy manual del backend (scp + restart). Pensada para invocarse
#   desde update-manifest-backend.ps1 (Fase 1 paso 2b, opcion B).
#   SOLO escribe el fichero; no commitea (decision D2).
# ---------------------------------------------------------------

function Update-DeployStateManifestBackend {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('audit', 'test', 'prod')]
        [string]$Env,

        # Permite registrar $null (sin sha disponible) en lugar de fallar.
        [Parameter(Mandatory = $false)]
        [AllowNull()][AllowEmptyString()]
        [string]$JarSha256,

        [Parameter(Mandatory = $true)]
        [string]$GitCommitFull,

        [Parameter(Mandatory = $true)]
        [string]$GitCommitShort,

        [Parameter(Mandatory = $true)]
        [bool]$WorkingTreeClean,

        [Parameter(Mandatory = $true)]
        [string]$DeployedBy,

        [Parameter(Mandatory = $false)]
        [string]$VerificationMethod = 'manual_via_update-manifest-backend.ps1',

        [Parameter(Mandatory = $false)]
        [string]$VerificationNotes
    )

    _Ensure-Yaml
    $manifestFile = _Resolve-ManifestPath -Env $Env
    $raw = Get-Content $manifestFile -Raw
    $m = ConvertFrom-Yaml $raw

    $now = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

    $m.last_updated_at = $now
    $m.last_update_by  = $DeployedBy
    $m.last_update_source = 'update-manifest-backend.ps1-fase1-paso2b'

    if (-not $m.backend) {
        throw ("Manifest no contiene bloque backend: {0}" -f $manifestFile)
    }
    $m.backend.jar_sha256       = $JarSha256
    $m.backend.git_commit_short = $GitCommitShort
    $m.backend.git_commit       = $GitCommitFull
    $m.backend.built_at         = $now
    $m.backend.deployed_at      = $now
    $m.backend.deployed_by      = $DeployedBy
    $m.backend.working_tree_clean = $WorkingTreeClean

    if (-not $m.backend.verification) { $m.backend.verification = @{} }
    $m.backend.verification.method      = $VerificationMethod
    $m.backend.verification.verified_at = $now
    if ($VerificationNotes) {
        $m.backend.verification.notes = $VerificationNotes
    } else {
        $m.backend.verification.notes = (
            "Actualizado manualmente por update-manifest-backend.ps1 (Fase 1 paso 2b) " +
            "tras deploy manual del backend (scp + restart). Limitacion conocida: HEAD " +
            "asume = commit con el que se construyo el JAR; sin endpoint /api/health/version " +
            "(Fase 2) no hay verificacion viva del commit del backend."
        )
    }

    $newYaml = ConvertTo-Yaml $m
    $header = @(
        "# Manifest de estado de despliegue - entorno $($Env.ToUpper())"
        "# Schema v1. Seccion backend actualizada por update-manifest-backend.ps1"
        "# (Fase 1 paso 2b, opcion B). El script lo invoca el operador tras un"
        "# deploy manual del backend (scp + restart). NO se hace commit"
        "# automatico: el operador commitea cuando le conviene (decision D2)."
        "#"
    ) -join "`n"
    Set-Content -Path $manifestFile -Value ($header + "`n" + $newYaml) -Encoding UTF8

    return [PSCustomObject]@{
        ManifestFile = $manifestFile
        UpdatedAt    = $now
    }
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
