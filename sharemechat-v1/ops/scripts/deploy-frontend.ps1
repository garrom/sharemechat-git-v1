<#
.SYNOPSIS
    Despliega un frontend (producto o admin) de SharemeChat al S3+CloudFront del
    entorno indicado, con blindaje contra los modos de fallo conocidos.

.DESCRIPTION
    Lee la tabla de mapeo en ~/.sharemechat/state-mapping.yaml, resuelve bucket S3
    y distribución CloudFront según entorno+superficie, construye el frontend con
    el script CRA correspondiente, sube al bucket y crea invalidación de cache.

    Blindajes (rev 2026-06: post-incidente de bucket vaciado por solapamiento
    product/admin en deploy paralelo sobre la misma carpeta build/):

      1) Lock file en frontend/.deploy.lock para impedir DOS invocaciones
         concurrentes que compartan la carpeta build/. Si el lock existe al
         arrancar, abort con mensaje claro (deja al operador decidir si es
         huerfano y borrarlo).
      2) Carpeta de salida del build POR SUPERFICIE (build-product/, build-admin/)
         via env BUILD_PATH de CRA, limpiada por completo antes de cada build.
         Cualquier invocacion futura del CRA escribira a su carpeta exclusiva
         y no podra pisar a una invocacion concurrente.
      3) Smoke test estatico OBLIGATORIO post-sync, con abort si cualquier check
         falla: GET https://<alias>/ -> 200 + text/html + tamano razonable;
         extraer el main.[hash].js referenciado en index.html; confirmar que
         el hash existe en s3://<bucket>/static/js/ via aws s3 ls; GET del
         bundle por su URL hashed -> 200 + tamano > 0. Estos checks no dependen
         de la invalidacion de CloudFront porque van por URL hashed inmutable
         (CloudFront no las tiene cacheadas si son nuevas).
      4) Smoke test funcional CONDICIONAL al modo operacional: si el backend
         no responde (TEST apagado, mantenimiento), se salta con aviso y NO
         bloquea el deploy. Si el backend responde y la cabecera X-Product-Mode
         dice PRELAUNCH, verifica que POST /api/auth/login NO devuelva 503
         (gate de auth abierto en PRELAUNCH) y POST /api/models/documents SI
         devuelva 503 con X-Product-Mode=PRELAUNCH (cierre de docs).

    Los blindajes son parametrizables por entorno (mismo script vale para TEST,
    AUDIT y PROD; el comportamiento solo difiere en lo que el modo operacional
    de cada entorno dicte).

.PARAMETER Environment
    Identificador del entorno: test, audit o prod. Coincide con el nombre
    del nodo en environments.<env> del state-mapping.yaml.

.PARAMETER Surface
    Superficie a desplegar: product (frontend público) o admin (backoffice).

.PARAMETER SkipBuild
    Si se especifica, saltar el paso de build (asume build-<surface>/ ya existe).

.PARAMETER DryRun
    Si se especifica, mostrar qué comandos se ejecutarían sin ejecutarlos.

.PARAMETER SkipFunctionalSmoke
    Si se especifica, saltar el smoke test funcional aunque el backend este
    accesible. Util en deploys de PROD durante ventanas en las que el modo
    operacional no es estable.

.PARAMETER BackendProbeTimeoutSec
    Timeout (segundos) para detectar si el backend esta accesible. Default 5.

.PARAMETER StandbyMode
    Modo "bundle en standby": el bucket destino del sync existe pero AUN NO es
    el origin vivo de la distribucion CloudFront resuelta por el mapping (caso
    PROD pre-switch-publico: sharemechat-frontend-prod ya tiene un bundle pero
    sharemechat.com sigue cableado a la landing legacy).

    Cambios respecto al modo normal:
      - Smoke estatico: en lugar de GET https://<alias>/... (que iria al origin
        equivocado), se verifica con aws s3api head-object que index.html y el
        main.<hash>.js esten en el bucket destino. Sigue siendo OBLIGATORIO y
        sigue abortando si falla.
      - Invalidacion CloudFront: SE SALTA. Invalidar una distribucion cuyo
        origin no es este bucket es ruido (consume cuota sin efecto util sobre
        el contenido nuevo subido aqui).
      - Smoke funcional: SE SALTA siempre (no hay dominio publico desde el que
        sondear el backend a traves de este bundle todavia).

    El resto del blindaje queda intacto: lock, build-<surface>/ aislado,
    rm -rf previo, abort-on-error. Cuando llegue el dia del switch (origin de
    CF apunte al bucket SPA), se vuelve al modo normal sin tocar el script.

.EXAMPLE
    .\deploy-frontend.ps1 test product

    Despliega el frontend producto a TEST con todos los blindajes activos.

.EXAMPLE
    .\deploy-frontend.ps1 test admin -DryRun

    Muestra qué se ejecutaría para desplegar admin a TEST sin ejecutar nada.

