<#
.DEPRECATED
Script archivado el 2026-05-11.

Razon: el blog dejo de servirse como HTML estatico. La SPA
React (Blog.jsx + BlogContent.jsx + BlogArticleView.jsx) sirve
ahora todo el blog dinamicamente contra la API del backend.

Decision cerrada: ver
  docs/06-decisions/adr-019-blog-spa-react.md
(ADR-018 esta "Superseded" por esa decision).

Este script NO debe ejecutarse contra TEST/PRO. Si se ejecuta,
subira HTML estatico al bucket frontend que CloudFront ya no
ruteara. Inocuo pero ensucia.

Conservado como referencia historica:
- Workaround UTF-8 para Invoke-RestMethod (PS5).
- CSS embebido del blog estatico (Get-BlogCommonCss).
- Plantillas A (Build-IndexHtml) y B (Build-DetailHtml).
#>

<#
.SYNOPSIS
    Pre-renderiza el blog publico de SharemeChat a HTML estatico y lo publica en S3+CloudFront.

.DESCRIPTION
    Implementa la decision de ADR-018: el blog publico se sirve como HTML estatico
    pre-renderizado desde S3, sin dependencia del backend en tiempo de respuesta.

    Flujo:
      1. Lee bucket S3, distribucion CloudFront y URL publica del entorno desde
         ~/.sharemechat/state-mapping.yaml.
      2. Llama al backend para listar slugs publicados (GET /api/public/content/articles?size=50)
         y al detalle de cada uno (GET /api/public/content/articles/<slug>).
      3. Compone HTML completo por pagina (head con meta tags SEO, JSON-LD, body con
         htmlBody ya sanitizado por jsoup en el backend).
      4. Sube a s3://<bucket>/blog y s3://<bucket>/blog/<slug> con Content-Type
         text/html (sin trailing slash, sin extension .html).
      5. Crea invalidacion CloudFront sobre /blog y /blog/*.

    Modos:
      -DryRun        Genera HTML local en $env:TEMP, no toca S3 ni CloudFront.
      -SkipUpload    Genera local, no sube ni invalida.
      -Retract <slug>  Elimina s3://<bucket>/blog/<slug> e invalida ese path. Sale.

.PARAMETER Environment
    Identificador del entorno: test, audit o prod.

.PARAMETER DryRun
    Si se especifica, genera HTML en $env:TEMP y no toca AWS.

.PARAMETER Retract
    Slug a retractar. Si se especifica, elimina la pagina estatica e invalida CloudFront,
    luego sale sin pre-renderizar nada mas.

.PARAMETER SkipUpload
    Si se especifica, genera HTML local pero no sube a S3 ni invalida CloudFront.

.EXAMPLE
    .\prerender-blog.ps1 test -DryRun

    Genera HTML local en $env:TEMP\sharemechat-prerender-blog-test-... sin tocar AWS.

.EXAMPLE
    .\prerender-blog.ps1 test

    Pre-renderiza y publica el blog estatico en TEST.

.EXAMPLE
    .\prerender-blog.ps1 test -Retract videochat-seguro-guia

    Elimina s3://sharemechat-frontend-test/blog/videochat-seguro-guia e invalida
    /blog/videochat-seguro-guia en CloudFront.

.NOTES
    Requiere:
      - ~/.sharemechat/state-mapping.yaml con campos rellenos:
          environments.<env>.public_base_url
          environments.<env>.s3_buckets.frontend_product.name
          environments.<env>.cloudfront_distributions.frontend_public.id
      - aws CLI configurado con permisos s3:PutObject*, s3:DeleteObject*,
        cloudfront:CreateInvalidation
      - Conectividad al backend del entorno (Invoke-RestMethod sobre <public_base_url>)
      - powershell-yaml module (se instala on demand si falta)

    Ver ADR-018 (docs/06-decisions/adr-018-blog-static-rendering.md) para diseno completo.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('test', 'audit', 'prod')]
    [string]$Environment,

    [Parameter(Mandatory = $false)]
    [switch]$DryRun,

    [Parameter(Mandatory = $false)]
    [string]$Retract,

    [Parameter(Mandatory = $false)]
    [switch]$SkipUpload
)

$ErrorActionPreference = 'Stop'
$startTime = Get-Date

# Forzar TLS 1.2 (PS5 puede negociar TLS 1.0/1.1 por defecto, lo que rompe HTTPS modernos)
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch {}

# ---------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------

function Escape-HtmlAttribute {
    # Escapa & < > " ' para que el valor sea seguro tanto en contenido HTML como en
    # atributos delimitados por comillas dobles. NO se aplica al htmlBody, que ya
    # viene sanitizado por jsoup en el backend (ver ADR-018 D7).
    param([Parameter(Position = 0)][AllowNull()][AllowEmptyString()][string]$Value)
    if ([string]::IsNullOrEmpty($Value)) { return "" }
    $r = $Value
    $r = $r -replace '&', '&amp;'
    $r = $r -replace '<', '&lt;'
    $r = $r -replace '>', '&gt;'
    $r = $r -replace '"', '&quot;'
    $r = $r -replace "'", '&#39;'
    return $r
}

function Get-TruncatedBrief {
    # Trunca a $MaxChars cortando por ultima palabra completa cuando es posible.
    # NO anade ellipsis (la longitud final es siempre <= $MaxChars).
    param(
        [AllowNull()][AllowEmptyString()][string]$Brief,
        [int]$MaxChars = 160
    )
    if ([string]::IsNullOrEmpty($Brief)) { return "" }
    if ($Brief.Length -le $MaxChars) { return $Brief }
    $cut = $Brief.Substring(0, $MaxChars)
    $lastSpace = $cut.LastIndexOf(' ')
    if ($lastSpace -gt [int]($MaxChars / 2)) {
        return $cut.Substring(0, $lastSpace).TrimEnd()
    }
    return $cut.TrimEnd()
}

function Format-DateYmd {
    # Convierte ISO 8601 (Java Instant.toString) a YYYY-MM-DD en UTC.
    param([AllowNull()][AllowEmptyString()][string]$Iso)
    if ([string]::IsNullOrWhiteSpace($Iso)) { return "" }
    try {
        $d = [DateTime]::Parse(
            $Iso,
            [System.Globalization.CultureInfo]::InvariantCulture,
            [System.Globalization.DateTimeStyles]::AssumeUniversal -bor [System.Globalization.DateTimeStyles]::AdjustToUniversal
        )
        return $d.ToString('yyyy-MM-dd')
    } catch {
        return $Iso
    }
}

function Format-Iso8601 {
    # Reformatea ISO 8601 a "YYYY-MM-DDTHH:mm:ssZ" (sin fracciones).
    param([AllowNull()][AllowEmptyString()][string]$Iso)
    if ([string]::IsNullOrWhiteSpace($Iso)) { return "" }
    try {
        $d = [DateTime]::Parse(
            $Iso,
            [System.Globalization.CultureInfo]::InvariantCulture,
            [System.Globalization.DateTimeStyles]::AssumeUniversal -bor [System.Globalization.DateTimeStyles]::AdjustToUniversal
        )
        return $d.ToString("yyyy-MM-ddTHH:mm:ssZ")
    } catch {
        return $Iso
    }
}

function Invoke-JsonGetUtf8 {
    # Workaround: el backend devuelve Content-Type sin charset=utf-8 y PS5
    # Invoke-RestMethod asume ISO-8859-1, corrompiendo bytes UTF-8 (ej. "Cómo"
    # llega como "CÃ³mo"). Leemos los bytes crudos y los decodificamos como UTF-8.
    param([Parameter(Mandatory = $true)][string]$Uri)
    $resp = Invoke-WebRequest -Uri $Uri -UseBasicParsing
    $bytes = $resp.RawContentStream.ToArray()
    $json = [System.Text.Encoding]::UTF8.GetString($bytes)
    return $json | ConvertFrom-Json
}

function Write-Utf8NoBom {
    # Escribe texto a fichero como UTF-8 sin BOM (Set-Content -Encoding UTF8 en PS5
    # produce BOM, que aunque no es fatal en HTML preferimos evitar).
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][AllowEmptyString()][string]$Content
    )
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

# ---------------------------------------------------------------
# 1. Validar prerequisitos: AWS CLI
# ---------------------------------------------------------------
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: aws CLI no encontrado en PATH. Instalar antes de continuar." -ForegroundColor Red
    exit 1
}

# ---------------------------------------------------------------
# 2. Cargar mapping
# ---------------------------------------------------------------
$mappingPath = Join-Path $HOME '.sharemechat\state-mapping.yaml'
if (-not (Test-Path $mappingPath)) {
    Write-Host "ERROR: No se encuentra $mappingPath" -ForegroundColor Red
    Write-Host "Ver docs/state-inventory-skills/state-inventory.md para crear el fichero." -ForegroundColor Yellow
    exit 1
}

if (-not (Get-Module -ListAvailable -Name powershell-yaml)) {
    Write-Host "Instalando modulo powershell-yaml (necesario para leer el mapping)..." -ForegroundColor Cyan
    try {
        Install-Module -Name powershell-yaml -Scope CurrentUser -Force -ErrorAction Stop
    } catch {
        Write-Host "ERROR: No se pudo instalar powershell-yaml: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}
Import-Module powershell-yaml

$mapping = Get-Content $mappingPath -Raw | ConvertFrom-Yaml

if (-not $mapping.environments.$Environment) {
    Write-Host "ERROR: Entorno '$Environment' no existe en el mapping." -ForegroundColor Red
    exit 1
}
$envBlock = $mapping.environments.$Environment

# ---------------------------------------------------------------
# 3. Validar campos requeridos del mapping
# ---------------------------------------------------------------
$publicBaseUrl = $envBlock.public_base_url

$bucketName = $null
if ($envBlock.s3_buckets -and $envBlock.s3_buckets.frontend_product) {
    $bucketName = $envBlock.s3_buckets.frontend_product.name
}

$distributionId = $null
if ($envBlock.cloudfront_distributions -and $envBlock.cloudfront_distributions.frontend_public) {
    $distributionId = $envBlock.cloudfront_distributions.frontend_public.id
}

if ([string]::IsNullOrWhiteSpace($publicBaseUrl)) {
    Write-Host "ERROR: environments.$Environment.public_base_url vacio en el mapping." -ForegroundColor Red
    Write-Host "Editar $mappingPath y rellenar el campo." -ForegroundColor Yellow
    exit 1
}
if ([string]::IsNullOrWhiteSpace($bucketName)) {
    Write-Host "ERROR: environments.$Environment.s3_buckets.frontend_product.name vacio en el mapping." -ForegroundColor Red
    exit 1
}
if ([string]::IsNullOrWhiteSpace($distributionId)) {
    Write-Host "ERROR: environments.$Environment.cloudfront_distributions.frontend_public.id vacio en el mapping." -ForegroundColor Red
    exit 1
}

# Quitar trailing slash en public_base_url para evitar dobles barras al concatenar
$publicBaseUrl = $publicBaseUrl.TrimEnd('/')

# ---------------------------------------------------------------
# 4. Modo Retract (sale tras completar)
# ---------------------------------------------------------------
if (-not [string]::IsNullOrWhiteSpace($Retract)) {
    $slug = $Retract.Trim().ToLower()

    Write-Host ""
    Write-Host "===============================================" -ForegroundColor Yellow
    Write-Host " RETRACT slug '$slug' en $($Environment.ToUpper())" -ForegroundColor Yellow
    Write-Host "===============================================" -ForegroundColor Yellow
    Write-Host " Bucket:        s3://$bucketName/"
    Write-Host " Distribucion:  $distributionId"
    Write-Host ""

    Write-Host "[1/2] Eliminando s3://$bucketName/blog/$slug ..." -ForegroundColor Cyan
    aws s3 rm "s3://$bucketName/blog/$slug"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: aws s3 rm fallo con codigo $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }

    Write-Host "[2/2] Invalidando /blog/$slug en CloudFront $distributionId ..." -ForegroundColor Cyan
    aws cloudfront create-invalidation --distribution-id $distributionId --paths "/blog/$slug"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: invalidacion fallo con codigo $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }

    $elapsed = (Get-Date) - $startTime
    Write-Host ""
    Write-Host "===============================================" -ForegroundColor Green
    Write-Host " Retract completado." -ForegroundColor Green
    Write-Host "===============================================" -ForegroundColor Green
    Write-Host " Slug:                    $slug"
    Write-Host " Objeto S3 eliminado:     s3://$bucketName/blog/$slug"
    Write-Host " Invalidacion CloudFront: 1"
    Write-Host " Tiempo total:            $([Math]::Round($elapsed.TotalSeconds, 1))s"
    Write-Host " La invalidacion tarda 30-90s en propagarse." -ForegroundColor Yellow
    exit 0
}

# ---------------------------------------------------------------
# 5. Llamar al backend: listado
# ---------------------------------------------------------------
$listUrl = "$publicBaseUrl/api/public/content/articles?size=50"

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host " Pre-render blog -> $($Environment.ToUpper())" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host " Public base:   $publicBaseUrl"
Write-Host " Bucket:        s3://$bucketName/"
Write-Host " Distribucion:  $distributionId"
Write-Host " DryRun:        $DryRun"
Write-Host " SkipUpload:    $SkipUpload"
Write-Host ""

Write-Host "[1] Listando articulos publicados: $listUrl" -ForegroundColor Cyan
try {
    $listResponse = Invoke-JsonGetUtf8 $listUrl
} catch {
    Write-Host "ERROR: el backend no responde en $listUrl" -ForegroundColor Red
    Write-Host "Detalle: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Sin acceso al backend no se puede pre-renderizar. Verifica que la EC2 backend esta arriba" -ForegroundColor Yellow
    Write-Host "y que el endpoint /api/public/content/articles responde con 200." -ForegroundColor Yellow
    exit 1
}

if ($null -eq $listResponse.items) {
    Write-Host "AVISO: el backend respondio sin campo 'items'. Tratando como lista vacia." -ForegroundColor Yellow
    $articles = @()
} else {
    $articles = @($listResponse.items)
}

Write-Host "    $($articles.Count) articulos publicados encontrados." -ForegroundColor Cyan

# ---------------------------------------------------------------
# 6. Llamar al detalle por cada articulo
# ---------------------------------------------------------------
$details = @()
$detailErrors = @()
$idx = 0
foreach ($a in $articles) {
    $idx++
    $slug = [string]$a.slug
    if ([string]::IsNullOrWhiteSpace($slug)) {
        Write-Host "    [$idx] AVISO: articulo sin slug, saltado." -ForegroundColor Yellow
        $detailErrors += [pscustomobject]@{ slug = '(vacio)'; error = 'item sin slug en respuesta del listado' }
        continue
    }
    Write-Host "[2.$idx/$($articles.Count)] Detalle: $slug" -ForegroundColor Cyan
    $detailUrl = "$publicBaseUrl/api/public/content/articles/$slug"
    try {
        $d = Invoke-JsonGetUtf8 $detailUrl
        $details += , $d
    } catch {
        Write-Host "    ERROR detalle '$slug': $($_.Exception.Message)" -ForegroundColor Red
        $detailErrors += [pscustomobject]@{ slug = $slug; error = $_.Exception.Message }
    }
}

# ---------------------------------------------------------------
# 7. Preparar carpeta temporal
# ---------------------------------------------------------------
$timestamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
$tempDir = Join-Path $env:TEMP "sharemechat-prerender-blog-$Environment-$timestamp"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
Write-Host ""
Write-Host "[3] Generando HTML en $tempDir ..." -ForegroundColor Cyan

# ---------------------------------------------------------------
# 8.a Helpers de plantilla (CSS, navbar, footer, sidebar comunes
#     a plantilla A y plantilla B, alineados con tokens del SPA).
# ---------------------------------------------------------------

function Get-BlogCommonCss {
    # Bloque CSS unico para listado y detalle. Sin variables PS, here-string
    # single-quoted para evitar interpolacion accidental de cualquier $.
    return @'
:root {
  --c-cream: #f7f8f4;
  --c-white: #ffffff;
  --c-display: #0f172a;
  --c-body: #475569;
  --c-meta: #64748b;
  --c-soft: #7c8a9a;
  --c-cat-bg: #eef2ff;
  --c-cat-text: #3730a3;
  --c-link: #4338ca;
  --c-link-hover: #312e81;
  --c-border-soft: rgba(148,163,184,0.16);
  --c-border-nav: #e9ecef;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: 'Poppins', system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: var(--c-display);
  background: var(--c-cream);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3 { font-family: 'Poppins', system-ui, sans-serif; letter-spacing: -0.02em; margin: 0; }

/* === NAVBAR SUAVE === */
.nav {
  background: var(--c-white);
  border-bottom: 1px solid var(--c-border-nav);
  height: 64px;
  display: flex;
  align-items: center;
  padding: 0 24px;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 1000;
}
.nav-left { display: flex; align-items: center; gap: 32px; }
.nav-logo { display: block; height: 36px; }
.nav-logo img { height: 100%; width: auto; display: block; }
.nav-links { display: flex; gap: 14px; }
.nav-link {
  position: relative;
  font-size: 1rem;
  font-weight: 800;
  color: #9ca3af;
  text-decoration: none;
  letter-spacing: 0.01em;
  padding: 4px 0 10px;
  margin: 0;
  line-height: 1;
  transition: color 0.15s;
}
.nav-link::after {
  content: '';
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 3px;
  border-radius: 999px;
  background: transparent;
  transition: background 0.15s;
}
.nav-link:hover { color: var(--c-display); }
.nav-link.active { color: var(--c-display); }
.nav-link.active::after { background: var(--c-display); }
.nav-cta {
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  padding: 10px 22px;
  border: 1.5px solid var(--c-display);
  color: var(--c-display);
  background: transparent;
  border-radius: 999px;
  text-decoration: none;
  transition: all 0.15s;
}
.nav-cta:hover { background: var(--c-display); color: var(--c-white); }

