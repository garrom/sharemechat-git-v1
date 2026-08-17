<#
.SYNOPSIS
    Pre-render de las landings publicas de captacion (/modelos, /for-studios)
    para PROD: lanza Puppeteer (ops/scripts/prerender-blog/render.js) contra
    https://sharemechat.com, captura el HTML final con og:/title/canonical
    correctos y lo sube a S3 por path. Fix 2 SEO (2026-08-17).

.DESCRIPTION
    Analogo a prerender-blog-prod.ps1 pero para las landings, que cambian
    raramente (no necesitan cron auto-curativo como el blog): se re-renderizan
    on-demand cuando la landing cambia o tras un deploy de frontend que las toque.

    Flujo:
      1) Verifica node disponible.
      2) Reutiliza ops/scripts/prerender-blog/ (render.js + node_modules);
         si node_modules NO existe, npm install.
      3) URLs fijas: /modelos, /en/modelos, /for-studios, /en/for-studios.
      4) Escribe config JSON sin BOM y llama node render.js --config <ruta>.
      5) Verifica que existe un index.html por URL en outDir.
      6) aws s3 cp de cada <path>/index.html -> s3://<Bucket>/<path>/index.html
         (content-type text/html, cache-control 5 min). cp explicito por path
         para no arrastrar nada mas del bucket.
      7) Limpia el directorio temporal.

    render.js sirve para landings via su FALLBACK (title != shellTitle +
    <link rel=canonical>), que el componente <Seo> de cada landing satisface;
    no depende del marcador body[data-blog-hydrated] (blog-only).

    NO invalida CloudFront aqui: el caller invalida
    /modelos /en/modelos /for-studios /en/for-studios tras este script.

    Requisito de routing: la CloudFront Function redirect-spa-prod.js debe
    tener esas 4 rutas en su tabla prerenderedLandings (servir <path>/index.html).
    Si el objeto no existe, el CER (403 -> 200 + /index.html) degrada a shell
    SPA (CSR) sin pagina rota.

    Si el render.js falla, ABORTA con exit 1: NO se sube nada a S3.

.PARAMETER Hostname
    URL base contra la que Puppeteer renderiza. Default https://sharemechat.com.

.PARAMETER Bucket
    Bucket S3 PROD destino. Default sharemechat-frontend-prod.

.PARAMETER DistributionId
    Distribucion CloudFront PROD. Default E2FWNC80D4QDJC. Aceptado por paridad
    de interfaz aunque este script NO invalida (lo hace el caller).

.EXAMPLE
    .\prerender-landings-prod.ps1

.NOTES
    Referencias:
      docs/01-business/seo/seo-prerender-analysis-2026-06-21.md
      docs/01-business/seo/seo-edge-function-analysis-2026-06-21.md
#>

[CmdletBinding()]
param(
    [string]$Hostname = "https://sharemechat.com",
    [string]$Bucket = "sharemechat-frontend-prod",
    [string]$DistributionId = "E2FWNC80D4QDJC"
)

$ErrorActionPreference = 'Stop'
$SHELL_TITLE = '1-to-1 Video Chat with Verified Models | SharemeChat'

# Rutas a pre-renderizar (deben coincidir con prerenderedLandings de la
# CloudFront Function redirect-spa-prod.js y con STATIC_LANDING_PATHS del
# SitemapController).
$LANDING_URLS = @('/modelos', '/en/modelos', '/for-studios', '/en/for-studios')

function Write-Phase {
    param([string]$Msg)
    Write-Host ""
    Write-Host "    > $Msg" -ForegroundColor Cyan
}

function Stop-Prerender {
    param([string]$Msg, [int]$ExitCode = 1)
    Write-Host ""
    Write-Error "PRERENDER ABORT: $Msg"
    exit $ExitCode
}

function Invoke-NativeNoAbort {
    # Ejecuta un native exe preservando su exit code sin que PS5.1 aborte por
    # stderr con ErrorActionPreference='Stop' (NativeCommandError). Mismo patron
    # que prerender-blog-prod.ps1.
    param([scriptblock]$Block)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & $Block 2>&1 | ForEach-Object { Write-Host $_ }
        return $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prev
    }
}

Write-Host "==================================================" -ForegroundColor Green
Write-Host " prerender-landings-prod.ps1 -> PROD" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host " Hostname: $Hostname"
Write-Host " Bucket:   $Bucket"