.EXAMPLE
    .\deploy-frontend.ps1 prod product -StandbyMode

    Despliega el frontend producto a sharemechat-frontend-prod mientras
    sharemechat.com sigue sirviendo la landing legacy. Smoke estatico contra
    el bucket directamente (head-object), sin invalidacion CF.

.NOTES
    Requiere:
      - ~/.sharemechat/state-mapping.yaml con bloque del entorno relleno
        (cloudfront_distributions y s3_buckets)
      - aws CLI configurado con permisos s3:PutObject* y cloudfront:CreateInvalidation
      - npm en PATH y carpeta frontend/ con scripts build:product y build:admin
      - powershell-yaml module (se instala on demand si falta)
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('test', 'audit', 'prod')]
    [string]$Environment,

    [Parameter(Mandatory = $true, Position = 1)]
    [ValidateSet('product', 'admin')]
    [string]$Surface,

    [Parameter(Mandatory = $false)]
    [switch]$SkipBuild,

    [Parameter(Mandatory = $false)]
    [switch]$DryRun,

    [Parameter(Mandatory = $false)]
    [switch]$SkipFunctionalSmoke,

    [Parameter(Mandatory = $false)]
    [int]$BackendProbeTimeoutSec = 5,

    [Parameter(Mandatory = $false)]
    [switch]$StandbyMode,

    # ---- Fase 1 paso 2a: integracion del check de drift ----
    # Salta el paso [0.5/N] entero. Util para reparaciones conscientes
    # (revert de un deploy roto, primera puesta a punto del manifest, etc).
    [Parameter(Mandatory = $false)]
    [switch]$SkipDriftCheck,

    # En severidad CRITICAL, aborta con codigo de salida 1 sin prompt
    # interactivo. Pensado para automatizacion futura (CI/cron). En
    # severidad <= ALERT no afecta.
    [Parameter(Mandatory = $false)]
    [switch]$Strict,

    # Permite construir/desplegar con el arbol de CODIGO sucio (cambios
    # sin commitear) de forma consciente. Sin el flag, el [0.5] avisa
    # WARN y pide confirmacion [s/n]. En AUDIT se usa con frecuencia
    # (testing puntual sin commit); en TEST/PROD deberia ser raro.
    [Parameter(Mandatory = $false)]
    [switch]$AllowDirtyWorkingTree
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------

function Write-Step {
    param([string]$Number, [string]$Label)
    Write-Host ""
    Write-Host "[$Number] $Label" -ForegroundColor Cyan
}

function Stop-Deploy {
    param([string]$Message)
    Write-Host ""
    Write-Error "DEPLOY ABORT: $Message"
    exit 1
}

function Invoke-Native {
    <#
    Ejecuta un comando externo (npm, aws, etc) preservando streaming de stdout
    + stderr, sin que PowerShell aborte por warnings escritos a stderr aunque
    el comando devuelva exit code 0. Verifica $LASTEXITCODE y aborta el deploy
    si distinto de 0.

    Necesario porque en Windows PowerShell 5.1 (NO en pwsh 7) cualquier escritura
    a stderr de un native exe se convierte en NativeCommandError, que con
    $ErrorActionPreference = 'Stop' termina el script aun cuando el exe haya
    devuelto 0. Es el caso clasico de CRA volcando warnings ESLint a stderr.
    #>
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Block,

        [Parameter(Mandatory = $true)]
        [string]$Label
    )
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $exit = 0
    try {
        & $Block
        $exit = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prevEAP
    }
    if ($null -eq $exit) { $exit = 0 }
    if ($exit -ne 0) {
        Stop-Deploy "$Label fallo con codigo $exit"
    }
}

function Get-HttpResponseInfo {
    <#
    Devuelve un PSCustomObject con StatusCode, ContentType, ContentLength y
    Header X-Product-Mode si esta presente. Soporta tanto exitos como errores
    HTTP (4xx/5xx) sin lanzar excepcion al caller.
    #>
    param(
        [string]$Url,
        [string]$Method = 'GET',
        [string]$ContentType = $null,
        [string]$Body = $null,
        [int]$TimeoutSec = 10
    )

    $statusCode = 0
    $respContentType = $null
    $contentLength = 0
    $productMode = $null
    $reachable = $true
    $errMsg = $null

    try {
        $params = @{
            Uri              = $Url
            Method           = $Method
            UseBasicParsing  = $true
            TimeoutSec       = $TimeoutSec
            ErrorAction      = 'Stop'
        }
        if ($ContentType) { $params.ContentType = $ContentType }
        if ($Body)        { $params.Body        = $Body }

        $resp = Invoke-WebRequest @params

        $statusCode      = [int]$resp.StatusCode
        $respContentType = $resp.Headers.'Content-Type'
        if ($resp.RawContentLength -gt 0) {
            $contentLength = [int]$resp.RawContentLength
        } elseif ($resp.Content) {
            $contentLength = $resp.Content.Length
        }
        if ($resp.Headers.'X-Product-Mode') {
            $productMode = $resp.Headers.'X-Product-Mode'
        }
    } catch {
        $ex = $_.Exception
        if ($ex.Response) {
            # Backend respondio con error HTTP (4xx/5xx). Aun asi extraemos
            # el codigo y los headers para los smoke tests.
            try {
                $statusCode = [int]$ex.Response.StatusCode
            } catch { $statusCode = 0 }

            try { $respContentType = $ex.Response.Headers['Content-Type'] } catch {}
            try {
                $cl = $ex.Response.Headers['Content-Length']
                if ($cl) { $contentLength = [int]$cl }
            } catch {}
            try { $productMode = $ex.Response.Headers['X-Product-Mode'] } catch {}
        } else {
            # Sin Response = error de red, timeout, DNS, conexion rechazada.
            $reachable = $false
            $errMsg    = $ex.Message
        }
    }

    return [PSCustomObject]@{
        Url           = $Url
        Reachable     = $reachable
        StatusCode    = $statusCode
        ContentType   = $respContentType
        ContentLength = $contentLength
        ProductMode   = $productMode
        Error         = $errMsg
    }
}