/* === PAGE WRAP === */
.page-wrap {
  background: linear-gradient(180deg, #ffffff 0%, var(--c-cream) 100%);
  padding: 48px 0 88px;
  min-height: 600px;
}
.page-inner {
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 24px;
}

/* === HERO === */
.hero {
  background: var(--c-white);
  border: 1px solid var(--c-border-soft);
  border-radius: 32px;
  padding: 36px;
  margin-bottom: 36px;
  box-shadow: 0 24px 64px rgba(15,23,42,0.06);
}
.hero-kicker {
  font-size: 0.8rem; font-weight: 800;
  letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--c-meta); margin-bottom: 12px;
}
.hero h1 {
  font-size: clamp(2rem, 4vw, 3.4rem);
  font-weight: 800; line-height: 1.02;
  letter-spacing: -0.04em; color: var(--c-display);
  margin: 0 0 16px;
}
.hero-tagline {
  font-size: 1.02rem; color: var(--c-body);
  line-height: 1.7; max-width: 720px;
}

/* === LAYOUT GRID 3 COLUMNAS === */
.content-grid {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 32px;
  align-items: start;
}
.articles-stack > * + * { margin-top: 24px; }

.article-row {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 24px;
  align-items: start;
}

/* === ARTICLE CARD === */
.article-card {
  background: var(--c-white);
  border: 1px solid var(--c-border-soft);
  border-radius: 24px;
  padding: 28px;
  box-shadow: 0 16px 44px rgba(15,23,42,0.05);
}
.cat-pill {
  display: inline-block;
  padding: 6px 14px;
  background: var(--c-cat-bg);
  color: var(--c-cat-text);
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: lowercase;
  margin-bottom: 14px;
}
.article-title {
  font-size: 1.5rem; font-weight: 800;
  letter-spacing: -0.02em; line-height: 1.2;
  margin: 0 0 12px;
}
.article-title a { color: var(--c-display); text-decoration: none; }
.article-title a:hover { color: var(--c-link); }
.article-meta {
  font-size: 0.85rem; color: var(--c-soft);
  margin-bottom: 14px; letter-spacing: 0.02em;
}
.article-brief {
  font-size: 1rem; color: var(--c-body); line-height: 1.7;
}