# ---------------------------------------------------------------
# 1) node disponible
# ---------------------------------------------------------------
Write-Phase "1/6 Verificar node"
$nodeVersion = & node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Stop-Prerender "node no esta disponible en PATH."
}
Write-Host "      node $nodeVersion"

# ---------------------------------------------------------------
# 2) Reutilizar ops/scripts/prerender-blog (render.js + node_modules)
# ---------------------------------------------------------------
Write-Phase "2/6 Dependencias (ops/scripts/prerender-blog)"
$prerenderDir = Join-Path $PSScriptRoot 'prerender-blog'
if (-not (Test-Path (Join-Path $prerenderDir 'render.js'))) {
    Stop-Prerender "No existe $prerenderDir\render.js."
}
if (-not (Test-Path (Join-Path $prerenderDir 'node_modules'))) {
    Write-Host "      node_modules ausente, npm install..."
    Push-Location $prerenderDir
    try {
        & npm install --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) {
            Stop-Prerender "npm install fallo con codigo $LASTEXITCODE en $prerenderDir."
        }
    } finally {
        Pop-Location
    }
    Write-Host "      OK - dependencias instaladas."
} else {
    Write-Host "      OK - node_modules existe."
}

# ---------------------------------------------------------------
# 3) URLs (fijas) + config JSON sin BOM
# ---------------------------------------------------------------
Write-Phase "3/6 URLs a pre-renderizar"
$urls = @($LANDING_URLS)
Write-Host "      Total: $($urls.Count)"
$urls | ForEach-Object { Write-Host "        $_" }

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$tempDir = Join-Path $env:TEMP "prerender-landings-$timestamp"
$outDir = Join-Path $tempDir 'out'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
$configPath = Join-Path $tempDir 'config.json'

$config = [pscustomobject]@{
    outDir = $outDir
    hostname = $Hostname
    urls = $urls
    shellTitle = $SHELL_TITLE
}
$json = $config | ConvertTo-Json -Depth 5
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($configPath, $json, $utf8NoBom)
Write-Host "      Config: $configPath"

# ---------------------------------------------------------------
# 4) Lanzar Puppeteer (render.js)
# ---------------------------------------------------------------
Write-Phase "4/6 Lanzar Puppeteer (render.js)"
Push-Location $prerenderDir
$renderExit = 0
try {
    $renderExit = Invoke-NativeNoAbort -Block { & node render.js --config $configPath }
} finally {
    Pop-Location
}
if ($renderExit -ne 0) {
    Write-Warning "render.js fallo con codigo $renderExit. NO se sube nada a S3."
    Write-Warning "El bundle SPA esta arriba; el CER (403 -> /index.html 200) cubre las landings (CSR)."
    Stop-Prerender "render.js exit=$renderExit" 1
}
Write-Host "      OK - render.js termino exit 0."

# ---------------------------------------------------------------
# 5) Verificar un index.html por URL
# ---------------------------------------------------------------
Write-Phase "5/6 Verificar archivos generados"
foreach ($u in $urls) {
    $rel = $u.TrimStart('/')
    $p = Join-Path $outDir (Join-Path $rel 'index.html')
    if (-not (Test-Path $p)) {
        Stop-Prerender "Falta el HTML pre-renderizado para $u ($p). Nada se sube."
    }
    Write-Host "        $rel/index.html ($((Get-Item $p).Length) bytes)"
}

# ---------------------------------------------------------------
# 6) Subir cada landing a su prefijo en S3 (cp explicito)
# ---------------------------------------------------------------
Write-Phase "6/6 aws s3 cp -> s3://$Bucket/<path>/index.html"
foreach ($u in $urls) {
    $rel = $u.TrimStart('/')
    $src = Join-Path $outDir (Join-Path $rel 'index.html')
    $dst = "s3://$Bucket/$rel/index.html"
    & aws s3 cp $src $dst --content-type "text/html; charset=utf-8" --cache-control "public, max-age=300"
    if ($LASTEXITCODE -ne 0) {
        Stop-Prerender "aws s3 cp fallo ($u) con codigo $LASTEXITCODE."
    }
    Write-Host "        subido $dst"
}

Write-Host ""
Write-Host "    Limpiando $tempDir..."
Remove-Item -Recurse -Force $tempDir
Write-Host "    OK - directorio temporal limpiado."

Write-Host ""
Write-Host "    Pre-render de landings completado. El caller debe invalidar en CloudFront:" -ForegroundColor Green
Write-Host "      /modelos /en/modelos /for-studios /en/for-studios" -ForegroundColor Green
exit 0