# ---------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------

Write-Step "0/5" "Pre-flight"

$repoRoot     = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$frontendDir  = Join-Path $repoRoot 'frontend'
$mappingPath  = Join-Path $HOME '.sharemechat\state-mapping.yaml'

if (-not (Test-Path $mappingPath)) {
    Stop-Deploy "No se encuentra $mappingPath"
}

if (-not (Test-Path $frontendDir)) {
    Stop-Deploy "No se encuentra carpeta frontend en $frontendDir"
}

# Carpeta de salida del build EXCLUSIVA por superficie. Evita que dos
# invocaciones concurrentes (caso historico del incidente) compartan build/.
# CRA respeta env BUILD_PATH (relativo a la cwd del build).
$buildDirName = "build-$Surface"
$buildDir     = Join-Path $frontendDir $buildDirName
$indexHtml    = Join-Path $buildDir 'index.html'

Write-Host "    repoRoot:    $repoRoot"
Write-Host "    frontendDir: $frontendDir"
Write-Host "    buildDir:    $buildDir"
Write-Host "    mappingPath: $mappingPath"

# Lock file: tercer cinturón contra paralelos. Si dos invocaciones lanzan
# CRA a la vez, una pierde la pugna por la carpeta. El lock aborta la
# segunda inmediatamente con mensaje claro.
$lockFile = Join-Path $frontendDir ".deploy.lock"
if (Test-Path $lockFile) {
    $age = (Get-Date) - (Get-Item $lockFile).LastWriteTime
    Stop-Deploy "Lock file existe en $lockFile (creado hace $([int]$age.TotalSeconds)s). Otra invocacion en curso. Si crees que es huerfano, borra el fichero manualmente."
}

if (-not (Get-Module -ListAvailable -Name powershell-yaml)) {
    Write-Host "    Instalando modulo powershell-yaml..."
    Install-Module -Name powershell-yaml -Scope CurrentUser -Force -ErrorAction Stop
}
Import-Module powershell-yaml

$mapping = Get-Content $mappingPath -Raw | ConvertFrom-Yaml

if (-not $mapping.environments.$Environment) {
    Stop-Deploy "Entorno '$Environment' no existe en el mapping."
}

$envBlock = $mapping.environments.$Environment

# Resolver bucket S3 + distribución CloudFront según surface
$bucketLogicalName       = if ($Surface -eq 'product') { 'frontend_product' } else { 'frontend_admin' }
$distributionLogicalName = if ($Surface -eq 'product') { 'frontend_public'   } else { 'backoffice_admin' }

$bucketEntry = $envBlock.s3_buckets.$bucketLogicalName
if (-not $bucketEntry) {
    Stop-Deploy "Bucket '$bucketLogicalName' no encontrado en mapping para '$Environment'."
}
$bucketName = $bucketEntry.name

$distributionEntry = $envBlock.cloudfront_distributions.$distributionLogicalName
if (-not $distributionEntry) {
    Stop-Deploy "Distribucion '$distributionLogicalName' no encontrada en mapping para '$Environment'."
}
$distributionId = $distributionEntry.id
# En el mapping local, 'alias' es un nombre humano legible y 'domains' es la
# lista de FQDNs de la distribucion. Tomamos el primero como dominio canonico
# del entorno para los smoke tests.
$distributionAlias = $distributionEntry.alias
$distributionDomains = $distributionEntry.domains
$primaryDomain = $null
if ($distributionDomains -and $distributionDomains.Count -gt 0) {
    $primaryDomain = [string]$distributionDomains[0]
}

if ([string]::IsNullOrWhiteSpace($bucketName) -or [string]::IsNullOrWhiteSpace($distributionId)) {
    Stop-Deploy "Mapping incompleto. bucket='$bucketName' dist='$distributionId'"
}

if ([string]::IsNullOrWhiteSpace($primaryDomain)) {
    Stop-Deploy "Mapping no expone 'domains[0]' para '$distributionLogicalName' en '$Environment'. Necesario para smoke tests."
}

$baseUrl = "https://$primaryDomain"