/* === IMAGEN CONTENEDOR (PLACEHOLDER MOCKUP) === */
.article-thumb {
  position: relative;
  width: 220px;
  height: 220px;
  background: var(--c-cream);
  border-radius: 18px;
  overflow: hidden;
  flex-shrink: 0;
}

/* === MOCKUP HomeCallWindow ADAPTADO === */
.blog-mockup {
  position: absolute;
  inset: 6%;
  border-radius: 14%;
  background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,247,251,0.98) 100%);
  border: 1px solid rgba(148,163,184,0.18);
  box-shadow: 0 12px 28px rgba(15,23,42,0.10);
  overflow: hidden;
}
.blog-mockup > .topbar {
  position: absolute;
  top: 6%; left: 6%; right: 6%;
  height: 11%;
  border-radius: 999px;
  background: rgba(241,245,249,0.95);
  border: 1px solid rgba(148,163,184,0.18);
}
.blog-mockup > .video {
  position: absolute;
  left: 8%; right: 8%;
  top: 22%; bottom: 22%;
  border-radius: 12%;
  background:
    radial-gradient(circle at 50% 34%, rgba(255,255,255,0.85) 0 11%, transparent 11.5%),
    radial-gradient(circle at 50% 67%, rgba(255,255,255,0.70) 0 22%, transparent 22.5%),
    linear-gradient(180deg, #d8e2ea 0%, #b8c8d8 100%);
  overflow: hidden;
}
.blog-mockup > .floating {
  position: absolute;
  bottom: 28%;
  width: 26%;
  aspect-ratio: 4 / 5;
  border-radius: 16%;
  background:
    radial-gradient(circle at 50% 28%, rgba(255,255,255,0.86) 0 15%, transparent 15.5%),
    radial-gradient(circle at 50% 66%, rgba(255,255,255,0.76) 0 26%, transparent 26.5%),
    linear-gradient(180deg, #dbe8f2 0%, #c7d7e5 100%);
  border: 1px solid rgba(255,255,255,0.5);
  box-shadow: 0 8px 18px rgba(15,23,42,0.16);
}
/* Por defecto: PIP a la derecha */
.blog-mockup > .floating { right: 12%; }
/* Variante: PIP a la izquierda (alternancia) */
.article-row:nth-child(even) .blog-mockup > .floating {
  right: auto;
  left: 12%;
}
.blog-mockup > .controls {
  position: absolute;
  left: 50%; bottom: 6%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
}
.blog-mockup > .controls > .ctrl {
  width: 12%;
  aspect-ratio: 1 / 1;
  min-width: 14px;
  border-radius: 999px;
  background: rgba(241,245,249,0.96);
  border: 1px solid rgba(148,163,184,0.18);
  box-shadow: 0 4px 9px rgba(15,23,42,0.08);
}
.blog-mockup > .shine {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top left, rgba(255,255,255,0.85), transparent 34%),
    linear-gradient(135deg, rgba(255,255,255,0.34), rgba(255,255,255,0));
  pointer-events: none;
}

/* === SIDEBAR === */
.sidebar {
  background: var(--c-white);
  border: 1px solid var(--c-border-soft);
  border-radius: 26px;
  padding: 28px;
  position: sticky;
  top: 88px;
}
.sidebar-section + .sidebar-section { margin-top: 24px; }
.sidebar-cat {
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--c-meta);
  margin-bottom: 8px;
}
.sidebar-link {
  display: block;
  font-size: 0.92rem;
  color: #5f6c7b;
  text-decoration: none;
  padding: 6px 0;
  line-height: 1.4;
  transition: color 0.15s;
}
.sidebar-link:hover { color: var(--c-display); }

