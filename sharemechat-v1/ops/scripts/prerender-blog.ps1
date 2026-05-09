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
    Identificador del entorno: test, audit o pro.

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
    [ValidateSet('test', 'audit', 'pro')]
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
    Write-Host "Ver docs/skills/state-inventory.md para crear el fichero." -ForegroundColor Yellow
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
# 8. Funcion: componer HTML del DETALLE (plantilla B de ADR-018 D7)
# ---------------------------------------------------------------
function Build-DetailHtml {
    param(
        [Parameter(Mandatory)]$Detail,
        [Parameter(Mandatory)][string]$BaseUrl
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
    $publishedAtIso   = Format-Iso8601 $Detail.publishedAt
    $updatedAtRaw     = if ($null -ne $Detail.updatedAt) { [string]$Detail.updatedAt } else { "" }
    $updatedAtIso     = if ([string]::IsNullOrWhiteSpace($updatedAtRaw)) { $publishedAtIso } else { Format-Iso8601 $updatedAtRaw }
    $publishedAtShort = Format-DateYmd $Detail.publishedAt

    $briefTrunc = Get-TruncatedBrief -Brief $brief -MaxChars 160

    # Escapados para inyectar en atributos / contenido HTML
    $titleEsc        = Escape-HtmlAttribute $title
    $briefTruncEsc   = Escape-HtmlAttribute $briefTrunc
    $briefFullEsc    = Escape-HtmlAttribute $brief
    $categoryEsc     = Escape-HtmlAttribute $category
    $localeLowerEsc  = Escape-HtmlAttribute $localeLower
    $localeUpperEsc  = Escape-HtmlAttribute $localeUpper
    $articleUrl      = "$BaseUrl/blog/$slug"
    $articleUrlEsc   = Escape-HtmlAttribute $articleUrl
    $ogLocale        = "${localeLower}_ES"
    $ogLocaleEsc     = Escape-HtmlAttribute $ogLocale
    $inLanguage      = "$localeLower-ES"

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

    # Bloque opcional de disclosure IA dentro del footer
    $disclosure = ""
    if ($disclosureRequired) {
        $disclosure = "`n    <p>Contenido elaborado con asistencia de IA.</p>"
    }

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
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 720px; margin: 0 auto; padding: 2rem; line-height: 1.7; color: #222; }
    h1 { font-size: 2.2rem; line-height: 1.2; margin-top: 0; }
    h2 { font-size: 1.5rem; margin-top: 2rem; }
    h3 { font-size: 1.2rem; margin-top: 1.5rem; }
    p { margin: 1rem 0; }
    ul, ol { margin: 1rem 0; padding-left: 2rem; }
    blockquote { border-left: 3px solid #ccc; padding-left: 1rem; margin: 1rem 0; color: #555; }
    code { background: #f5f5f5; padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.9rem; }
    pre { background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; }
    a { color: #0070f3; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .category { display: inline-block; background: #f0f0f0; padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.85rem; color: #444; margin-bottom: 1rem; }
    .meta { color: #666; font-size: 0.9rem; margin-bottom: 1.5rem; }
    .brief { font-size: 1.1rem; color: #444; padding: 1rem; background: #fafafa; border-left: 3px solid #0070f3; margin: 1.5rem 0; }
    .back { display: inline-block; margin-bottom: 1rem; color: #0070f3; }
    footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #eee; color: #888; font-size: 0.9rem; }
    article > .body img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <a href="/blog" class="back">&larr; Volver al blog</a>
  <article>
    <span class="category">$categoryEsc</span>
    <h1>$titleEsc</h1>
    <div class="meta">$localeUpperEsc &middot; Publicado $publishedAtShort</div>
    <div class="brief">$briefFullEsc</div>
    <div class="body">$htmlBody</div>
  </article>
  <footer>$disclosure
    <p><a href="/">Volver a SharemeChat</a></p>
  </footer>
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

    # Render del bloque <main>: una <article> por cada item, o el div vacio si la lista
    # esta vacia.
    $articlesHtml = @()
    foreach ($a in $Articles) {
        $title    = if ($null -ne $a.title)    { [string]$a.title }    else { "" }
        $slug     = if ($null -ne $a.slug)     { [string]$a.slug }     else { "" }
        $brief    = if ($null -ne $a.brief)    { [string]$a.brief }    else { "" }
        $category = if ($null -ne $a.category) { [string]$a.category } else { "" }
        $locale   = if ($null -ne $a.locale)   { [string]$a.locale }   else { "es" }
        $localeUpper      = $locale.ToUpper()
        $publishedAtShort = Format-DateYmd $a.publishedAt

        $titleEsc       = Escape-HtmlAttribute $title
        $briefEsc       = Escape-HtmlAttribute $brief
        $categoryEsc    = Escape-HtmlAttribute $category
        $localeUpperEsc = Escape-HtmlAttribute $localeUpper
        $slugEsc        = Escape-HtmlAttribute $slug

        $articlesHtml += @"
    <article>
      <span class="category">$categoryEsc</span>
      <h2><a href="/blog/$slugEsc">$titleEsc</a></h2>
      <div class="meta">$localeUpperEsc &middot; $publishedAtShort</div>
      <p>$briefEsc</p>
    </article>
"@
    }

    $articlesBlock = if ($Articles.Count -eq 0) {
        '    <div class="empty">A&uacute;n no hay art&iacute;culos publicados.</div>'
    } else {
        $articlesHtml -join "`n"
    }

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
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; color: #222; }
    h1 { font-size: 2rem; }
    article { border-bottom: 1px solid #eee; padding: 1.5rem 0; }
    article:last-child { border-bottom: none; }
    h2 { font-size: 1.4rem; margin: 0; }
    h2 a { color: #0070f3; text-decoration: none; }
    h2 a:hover { text-decoration: underline; }
    .meta { color: #666; font-size: 0.9rem; margin-top: 0.5rem; }
    .category { display: inline-block; background: #f0f0f0; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.85rem; color: #444; }
    .empty { color: #888; padding: 2rem 0; text-align: center; }
    a.home { color: #0070f3; text-decoration: none; }
  </style>
</head>
<body>
  <header>
    <a href="/" class="home">&larr; SharemeChat</a>
    <h1>Blog</h1>
    <p>Art&iacute;culos y notas sobre videochat 1-a-1, privacidad, modelos y pagos.</p>
  </header>
  <main>
$articlesBlock
  </main>
  <footer>
    <p><a href="/" class="home">Volver a SharemeChat</a></p>
  </footer>
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
    $html = Build-DetailHtml -Detail $d -BaseUrl $publicBaseUrl
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