$buildScript = if ($Surface -eq 'product') { 'build:product' } else { 'build:admin' }

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host " Deploy frontend $Surface -> $($Environment.ToUpper())" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host " Surface:        $Surface"
Write-Host " Build script:   npm run $buildScript"
Write-Host " Build out dir:  $buildDirName/ (BUILD_PATH per-surface)"
Write-Host " Bucket S3:      s3://$bucketName/"
Write-Host " Distribucion:   $distributionId ($distributionAlias)"
Write-Host " Dominio canon:  $primaryDomain"
Write-Host " SkipBuild:      $SkipBuild"
Write-Host " DryRun:         $DryRun"
Write-Host " SkipFunctional: $SkipFunctionalSmoke"
Write-Host " SkipDriftCheck: $SkipDriftCheck"
Write-Host " Strict:         $Strict"
Write-Host " AllowDirty:     $AllowDirtyWorkingTree"
Write-Host ""

# ---------------------------------------------------------------
# [0.5/N] Check de drift pre-deploy (Fase 1 paso 2a)
# ---------------------------------------------------------------
# Compara el commit del repo (HEAD) con el backend ya desplegado en el
# entorno, segun ops/deploy-state/<env>.yaml. Si entre ambos se tocaron
# ficheros del contrato y el backend esta por detras, severidad
# CRITICAL: pide confirmacion tipeada ('yes' literal) salvo -Strict
# (que aborta con exit 1). WARN/ALERT piden [s/n] (default n).
#
# El working_tree_clean se calcula EXCLUYENDO ops/deploy-state/*.yaml:
# esos ficheros los actualiza el paso [5.5/N] del propio deploy y
# ensuciarian el flag en cada deploy posterior. La exclusion la hace
# Get-WorkingTreeCleanForCode dentro de check-deploy-drift.ps1.
#
# Saltable con -SkipDriftCheck. NO afecta la logica original [1/5]..[5/5].

if (-not $SkipDriftCheck) {
    Write-Step "0.5/N" "Check de drift pre-deploy (frontend_$Surface vs backend desplegado en $Environment)"

    # Dot-source del check para reusar logica sin duplicar.
    . (Join-Path $PSScriptRoot 'check-deploy-drift.ps1')

    # HEAD del repo y working_tree_clean en CODIGO (excluye manifest).
    $candidateFullPrev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $candidateFull  = (& git rev-parse HEAD 2>$null).Trim()
        $candidateShort = (& git rev-parse --short HEAD 2>$null).Trim()
    } finally {
        $ErrorActionPreference = $candidateFullPrev
    }
    if (-not $candidateShort) {
        Stop-Deploy "No se pudo resolver HEAD del repo (git rev-parse). Si es deliberado, usa -SkipDriftCheck."
    }
    $wtClean = Get-WorkingTreeCleanForCode

    if (-not $wtClean -and -not $AllowDirtyWorkingTree) {
        Write-Host "    Working tree de CODIGO SUCIO (cambios sin commitear fuera de ops/deploy-state/)." -ForegroundColor Yellow
        Write-Host "    Sin -AllowDirtyWorkingTree, el commit que registramos en el manifest no representara" -ForegroundColor Yellow
        Write-Host "    fielmente lo desplegado. Considera commitear primero, o pasa -AllowDirtyWorkingTree" -ForegroundColor Yellow
        Write-Host "    (es comun en AUDIT para probar cambios sin commit; en TEST/PROD deberia ser raro)." -ForegroundColor Yellow
    }

    $candidateClean = if ($AllowDirtyWorkingTree) { $wtClean } else { $wtClean }

    $driftResult = Invoke-DeployCandidateDriftCheck `
        -Env $Environment `
        -Surface $Surface `
        -CandidateCommitShort $candidateShort `
        -CandidateWorkingTreeClean $candidateClean

    Write-DeployCandidateDriftReport -Result $driftResult

    switch ($driftResult.Severity) {
        'OK'   { Write-Host "    OK - sin drift detectado. Continuando." -ForegroundColor Green }
        'INFO' { Write-Host "    INFO - drift menor; sin riesgo de contrato. Continuando." -ForegroundColor Cyan }
        'WARN' {
            if ($DryRun) {
                Write-Host "    [DryRun] severity WARN; en deploy real se pediria confirmacion [s/n]." -ForegroundColor Yellow
            } else {
                $ans = Read-Host "Severity WARN. Continuar el deploy? [s/N]"
                if ($ans -notmatch '^(s|si|y|yes)$') {
                    Stop-Deploy "Abortado por el operador tras WARN."
                }
            }
        }
        'ALERT' {
            if ($Strict) {
                Stop-Deploy "Severity ALERT en modo -Strict. Aborto sin prompt."
            } elseif ($DryRun) {
                Write-Host "    [DryRun] severity ALERT; en deploy real se pediria confirmacion [s/n] (default N)." -ForegroundColor DarkYellow
            } else {
                $ans = Read-Host "Severity ALERT (drift sustancial detectado). Continuar el deploy? [s/N]"
                if ($ans -notmatch '^(s|si|y|yes)$') {
                    Stop-Deploy "Abortado por el operador tras ALERT."
                }
            }
        }
        'CRITICAL' {
            Write-Host ""
            Write-Host "    *** SEVERITY CRITICAL ***" -ForegroundColor Red
            Write-Host "    Se han detectado cambios en ficheros del contrato entre el backend" -ForegroundColor Red
            Write-Host "    desplegado y el commit a desplegar. Si continuas, el frontend nuevo" -ForegroundColor Red
            Write-Host "    podria leer campos/lecturas del API que el backend no provee, con" -ForegroundColor Red
            Write-Host "    riesgo de pantallas rotas (como el incidente del 2026-06-08 en AUDIT)." -ForegroundColor Red
            Write-Host ""
            if ($Strict) {
                Stop-Deploy "Severity CRITICAL en modo -Strict. Aborto sin prompt."
            } elseif ($DryRun) {
                Write-Host "    [DryRun] severity CRITICAL; en deploy real se exigiria escribir 'yes' literal para continuar." -ForegroundColor Red
            } else {
                $ans = Read-Host "Escribe 'yes' literal para continuar"
                if ($ans -ne 'yes') {
                    Stop-Deploy "Abortado tras CRITICAL (no se escribio 'yes' literal)."
                }
            }
        }
        default { Write-Host "    Severidad desconocida: $($driftResult.Severity). Continuando." -ForegroundColor DarkGray }
    }
}