/* === ARTICLE BODY (solo plantilla B) === */
.article-detail-card {
  background: var(--c-white);
  border: 1px solid var(--c-border-soft);
  border-radius: 28px;
  padding: 36px;
  box-shadow: 0 16px 44px rgba(15,23,42,0.05);
}
.article-detail-title {
  font-size: clamp(1.8rem, 3.4vw, 2.6rem);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--c-display);
  margin: 0 0 16px;
}
.article-detail-meta {
  font-size: 0.9rem;
  color: var(--c-soft);
  margin-bottom: 20px;
}
.article-detail-brief {
  font-size: 1.1rem;
  color: var(--c-body);
  background: #fafafa;
  border-left: 3px solid var(--c-link);
  padding: 16px;
  margin: 24px 0;
  border-radius: 0 8px 8px 0;
}
.article-body {
  font-size: 1.02rem;
  color: var(--c-body);
  line-height: 1.78;
}
.article-body h2 {
  font-size: 1.45rem; font-weight: 800;
  line-height: 1.25; letter-spacing: -0.01em;
  color: var(--c-display);
  margin: 2.5rem 0 1rem;
}
.article-body h3 {
  font-size: 1.18rem; font-weight: 700;
  line-height: 1.3; color: var(--c-display);
  margin: 2rem 0 0.8rem;
}
.article-body p { margin: 1rem 0; }
.article-body ul, .article-body ol { margin: 1rem 0; padding-left: 2rem; }
.article-body blockquote {
  border-left: 3px solid #ccc;
  padding-left: 1rem;
  margin: 1rem 0;
  color: #555;
}
.article-body a {
  color: var(--c-link); text-decoration: none;
  border-bottom: 1px solid var(--c-link);
}
.article-body a:hover { color: var(--c-link-hover); border-bottom-color: var(--c-link-hover); }

