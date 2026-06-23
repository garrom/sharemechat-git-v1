<#
.SYNOPSIS
    Pre-render selectivo del blog para PROD: enumera articulos publicados via
    backend, lanza Puppeteer (ops/scripts/prerender-blog/render.js) contra
    https://sharemechat.com, captura HTML por path y sube a S3.

.DESCRIPTION
    Orquestador del pre-render del blog. Pensado para invocarse como paso
    [4.5/N] dentro de deploy-frontend.ps1 cuando Environment=prod + Surface
    in (product, both) + no StandbyMode.

    Flujo:
      1) Verifica node disponible.
      2) Si ops/scripts/prerender-blog/node_modules NO existe, npm install.
      3) Llama al backend (Hostname/api/public/content/articles?locale=...)
         para enumerar slugs publicados ES + EN.
      4) Construye lista de URLs: /blog/es, /blog/en, /blog/{locale}/{slug}.
      5) Escribe config JSON sin BOM y llama node render.js --config <ruta>.
      6) Verifica que existe un index.html por URL en outDir.
      7) aws s3 sync outDir/blog/ -> s3://<Bucket>/blog/ con content-type
         text/html y cache-control 5 min.
      8) Limpia el directorio temporal.

    NO invalida CloudFront aqui. La invalidacion /blog/* la hace el caller
    (deploy-frontend.ps1) tras este script para que los HTMLs nuevos sean
    servidos inmediatamente sin cache stale.

    Si el backend PROD no responde, ABORTA con exit 2 (warning para el
    caller): el bundle SPA ya esta arriba y el CER (403 -> /index.html 200)
    cubre el fallback durante esa ventana. El siguiente deploy reintenta.

    Si el render.js falla, ABORTA con exit 1: NO se sube nada a S3. El
    bundle SPA ya esta arriba y CER cubre. El caller decide si lo trata
    como warning o error.

.PARAMETER Hostname
    URL base contra la que Puppeteer renderiza. Default https://sharemechat.com.

.PARAMETER Bucket
    Bucket S3 PROD destino del sync. Default sharemechat-frontend-prod.

.PARAMETER DistributionId
    Distribucion CloudFront PROD. Default E2FWNC80D4QDJC. Aceptado por
    paridad de interfaz aunque este script NO invalida (lo hace el caller).

.EXAMPLE
    .\prerender-blog-prod.ps1

.EXAMPLE
    .\prerender-blog-prod.ps1 -Hostname https://sharemechat.com -Bucket sharemechat-frontend-prod

.NOTES
    Referencias:
      docs/01-business/seo/seo-prerender-analysis-2026-06-21.md
      docs/01-business/seo/seo-edge-function-analysis-2026-06-21.md
      docs/01-business/seo/seo-edge-function-changes-2026-06-21.md
#>

[CmdletBinding()]
param(
    [string]$Hostname = "https://sharemechat.com",
    [string]$Bucket = "sharemechat-frontend-prod",
    [string]$DistributionId = "E2FWNC80D4QDJC"
)

$ErrorActionPreference = 'Stop'
$SHELL_TITLE = '1-to-1 Video Chat with Verified Models | SharemeChat'

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

# ---------------------------------------------------------------
# 1) Verificar node
# ---------------------------------------------------------------
Write-Phase "1/7 Verificar node disponible"
$nodeVersion = $null
try {
    $nodeVersion = (& node --version 2>$null).Trim()
} catch {
    Stop-Prerender "node no esta en PATH. Instalar Node.js 18+ y reintentar."
}
if (-not $nodeVersion) {
    Stop-Prerender "node --version no devolvio output."
}
Write-Host "      node: $nodeVersion"

# ---------------------------------------------------------------
# 2) Verificar/instalar dependencias en ops/scripts/prerender-blog/
# ---------------------------------------------------------------
Write-Phase "2/7 Dependencias de Puppeteer"
$prerenderDir = Join-Path $PSScriptRoot 'prerender-blog'
$renderScript = Join-Path $prerenderDir 'render.js'
$nodeModulesDir = Join-Path $prerenderDir 'node_modules'

if (-not (Test-Path $renderScript)) {
    Stop-Prerender "No existe $renderScript. Esperado ops/scripts/prerender-blog/render.js."
}
if (-not (Test-Path $nodeModulesDir)) {
    Write-Host "      node_modules no existe. Ejecutando npm install en $prerenderDir..."
    Push-Location $prerenderDir
    try {
        & npm install 2>&1 | Out-Host
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
# 3) Enumerar articulos publicados desde el backend
# ---------------------------------------------------------------
Write-Phase "3/7 Enumerar articulos publicados (backend PROD)"
$resEs = $null
$resEn = $null
try {
    $resEs = Invoke-RestMethod -Uri "$Hostname/api/public/content/articles?locale=es&size=200" -TimeoutSec 30
    $resEn = Invoke-RestMethod -Uri "$Hostname/api/public/content/articles?locale=en&size=200" -TimeoutSec 30
} catch {
    Write-Warning "Backend PROD no responde: $($_.Exception.Message). Abortando pre-render."
    Write-Warning "El deploy del bundle SPA NO se ve afectado. El siguiente deploy reintentara."
    exit 2
}
$slugsEs = if ($resEs.items) { @($resEs.items | ForEach-Object { $_.slug }) } else { @() }
$slugsEn = if ($resEn.items) { @($resEn.items | ForEach-Object { $_.slug }) } else { @() }
Write-Host "      ES publicados: $($slugsEs.Count) ($($slugsEs -join ', '))"
Write-Host "      EN publicados: $($slugsEn.Count) ($($slugsEn -join ', '))"

# ---------------------------------------------------------------
# 4) Construir lista de URLs
# ---------------------------------------------------------------
Write-Phase "4/7 Construir lista de URLs"
$urls = @('/blog/es', '/blog/en')
foreach ($slug in $slugsEs) { $urls += "/blog/es/$slug" }
foreach ($slug in $slugsEn) { $urls += "/blog/en/$slug" }
Write-Host "      Total URLs a pre-renderizar: $($urls.Count)"
$urls | ForEach-Object { Write-Host "        $_" }

# ---------------------------------------------------------------
# 5) Generar config JSON sin BOM + lanzar render.js
# ---------------------------------------------------------------
Write-Phase "5/7 Lanzar Puppeteer (render.js)"
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$tempDir = Join-Path $env:TEMP "prerender-blog-$timestamp"
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
Write-Host "      OutDir: $outDir"

Push-Location $prerenderDir
$renderExit = 0
try {
    & node render.js --config $configPath
    $renderExit = $LASTEXITCODE
} finally {
    Pop-Location
}

if ($renderExit -ne 0) {
    Write-Warning "render.js fallo con codigo $renderExit. NO se sube nada a S3."
    Write-Warning "El bundle SPA esta arriba; el CER (403 -> /index.html 200) cubre el blog mientras tanto."
    Stop-Prerender "render.js exit=$renderExit" 1
}
Write-Host "      OK - render.js termino exit 0."

# ---------------------------------------------------------------
# 6) Verificar que se generaron tantos index.html como URLs
# ---------------------------------------------------------------
Write-Phase "6/7 Verificar archivos generados"
$generated = Get-ChildItem -Path $outDir -Filter 'index.html' -Recurse -File
Write-Host "      Archivos index.html generados: $($generated.Count) (esperado $($urls.Count))"
if ($generated.Count -ne $urls.Count) {
    Write-Warning "Mismatch entre URLs configuradas ($($urls.Count)) y archivos generados ($($generated.Count))."
    Write-Warning "Se procede con sync de lo que haya."
}
foreach ($f in $generated) {
    $rel = $f.FullName.Substring($outDir.Length).TrimStart('\','/')
    Write-Host "        $rel ($($f.Length) bytes)"
}

# ---------------------------------------------------------------
# 7) Sync a S3 + limpieza
# ---------------------------------------------------------------
Write-Phase "7/7 aws s3 sync -> s3://$Bucket/blog/"
$blogOutDir = Join-Path $outDir 'blog'
if (-not (Test-Path $blogOutDir)) {
    Stop-Prerender "No existe $blogOutDir tras el render. Nada para subir."
}
& aws s3 sync $blogOutDir "s3://$Bucket/blog/" --content-type "text/html; charset=utf-8" --cache-control "public, max-age=300" --exact-timestamps
if ($LASTEXITCODE -ne 0) {
    Stop-Prerender "aws s3 sync fallo con codigo $LASTEXITCODE."
}
Write-Host "      OK - sync completado."

Write-Host ""
Write-Host "    Limpiando $tempDir..."
Remove-Item -Recurse -Force $tempDir
Write-Host "    OK - directorio temporal limpiado."

Write-Host ""
Write-Host "    Pre-render completado. Caller (deploy-frontend.ps1) debe invalidar /blog/*." -ForegroundColor Green
exit 0