if ($DryRun) {
    Write-Host ""
    Write-Host "[DryRun] No se ejecutara nada mas. Salida." -ForegroundColor Yellow
    exit 0
}

# Crear lock file y registrar handler de limpieza
New-Item -ItemType File -Path $lockFile -Force | Out-Null

try {

    # -----------------------------------------------------------
    # [1/5] Build con carpeta exclusiva y limpieza previa
    # -----------------------------------------------------------
    Write-Step "1/5" "Build $buildScript -> $buildDirName/"

    if (-not $SkipBuild) {
        # Limpiar la carpeta de salida para garantizar build desde cero.
        # rm -rf build-<surface>/ antes de cada npm run build:* (regla 1).
        if (Test-Path $buildDir) {
            Write-Host "    Limpiando $buildDir ..."
            Remove-Item -Recurse -Force $buildDir
        }

        Push-Location $frontendDir
        try {
            # CRA respeta BUILD_PATH como carpeta de salida del build.
            # Lo seteamos relativo a frontendDir para que el build escriba
            # a build-<surface>/ y no toque la carpeta build/ historica.
            $env:BUILD_PATH = $buildDirName
            try {
                Invoke-Native -Label "npm run $buildScript" -Block {
                    npm run $buildScript
                }
            } finally {
                Remove-Item Env:\BUILD_PATH -ErrorAction SilentlyContinue
            }
        } finally {
            Pop-Location
        }

        if (-not (Test-Path $indexHtml)) {
            Stop-Deploy "Build termino con exito pero no existe $indexHtml. CRA puede haber escrito a otra ruta; revisar variable BUILD_PATH."
        }
    } else {
        Write-Host "    Build saltado (SkipBuild)."
        if (-not (Test-Path $indexHtml)) {
            Stop-Deploy "SkipBuild pero no existe $indexHtml en $buildDirName/. Aborta."
        }
    }

    Write-Host "    OK - $indexHtml existe."

    # -----------------------------------------------------------
    # [2/5] Sync a S3 (+ invalidacion CloudFront salvo en StandbyMode)
    # -----------------------------------------------------------
    if ($StandbyMode) {
        Write-Step "2/5" "Sync s3://$bucketName/ (StandbyMode: SIN invalidacion CF)"
    } else {
        Write-Step "2/5" "Sync s3://$bucketName/ + invalidacion $distributionId"
    }

    Invoke-Native -Label "aws s3 sync" -Block {
        aws s3 sync $buildDir "s3://$bucketName/" --delete --cache-control "public,max-age=31536000,immutable"
    }

    # index.html con cache-control restrictivo (resto del bundle es inmutable por hash).
    Invoke-Native -Label "aws s3 cp index.html" -Block {
        aws s3 cp $indexHtml "s3://$bucketName/index.html" --cache-control "no-cache, no-store, must-revalidate" --content-type "text/html; charset=utf-8"
    }

    # Capturamos el ID de la invalidacion CloudFront para registrarlo
    # en el manifest del paso [5.5/N]. En StandbyMode no hay invalidacion.
    $script:cloudfrontInvalidationId = $null
    if ($StandbyMode) {
        Write-Host "    [skip] invalidacion CF saltada (StandbyMode: la dist $distributionId no sirve este bucket todavia)." -ForegroundColor Yellow
        Write-Host "    OK - sync ejecutado."
    } else {
        $invOutput = $null
        Invoke-Native -Label "aws cloudfront create-invalidation" -Block {
            $script:lastInvalidationOutput = aws cloudfront create-invalidation --distribution-id $distributionId --paths "/*" --output json
            # Devolver tambien al stdout para mantener el log existente.
            $script:lastInvalidationOutput
        }
        if ($script:lastInvalidationOutput) {
            try {
                $joined = ($script:lastInvalidationOutput | Out-String)
                $script:cloudfrontInvalidationId = ($joined | ConvertFrom-Json).Invalidation.Id
            } catch {
                # No es bloqueante: la invalidacion ya se disparo; solo
                # no se podra registrar el ID en el manifest.
                $script:cloudfrontInvalidationId = $null
            }
        }
        Write-Host "    OK - sync + invalidacion ejecutados."
    }

    # -----------------------------------------------------------
    # [3/5] Smoke test estatico (ABORT si falla)
    # -----------------------------------------------------------
    if ($StandbyMode) {
        Write-Step "3/5" "Smoke test estatico (StandbyMode: head-object directo al bucket)"
    } else {
        Write-Step "3/5" "Smoke test estatico ($baseUrl)"
    }

    # 3.1 - Extraer main.[hash].js del index.html local (lo subido es lo mismo
    # que lo construido; el sync ya ha terminado en exito).
    $indexContent = Get-Content $indexHtml -Raw
    if ($indexContent -notmatch '/static/js/main\.([a-f0-9]+)\.js') {
        Stop-Deploy "No se encuentra main.[hash].js dentro de $indexHtml. El index.html generado por CRA es invalido."
    }
    $mainHash    = $matches[1]
    $mainJsKey   = "static/js/main.$mainHash.js"
    $mainJsPath  = "/$mainJsKey"
    Write-Host "    main bundle: $mainJsKey"

    # 3.2 - Confirmar que esa key existe en el bucket (sin caches CloudFront).
    $s3Listing = $null
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $s3Listing = & aws s3 ls "s3://$bucketName/static/js/" 2>$null
        $s3ListExit = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prevEAP
    }
    if ($s3ListExit -ne 0) {
        Stop-Deploy "aws s3 ls s3://$bucketName/static/js/ fallo con codigo $s3ListExit"
    }
    # aws s3 ls devuelve array de lineas; join para -match contra el contenido
    # completo en vez de filtrar el array (semantica distinta).
    $joinedListing = ($s3Listing | Out-String)
    if ($joinedListing -notmatch [regex]::Escape("main.$mainHash.js")) {
        Stop-Deploy "main.$mainHash.js NO esta en s3://$bucketName/static/js/. El sync ha terminado en exito pero el bucket no tiene la key esperada."
    }
    Write-Host "    OK - main.$mainHash.js esta en bucket"

    if ($StandbyMode) {
        # 3.3 (Standby) - head-object index.html en el bucket. Confirma exit 0
        # + ContentLength razonable. NO hace GET al dominio publico porque ese
        # dominio sirve OTRO origin (landing legacy) y devolveria datos enga-
        # nosos. NO depende del CDN.
        $standbyEAP = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            $indexHead = & aws s3api head-object --bucket $bucketName --key "index.html" --output json 2>$null
            $indexHeadExit = $LASTEXITCODE
        } finally {
            $ErrorActionPreference = $standbyEAP
        }
        if ($indexHeadExit -ne 0) {
            Stop-Deploy "aws s3api head-object s3://$bucketName/index.html fallo con codigo $indexHeadExit (StandbyMode)."
        }
        $indexMeta = $indexHead | ConvertFrom-Json
        if ($indexMeta.ContentLength -lt 500) {
            Stop-Deploy "index.html en s3://$bucketName/ tiene tamano $($indexMeta.ContentLength) bytes (sospechosamente pequeno; index.html valido suele superar 500)."
        }
        if ($indexMeta.ContentType -notmatch 'text/html') {
            Stop-Deploy "index.html en s3://$bucketName/ tiene Content-Type '$($indexMeta.ContentType)' (esperado text/html)."
        }
        Write-Host "    OK - head-object index.html -> $($indexMeta.ContentLength) bytes, $($indexMeta.ContentType)"

        # 3.4 (Standby) - head-object main.<hash>.js en el bucket.
        $bundleEAP = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            $bundleHead = & aws s3api head-object --bucket $bucketName --key $mainJsKey --output json 2>$null
            $bundleHeadExit = $LASTEXITCODE
        } finally {
            $ErrorActionPreference = $bundleEAP
        }
        if ($bundleHeadExit -ne 0) {
            Stop-Deploy "aws s3api head-object s3://$bucketName/$mainJsKey fallo con codigo $bundleHeadExit (StandbyMode)."
        }
        $bundleMeta = $bundleHead | ConvertFrom-Json
        if ($bundleMeta.ContentLength -lt 1000) {
            Stop-Deploy "$mainJsKey en s3://$bucketName/ tiene tamano $($bundleMeta.ContentLength) bytes (sospechosamente pequeno; bundle CRA suele superar 1KB)."
        }
        Write-Host "    OK - head-object $mainJsKey -> $($bundleMeta.ContentLength) bytes"
    } else {
        # 3.3 - GET / -> 200 + text/html + size razonable.
        $rootInfo = Get-HttpResponseInfo -Url "$baseUrl/" -TimeoutSec 10
        if (-not $rootInfo.Reachable) {
            Stop-Deploy "GET $baseUrl/ no es accesible: $($rootInfo.Error). CloudFront / DNS / red?"
        }
        if ($rootInfo.StatusCode -ne 200) {
            Stop-Deploy "GET $baseUrl/ devolvio HTTP $($rootInfo.StatusCode) (esperado 200)."
        }
        if ($rootInfo.ContentType -notmatch 'text/html') {
            Stop-Deploy "GET $baseUrl/ devolvio Content-Type '$($rootInfo.ContentType)' (esperado text/html)."
        }
        if ($rootInfo.ContentLength -lt 500) {
            Stop-Deploy "GET $baseUrl/ devolvio tamano $($rootInfo.ContentLength) bytes (sospechosamente pequeno; index.html valido suele superar 500)."
        }
        Write-Host "    OK - GET $baseUrl/ -> 200 text/html $($rootInfo.ContentLength) bytes"

        # 3.4 - GET del bundle por su URL hashed -> 200 + size > 0.
        # Como la URL es hashed (inmutable), CloudFront NUNCA la tiene cacheada
        # antes de este deploy; el fetch va al origen S3 directamente y refleja
        # lo que acaba de subirse. No depende de la invalidacion en curso.
        $bundleInfo = Get-HttpResponseInfo -Url "$baseUrl$mainJsPath" -TimeoutSec 10
        if (-not $bundleInfo.Reachable) {
            Stop-Deploy "GET $baseUrl$mainJsPath no es accesible: $($bundleInfo.Error)."
        }
        if ($bundleInfo.StatusCode -ne 200) {
            Stop-Deploy "GET $baseUrl$mainJsPath devolvio HTTP $($bundleInfo.StatusCode) (esperado 200)."
        }
        if ($bundleInfo.ContentLength -lt 1000) {
            Stop-Deploy "GET $baseUrl$mainJsPath devolvio tamano $($bundleInfo.ContentLength) bytes (sospechosamente pequeno; bundle CRA suele superar 1KB)."
        }
        Write-Host "    OK - GET $baseUrl$mainJsPath -> 200 $($bundleInfo.ContentLength) bytes"
    }

    # -----------------------------------------------------------
    # [4/5] Smoke test funcional condicional al modo operacional
    # -----------------------------------------------------------
    Write-Step "4/5" "Smoke test funcional ($baseUrl/api/...)"

    if ($StandbyMode) {
        Write-Host "    [skip] StandbyMode: el bucket recien subido aun no se sirve desde $baseUrl; sondeo backend no aplica." -ForegroundColor Yellow
    } elseif ($SkipFunctionalSmoke) {
        Write-Host "    [skip] -SkipFunctionalSmoke activo." -ForegroundColor Yellow
    } else {
        # 4.1 - Sondear backend. Si no responde, saltar sin bloquear.
        $probe = Get-HttpResponseInfo -Url "$baseUrl/api/users/me" -TimeoutSec $BackendProbeTimeoutSec
        if (-not $probe.Reachable) {
            Write-Host "    [skip] backend no accesible (timeout / red): $($probe.Error)." -ForegroundColor Yellow
            Write-Host "          El deploy NO se bloquea por esto. Si el backend deberia estar arriba, revisalo." -ForegroundColor Yellow
        } else {
            Write-Host "    backend reachable: /api/users/me -> HTTP $($probe.StatusCode)"

            # 4.2 - Detectar modo via X-Product-Mode en una ruta protegida.
            # Una llamada SIN auth a /api/clients/me en OPEN devuelve 401/403
            # (sin header X-Product-Mode); en PRELAUNCH devuelve 503 con
            # header X-Product-Mode=PRELAUNCH. Cualquier otra cosa => no
            # ejecutamos checks de modo.
            $modeProbe = Get-HttpResponseInfo -Url "$baseUrl/api/clients/me" -TimeoutSec 5
            $detectedMode = if ($modeProbe.ProductMode) { $modeProbe.ProductMode.ToUpper() } else { 'OPEN-OR-UNKNOWN' }
            Write-Host "    modo operacional detectado: $detectedMode"

            if ($detectedMode -eq 'PRELAUNCH') {
                # 4.3 - POST /api/auth/login NO debe devolver 503 (gate de auth abierto en PRELAUNCH).
                $login = Get-HttpResponseInfo -Url "$baseUrl/api/auth/login" -Method POST -ContentType 'application/json' -Body '{"email":"x","password":"x"}' -TimeoutSec 10
                if ($login.StatusCode -eq 503) {
                    Stop-Deploy "Smoke funcional PRELAUNCH: POST /api/auth/login devolvio 503 (gate de login esta cerrado; deberia estar abierto en PRELAUNCH)."
                }
                Write-Host "    OK - POST /api/auth/login -> HTTP $($login.StatusCode) (no 503)"

                # 4.4 - POST /api/models/documents debe devolver 503 con X-Product-Mode=PRELAUNCH.
                $docs = Get-HttpResponseInfo -Url "$baseUrl/api/models/documents" -Method POST -ContentType 'application/json' -Body '{}' -TimeoutSec 10
                if ($docs.StatusCode -ne 503) {
                    Stop-Deploy "Smoke funcional PRELAUNCH: POST /api/models/documents devolvio HTTP $($docs.StatusCode) (esperado 503; el cierre de docs no esta aplicado)."
                }
                if ($docs.ProductMode -ne 'PRELAUNCH') {
                    Stop-Deploy "Smoke funcional PRELAUNCH: POST /api/models/documents devolvio 503 pero X-Product-Mode='$($docs.ProductMode)' (esperado PRELAUNCH)."
                }
                Write-Host "    OK - POST /api/models/documents -> 503 X-Product-Mode=PRELAUNCH"
            } else {
                Write-Host "    Modo no es PRELAUNCH; saltando checks especificos de pre-launch."
            }
        }
    }

    # -----------------------------------------------------------
    # [5.5/N] Update deploy-state manifest (Fase 1 paso 2a)
    # -----------------------------------------------------------
    # Tras smoke OK, registra el estado real desplegado en
    # ops/deploy-state/<env>.yaml para el surface tocado. SOLO escribe
    # el fichero; no hace commit (decision D2). Si fallara, NO aborta
    # el deploy (el deploy ya esta hecho); solo avisa.
    Write-Step "5.5/N" "Update deploy-state manifest"

    try {
        # Dot-source defensivo: si el [0.5] se salto con -SkipDriftCheck,
        # las funciones del helper no estan cargadas todavia.
        if (-not (Get-Command Update-DeployStateManifest -ErrorAction SilentlyContinue)) {
            . (Join-Path $PSScriptRoot 'check-deploy-drift.ps1')
        }

        $headFullPrev = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            $headFull  = (& git rev-parse HEAD 2>$null).Trim()
            $headShort = (& git rev-parse --short HEAD 2>$null).Trim()
        } finally {
            $ErrorActionPreference = $headFullPrev
        }

        $wtCleanNow = Get-WorkingTreeCleanForCode
        $deployedBy = "$env:USERNAME@$env:COMPUTERNAME"

        # bundle_sha256 desde el fichero local subido (deterministico).
        $bundleSha = $null
        $bundleLocal = Join-Path $buildDir $mainJsKey
        if (Test-Path $bundleLocal) {
            try {
                $bundleSha = (Get-FileHash -Algorithm SHA256 -Path $bundleLocal).Hash.ToLower()
            } catch {
                $bundleSha = $null
            }
        }

        $updateResult = Update-DeployStateManifest `
            -Env $Environment `
            -Surface $Surface `
            -Bundle "main.$mainHash.js" `
            -BundleSha256 $bundleSha `
            -GitCommitFull $headFull `
            -GitCommitShort $headShort `
            -WorkingTreeClean $wtCleanNow `
            -DeployedBy $deployedBy `
            -Bucket $bucketName `
            -CloudfrontDistribution $distributionId `
            -CloudfrontInvalidationId $script:cloudfrontInvalidationId

        Write-Host "    OK - manifest actualizado: $($updateResult.ManifestFile)" -ForegroundColor Green
        Write-Host "         (recordatorio: el commit del manifest lo decides tu; no se hace auto-commit)." -ForegroundColor DarkGray
    } catch {
        Write-Host "    WARN - manifest NO actualizado: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "           El deploy se ha completado correctamente; solo falla el registro del estado." -ForegroundColor Yellow
        Write-Host "           Revisar manualmente ops/deploy-state/$Environment.yaml." -ForegroundColor Yellow
    }

    # -----------------------------------------------------------
    # [5/5] Cierre
    # -----------------------------------------------------------
    Write-Step "5/5" "Cierre"

    Write-Host ""
    Write-Host "===============================================" -ForegroundColor Green
    Write-Host " Deploy completado." -ForegroundColor Green
    Write-Host "===============================================" -ForegroundColor Green
    Write-Host " Entorno:     $Environment"
    Write-Host " Surface:     $Surface"
    Write-Host " main bundle: $mainJsKey"
    Write-Host " URL base:    $baseUrl"
    if ($StandbyMode) {
        Write-Host " Modo:        STANDBY (bucket subido; dist CF aun apunta a otro origin)" -ForegroundColor Yellow
    }
    Write-Host ""
    if ($StandbyMode) {
        Write-Host " StandbyMode: SIN invalidacion CF; el bucket esta listo para el switch de origin." -ForegroundColor Yellow
    } else {
        Write-Host " La invalidacion CloudFront tarda 30-90s en propagar." -ForegroundColor Yellow
    }
    Write-Host ""

} finally {
    if (Test-Path $lockFile) {
        Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
    }
}