.back-link {
  display: inline-block;
  margin-bottom: 24px;
  color: var(--c-link);
  text-decoration: none;
  font-weight: 700;
}
.back-link:hover { color: var(--c-link-hover); }

/* === FOOTER MINI === */
.footer-mini {
  background: #0f0f0f;
  color: #d1d5db;
  text-align: center;
  padding: 32px 16px;
  font-size: 0.85rem;
  margin-top: 60px;
}
.footer-mini strong {
  color: #f9fafb;
  font-size: 1.4rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  display: block;
  margin-bottom: 8px;
}

/* === RESPONSIVE === */
@media (max-width: 980px) {
  .content-grid { grid-template-columns: 1fr; }
  .article-row { grid-template-columns: 1fr; }
  .article-thumb { width: 100%; height: 220px; }
  .sidebar { position: static; }
}
'@
}

function Get-BlogNavbarHtml {
    # Navbar identico para listado y detalle. Marca /blog como activo.
    return @'
<nav class="nav">
  <div class="nav-left">
    <a href="/" class="nav-logo">
      <img src="https://assets.test.sharemechat.com/brand/SharemeChat_green.svg" alt="SharemeChat">
    </a>
    <div class="nav-links">
      <a href="/" class="nav-link">Inicio</a>
      <a href="/blog" class="nav-link active">Blog</a>
    </div>
  </div>
  <a href="/client" class="nav-cta">Mi cuenta &rarr;</a>
</nav>
'@
}

function Get-BlogFooterHtml {
    # Footer mini identico para listado y detalle.
    return @'
<div class="footer-mini">
  <strong>SharemeChat&reg;</strong>
  Shareme Technologies O&Uuml; &middot; contact@sharemechat.com
</div>
'@
}

function Truncate-Title {
    # Trunca un titulo a $MaxChars y anade ellipsis ASCII '...' si se cortaba.
    # No se preocupa por palabras enteras: el sidebar busca densidad visual,
    # no legibilidad detallada.
    param(
        [AllowNull()][AllowEmptyString()][string]$Title,
        [int]$MaxChars = 50
    )
    if ([string]::IsNullOrEmpty($Title)) { return "" }
    if ($Title.Length -le $MaxChars) { return $Title }
    if ($MaxChars -le 3) { return $Title.Substring(0, $MaxChars) }
    return $Title.Substring(0, $MaxChars - 3).TrimEnd() + "..."
}

function Build-BlogSidebarHtml {
    # Construye el <aside class="sidebar"> agrupando articulos por category.
    # Output identico para listado y detalle (orden alfabetico de categorias,
    # titulos truncados a 50 chars).
    param(
        [Parameter(Mandatory)][AllowEmptyCollection()][array]$Articles
    )

    if ($null -eq $Articles -or $Articles.Count -eq 0) {
        return @'
  <aside class="sidebar">
    <div class="sidebar-section">
      <div class="sidebar-cat">SIN ART&Iacute;CULOS</div>
    </div>
  </aside>
'@
    }

    # Agrupar manualmente para preservar orden de inserccion + control sobre la
    # categoria por defecto cuando viene null/blank desde backend.
    $byCategory = [ordered]@{}
    foreach ($a in $Articles) {
        $rawCat = if ($null -ne $a.category) { [string]$a.category } else { "" }
        $cat    = if ([string]::IsNullOrWhiteSpace($rawCat)) { "general" } else { $rawCat.ToLower() }
        if (-not $byCategory.Contains($cat)) {
            $byCategory[$cat] = New-Object System.Collections.Generic.List[object]
        }
        $byCategory[$cat].Add($a) | Out-Null
    }

    # Orden alfabetico estable de las claves para evitar churn entre runs.
    $sortedKeys = @($byCategory.Keys) | Sort-Object

    $sections = @()
    foreach ($cat in $sortedKeys) {
        $catUpperEsc = Escape-HtmlAttribute ($cat.ToUpper())
        $linkLines   = @()
        foreach ($a in $byCategory[$cat]) {
            $aSlug      = if ($null -ne $a.slug)  { [string]$a.slug }  else { "" }
            $aTitle     = if ($null -ne $a.title) { [string]$a.title } else { "" }
            $titleTrunc = Truncate-Title -Title $aTitle -MaxChars 50
            $titleEsc   = Escape-HtmlAttribute $titleTrunc
            $slugEsc    = Escape-HtmlAttribute $aSlug
            $linkLines += "      <a href=`"/blog/$slugEsc`" class=`"sidebar-link`">$titleEsc</a>"
        }
        $linksJoined = $linkLines -join "`n"
        $sections += @"
    <div class="sidebar-section">
      <div class="sidebar-cat">$catUpperEsc</div>
$linksJoined
    </div>
"@
    }
    $sectionsJoined = $sections -join "`n"

    return @"
  <aside class="sidebar">
$sectionsJoined
  </aside>
"@
}

# ---------------------------------------------------------------
# 8. Funcion: componer HTML del DETALLE (plantilla B de ADR-018 D7)
# ---------------------------------------------------------------
function Build-DetailHtml {
    param(
        [Parameter(Mandatory)]$Detail,
        [Parameter(Mandatory)][string]$BaseUrl,
        [Parameter(Mandatory)][AllowEmptyCollection()][array]$AllArticles
    )

    $title    = if ($null -ne $Detail.title)    { [string]$Detail.title }    else { "" }
    $slug     = if ($null -ne $Detail.slug)     { [string]$Detail.slug }     else { "" }
    $brief    = if ($null -ne $Detail.brief)    { [string]$Detail.brief }    else { "" }
    $category = if ($null -ne $Detail.category) { [string]$Detail.category } else { "" }
    $locale   = if ($null -ne $Detail.locale)   { [string]$Detail.locale }   else { "es" }
    $htmlBody = if ($null -ne $Detail.htmlBody) { [string]$Detail.htmlBody } else { "" }
    $disclosureRequired = $false
    if ($null -ne $Detail.disclosureRequired) { $disclosureRequired = [bool]$Detail.disclosureRequired }

    $localeLower = $locale.ToLower()
    $localeUpper = $locale.ToUpper()
    $categoryLower = $category.ToLower()
    $publishedAtIso   = Format-Iso8601 $Detail.publishedAt
    $updatedAtRaw     = if ($null -ne $Detail.updatedAt) { [string]$Detail.updatedAt } else { "" }
    $updatedAtIso     = if ([string]::IsNullOrWhiteSpace($updatedAtRaw)) { $publishedAtIso } else { Format-Iso8601 $updatedAtRaw }
    $publishedAtShort = Format-DateYmd $Detail.publishedAt

    $briefTrunc = Get-TruncatedBrief -Brief $brief -MaxChars 160

    # Escapados para inyectar en atributos / contenido HTML
    $titleEsc          = Escape-HtmlAttribute $title
    $briefTruncEsc     = Escape-HtmlAttribute $briefTrunc
    $briefFullEsc      = Escape-HtmlAttribute $brief
    $categoryLowerEsc  = Escape-HtmlAttribute $categoryLower
    $localeLowerEsc    = Escape-HtmlAttribute $localeLower
    $localeUpperEsc    = Escape-HtmlAttribute $localeUpper
    $articleUrl        = "$BaseUrl/blog/$slug"
    $articleUrlEsc     = Escape-HtmlAttribute $articleUrl
    $ogLocale          = "${localeLower}_ES"
    $ogLocaleEsc       = Escape-HtmlAttribute $ogLocale
    $inLanguage        = "$localeLower-ES"

    # JSON-LD: construir como hashtable y serializar con ConvertTo-Json -Compress.
    # Los valores van sin escape HTML (es JSON, no HTML); ConvertTo-Json los escapa
    # a JSON correctamente. Defensivamente reemplazamos </ por <\/ para evitar que
    # un title o brief con la cadena </script> rompa el bloque.
    $jsonLd = [ordered]@{
        '@context'      = 'https://schema.org'
        '@type'         = 'Article'
        'headline'      = $title
        'description'   = $briefTrunc
        'url'           = $articleUrl
        'datePublished' = $publishedAtIso
        'dateModified'  = $updatedAtIso
        'inLanguage'    = $inLanguage
        'author'        = [ordered]@{
            '@type' = 'Organization'
            'name'  = 'Equipo SharemeChat'
        }
        'publisher'     = [ordered]@{
            '@type' = 'Organization'
            'name'  = 'SharemeChat'
            'url'   = $BaseUrl
        }
    }
    $jsonLdString = $jsonLd | ConvertTo-Json -Depth 10 -Compress
    $jsonLdString = $jsonLdString -replace '</', '<\/'

    # Bloque opcional de disclosure IA, debajo del cuerpo del articulo.
    $disclosure = ""
    if ($disclosureRequired) {
        $disclosure = "`n        <p style=`"margin-top:2rem; padding-top:1rem; border-top:1px solid var(--c-border-soft); color:var(--c-meta); font-size:0.9rem;`">Contenido elaborado con asistencia de IA.</p>"
    }

    $cssBlock    = Get-BlogCommonCss
    $navbarHtml  = Get-BlogNavbarHtml
    $footerHtml  = Get-BlogFooterHtml
    $sidebarHtml = Build-BlogSidebarHtml -Articles $AllArticles

    $html = @"
<!DOCTYPE html>
<html lang="$localeLowerEsc">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>$titleEsc | SharemeChat</title>
  <meta name="description" content="$briefTruncEsc">
  <link rel="canonical" href="$articleUrlEsc">
  <meta property="og:type" content="article">
  <meta property="og:title" content="$titleEsc">
  <meta property="og:description" content="$briefTruncEsc">
  <meta property="og:url" content="$articleUrlEsc">
  <meta property="og:site_name" content="SharemeChat">
  <meta property="og:locale" content="$ogLocaleEsc">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="$titleEsc">
  <meta name="twitter:description" content="$briefTruncEsc">
  <script type="application/ld+json">
  $jsonLdString
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
$cssBlock
  </style>
</head>
<body>
$navbarHtml

<main class="page-wrap">
  <div class="page-inner">
    <a href="/blog" class="back-link">&larr; Volver al blog</a>

    <div class="article-row">
      <div class="article-thumb">
        <div class="blog-mockup">
          <div class="topbar"></div>
          <div class="video"></div>
          <div class="floating"></div>
          <div class="controls">
            <div class="ctrl"></div><div class="ctrl"></div><div class="ctrl"></div>
          </div>
          <div class="shine"></div>
        </div>
      </div>
      <div class="article-detail-card">
        <span class="cat-pill">$categoryLowerEsc</span>
        <h1 class="article-detail-title">$titleEsc</h1>
        <div class="article-detail-meta">$localeUpperEsc &middot; Publicado $publishedAtShort</div>
        <div class="article-detail-brief">$briefFullEsc</div>
      </div>
    </div>

    <div class="content-grid" style="margin-top: 32px;">
      <article class="article-detail-card">
        <div class="article-body">$htmlBody</div>$disclosure
      </article>

$sidebarHtml
    </div>
  </div>
</main>

$footerHtml
</body>
</html>
"@
    return $html
}

# ---------------------------------------------------------------
# 9. Funcion: componer HTML del LISTADO (plantilla A de ADR-018)
# ---------------------------------------------------------------
function Build-IndexHtml {
    param(
        [Parameter(Mandatory)][AllowEmptyCollection()][array]$Articles,
        [Parameter(Mandatory)][string]$BaseUrl
    )

    $listingUrl    = "$BaseUrl/blog"
    $listingUrlEsc = Escape-HtmlAttribute $listingUrl

    # hasPart: array de objetos { @type, url, name } por cada articulo del listado.
    $hasPart = @()
    foreach ($a in $Articles) {
        $aSlug  = if ($null -ne $a.slug)  { [string]$a.slug }  else { "" }
        $aTitle = if ($null -ne $a.title) { [string]$a.title } else { "" }
        $hasPart += [ordered]@{
            '@type' = 'Article'
            'url'   = "$BaseUrl/blog/$aSlug"
            'name'  = $aTitle
        }
    }

    $jsonLd = [ordered]@{
        '@context' = 'https://schema.org'
        '@type'    = 'CollectionPage'
        'name'     = 'Blog SharemeChat'
        'url'      = $listingUrl
        'hasPart'  = $hasPart
    }
    $jsonLdString = $jsonLd | ConvertTo-Json -Depth 10 -Compress
    # Quirk de PS5: hashtable con valor array vacio se serializa como "hasPart":null.
    # Lo corregimos a [] para producir JSON-LD valido.
    if ($hasPart.Count -eq 0) {
        $jsonLdString = $jsonLdString -replace '"hasPart":null', '"hasPart":[]'
    }
    $jsonLdString = $jsonLdString -replace '</', '<\/'

    # Render del bloque <main>: una <div class="article-row"> por cada item, o
    # el div vacio si la lista esta vacia. La alternancia derecha/izquierda del
    # PIP del mockup la hace solo el CSS (.article-row:nth-child(even)).
    $articlesHtml = @()
    foreach ($a in $Articles) {
        $title    = if ($null -ne $a.title)    { [string]$a.title }    else { "" }
        $slug     = if ($null -ne $a.slug)     { [string]$a.slug }     else { "" }
        $brief    = if ($null -ne $a.brief)    { [string]$a.brief }    else { "" }
        $category = if ($null -ne $a.category) { [string]$a.category } else { "" }
        $locale   = if ($null -ne $a.locale)   { [string]$a.locale }   else { "es" }
        $localeUpper      = $locale.ToUpper()
        $categoryLower    = $category.ToLower()
        $publishedAtShort = Format-DateYmd $a.publishedAt

        $titleEsc          = Escape-HtmlAttribute $title
        $briefEsc          = Escape-HtmlAttribute $brief
        $categoryLowerEsc  = Escape-HtmlAttribute $categoryLower
        $localeUpperEsc    = Escape-HtmlAttribute $localeUpper
        $slugEsc           = Escape-HtmlAttribute $slug

        $articlesHtml += @"
        <div class="article-row">
          <div class="article-thumb">
            <div class="blog-mockup">
              <div class="topbar"></div>
              <div class="video"></div>
              <div class="floating"></div>
              <div class="controls">
                <div class="ctrl"></div><div class="ctrl"></div><div class="ctrl"></div>
              </div>
              <div class="shine"></div>
            </div>
          </div>
          <div class="article-card">
            <span class="cat-pill">$categoryLowerEsc</span>
            <h2 class="article-title"><a href="/blog/$slugEsc">$titleEsc</a></h2>
            <div class="article-meta">$localeUpperEsc &middot; $publishedAtShort</div>
            <p class="article-brief">$briefEsc</p>
          </div>
        </div>
"@
    }

    $articlesBlock = if ($Articles.Count -eq 0) {
        '        <div style="text-align:center; padding:48px; color:var(--c-meta);">A&uacute;n no hay art&iacute;culos publicados.</div>'
    } else {
        $articlesHtml -join "`n"
    }

    $cssBlock    = Get-BlogCommonCss
    $navbarHtml  = Get-BlogNavbarHtml
    $footerHtml  = Get-BlogFooterHtml
    $sidebarHtml = Build-BlogSidebarHtml -Articles $Articles

    $html = @"
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Blog &mdash; SharemeChat</title>
  <meta name="description" content="Art&iacute;culos y notas sobre videochat 1-a-1, privacidad, modelos, pagos.">
  <link rel="canonical" href="$listingUrlEsc">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Blog &mdash; SharemeChat">
  <meta property="og:description" content="Art&iacute;culos y notas sobre videochat 1-a-1, privacidad, modelos, pagos.">
  <meta property="og:url" content="$listingUrlEsc">
  <meta property="og:site_name" content="SharemeChat">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="Blog &mdash; SharemeChat">
  <script type="application/ld+json">
  $jsonLdString
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
$cssBlock
  </style>
</head>
<body>
$navbarHtml

<main class="page-wrap">
  <div class="page-inner">
    <section class="hero">
      <div class="hero-kicker">SHAREMECHAT JOURNAL</div>
      <h1>Blog</h1>
      <p class="hero-tagline">Art&iacute;culos y notas sobre videochat 1-a-1, privacidad, modelos y pagos.</p>
    </section>

    <div class="content-grid">
      <div class="articles-stack">
$articlesBlock
      </div>

$sidebarHtml
    </div>
  </div>
</main>

$footerHtml
</body>
</html>
"@
    return $html
}

# ---------------------------------------------------------------
# 10. Generar ficheros locales (detalles + listado)
# ---------------------------------------------------------------
$detailFiles = @()
foreach ($d in $details) {
    $slug = [string]$d.slug
    if ([string]::IsNullOrWhiteSpace($slug)) { continue }
    $html = Build-DetailHtml -Detail $d -BaseUrl $publicBaseUrl -AllArticles $articles
    # Nombre local con extension .html para que sea inspeccionable; en S3 se sube
    # con key 'blog/<slug>' (sin extension).
    $localPath = Join-Path $tempDir "$slug.html"
    Write-Utf8NoBom -Path $localPath -Content $html
    $detailFiles += [pscustomobject]@{ slug = $slug; path = $localPath }
}

# El listado se genera SIEMPRE, incluso si articles esta vacio (renderiza el estado
# 'Aun no hay articulos publicados.').
$indexHtml = Build-IndexHtml -Articles $articles -BaseUrl $publicBaseUrl
$indexPath = Join-Path $tempDir "index.html"
Write-Utf8NoBom -Path $indexPath -Content $indexHtml

Write-Host "    Generados $($detailFiles.Count) detalles + 1 listado." -ForegroundColor Green

# ---------------------------------------------------------------
# 11. DryRun: salir sin tocar AWS
# ---------------------------------------------------------------
if ($DryRun) {
    $elapsed = (Get-Date) - $startTime
    Write-Host ""
    Write-Host "===============================================" -ForegroundColor Yellow
    Write-Host " [DryRun] Sin cambios en AWS." -ForegroundColor Yellow
    Write-Host "===============================================" -ForegroundColor Yellow
    Write-Host " Articulos generados: $($detailFiles.Count) (+ 1 listado)"
    Write-Host " Errores de detalle:  $($detailErrors.Count)"
    Write-Host " Ruta local:          $tempDir"
    Write-Host " Tiempo total:        $([Math]::Round($elapsed.TotalSeconds, 1))s"
    Write-Host ""
    Write-Host "Inspecciona los HTML generados manualmente." -ForegroundColor Yellow
    if ($detailErrors.Count -gt 0) {
        Write-Host "Slugs con error de detalle:" -ForegroundColor Yellow
        foreach ($e in $detailErrors) {
            Write-Host "  - $($e.slug): $($e.error)" -ForegroundColor Yellow
        }
    }
    exit 0
}

# ---------------------------------------------------------------
# 12. SkipUpload: salir sin tocar AWS pero indicandolo distinto
# ---------------------------------------------------------------
if ($SkipUpload) {
    $elapsed = (Get-Date) - $startTime
    Write-Host ""
    Write-Host "===============================================" -ForegroundColor Yellow
    Write-Host " [SkipUpload] HTML generado, sin subir a AWS." -ForegroundColor Yellow
    Write-Host "===============================================" -ForegroundColor Yellow
    Write-Host " Articulos generados: $($detailFiles.Count) (+ 1 listado)"
    Write-Host " Errores de detalle:  $($detailErrors.Count)"
    Write-Host " Ruta local:          $tempDir"
    Write-Host " Tiempo total:        $([Math]::Round($elapsed.TotalSeconds, 1))s"
    exit 0
}

# ---------------------------------------------------------------
# 13. Subir a S3
# ---------------------------------------------------------------
Write-Host ""
Write-Host "[4] Subiendo a s3://$bucketName/ ..." -ForegroundColor Cyan
$uploadCount = 0

foreach ($f in $detailFiles) {
    $key = "blog/$($f.slug)"
    Write-Host "    -> $key" -ForegroundColor Gray
    aws s3 cp $f.path "s3://$bucketName/$key" `
        --content-type "text/html; charset=utf-8" `
        --cache-control "public, max-age=3600, must-revalidate"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: aws s3 cp $key fallo con codigo $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
    $uploadCount++
}

# Listado: TTL mas corto (10 min) porque cambia con cualquier nueva publicacion.
Write-Host "    -> blog (listado)" -ForegroundColor Gray
aws s3 cp $indexPath "s3://$bucketName/blog" `
    --content-type "text/html; charset=utf-8" `
    --cache-control "public, max-age=600, must-revalidate"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: aws s3 cp listado fallo con codigo $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}
$uploadCount++

# ---------------------------------------------------------------
# 14. Invalidar CloudFront
# ---------------------------------------------------------------
Write-Host ""
Write-Host "[5] Invalidando CloudFront $distributionId (paths /blog y /blog/*) ..." -ForegroundColor Cyan
aws cloudfront create-invalidation --distribution-id $distributionId --paths "/blog" "/blog/*"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: invalidacion fallo con codigo $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

# ---------------------------------------------------------------
# 15. Resumen final
# ---------------------------------------------------------------
$elapsed = (Get-Date) - $startTime

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host " Pre-render blog completado." -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host " Articulos publicados:     $($articles.Count)"
Write-Host " Detalles renderizados:    $($detailFiles.Count)"
Write-Host " Detalles con error:       $($detailErrors.Count)"
Write-Host " URLs subidas a S3:        $uploadCount  ($($detailFiles.Count) detalles + 1 listado)"
Write-Host " Invalidacion CloudFront:  1 (paths /blog /blog/*)"
Write-Host " Ruta local:               $tempDir"
Write-Host " Tiempo total:             $([Math]::Round($elapsed.TotalSeconds, 1))s"
Write-Host ""

if ($detailErrors.Count -gt 0) {
    Write-Host "AVISO: $($detailErrors.Count) articulos fallaron al recuperar detalle (snapshot parcial subido):" -ForegroundColor Yellow
    foreach ($e in $detailErrors) {
        Write-Host "  - $($e.slug): $($e.error)" -ForegroundColor Yellow
    }
    Write-Host ""
}

Write-Host "Verificar (esperar 30-90s tras invalidacion):" -ForegroundColor Yellow
Write-Host "  curl -sSI $publicBaseUrl/blog | head -n 5" -ForegroundColor Yellow
if ($detailFiles.Count -gt 0) {
    Write-Host "  curl -s   $publicBaseUrl/blog/$($detailFiles[0].slug) | head -n 30" -ForegroundColor Yellow
}
Write-Host ""
