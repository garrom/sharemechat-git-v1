<#
.SYNOPSIS
    Despliega un frontend (producto o admin) de SharemeChat al S3+CloudFront del entorno indicado.

.DESCRIPTION
    Lee la tabla de mapeo en ~/.sharemechat/state-mapping.yaml, resuelve el bucket S3
    y la distribución CloudFront correctos según el entorno y la superficie (product/admin),
    construye el frontend con el script CRA correspondiente, sube al bucket y crea
    invalidación de cache en la distribución correcta.

    Sustituye los comandos manuales de deploy que históricamente confundían IDs.

.PARAMETER Environment
    Identificador del entorno: test, audit o pro.

.PARAMETER Surface
    Superficie a desplegar: product (frontend público) o admin (backoffice).

.PARAMETER SkipBuild
    Si se especifica, saltar el paso de build (asume build/ ya existe).

.PARAMETER DryRun
    Si se especifica, mostrar qué comandos se ejecutarían sin ejecutarlos.

.EXAMPLE
    .\deploy-frontend.ps1 test product

    Despliega el frontend producto al entorno TEST, invalidando la distribución correcta
    (frontend_public según el mapping).

.EXAMPLE
    .\deploy-frontend.ps1 test admin -DryRun

    Muestra qué comandos se ejecutarían para desplegar el admin a TEST sin ejecutar nada.

.NOTES
    Requiere:
      - ~/.sharemechat/state-mapping.yaml con bloque del entorno relleno (cloudfront_distributions y s3_buckets)
      - aws CLI configurado con permisos s3:PutObject* y cloudfront:CreateInvalidation
      - npm en PATH y carpeta frontend/ con scripts build:product y build:admin
      - powershell-yaml module (se instala on demand si falta)
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('test', 'audit', 'pro')]
    [string]$Environment,

    [Parameter(Mandatory = $true, Position = 1)]
    [ValidateSet('product', 'admin')]
    [string]$Surface,

    [Parameter(Mandatory = $false)]
    [switch]$SkipBuild,

    [Parameter(Mandatory = $false)]
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------
# 1. Resolver rutas y mapping
# ---------------------------------------------------------------
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$frontendDir = Join-Path $repoRoot "frontend"
$buildDir = Join-Path $frontendDir "build"
$indexHtml = Join-Path $buildDir "index.html"
$mappingPath = Join-Path $HOME '.sharemechat\state-mapping.yaml'

if (-not (Test-Path $mappingPath)) {
    Write-Host "ERROR: No se encuentra $mappingPath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $frontendDir)) {
    Write-Host "ERROR: No se encuentra carpeta frontend en $frontendDir" -ForegroundColor Red
    exit 1
}

# Asegurarse de que powershell-yaml está disponible
if (-not (Get-Module -ListAvailable -Name powershell-yaml)) {
    Write-Host "Instalando módulo powershell-yaml..." -ForegroundColor Cyan
    Install-Module -Name powershell-yaml -Scope CurrentUser -Force -ErrorAction Stop
}
Import-Module powershell-yaml

$mapping = Get-Content $mappingPath -Raw | ConvertFrom-Yaml

if (-not $mapping.environments.$Environment) {
    Write-Host "ERROR: Entorno '$Environment' no existe en el mapping." -ForegroundColor Red
    exit 1
}

$envBlock = $mapping.environments.$Environment

# ---------------------------------------------------------------
# 2. Resolver bucket S3 y distribución CloudFront según surface
# ---------------------------------------------------------------
# Convención del mapping:
#   surface=product -> bucket logical_name "frontend_product" servido por distribución "frontend_public"
#   surface=admin   -> bucket logical_name "frontend_admin"   servido por distribución "backoffice_admin"

$bucketLogicalName = if ($Surface -eq 'product') { 'frontend_product' } else { 'frontend_admin' }
$distributionLogicalName = if ($Surface -eq 'product') { 'frontend_public' } else { 'backoffice_admin' }

$bucketEntry = $envBlock.s3_buckets.$bucketLogicalName
if (-not $bucketEntry) {
    Write-Host "ERROR: Bucket '$bucketLogicalName' no encontrado en mapping para '$Environment'." -ForegroundColor Red
    exit 1
}
$bucketName = $bucketEntry.name

$distributionEntry = $envBlock.cloudfront_distributions.$distributionLogicalName
if (-not $distributionEntry) {
    Write-Host "ERROR: Distribución '$distributionLogicalName' no encontrada en mapping para '$Environment'." -ForegroundColor Red
    exit 1
}
$distributionId = $distributionEntry.id

if ([string]::IsNullOrWhiteSpace($bucketName) -or [string]::IsNullOrWhiteSpace($distributionId)) {
    Write-Host "ERROR: Mapping incompleto. bucket='$bucketName' dist='$distributionId'" -ForegroundColor Red
    exit 1
}

# ---------------------------------------------------------------
# 3. Resumen de lo que se va a hacer
# ---------------------------------------------------------------
$buildScript = if ($Surface -eq 'product') { 'build:product' } else { 'build:admin' }

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host " Deploy frontend $Surface -> $($Environment.ToUpper())" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host " Surface:        $Surface"
Write-Host " Build script:   npm run $buildScript"
Write-Host " Bucket S3:      s3://$bucketName/"
Write-Host " Distribución:   $distributionId ($($distributionEntry.alias))"
Write-Host " SkipBuild:      $SkipBuild"
Write-Host " DryRun:         $DryRun"
Write-Host ""

if ($DryRun) {
    Write-Host "[DryRun] No se ejecutará nada. Salida." -ForegroundColor Yellow
    exit 0
}

# ---------------------------------------------------------------
# 4. Build (si no se ha saltado)
# ---------------------------------------------------------------
if (-not $SkipBuild) {
    Write-Host "[1/3] Construyendo frontend ($buildScript)..." -ForegroundColor Cyan
    Push-Location $frontendDir
    try {
        npm run $buildScript
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: build falló con código $LASTEXITCODE" -ForegroundColor Red
            exit $LASTEXITCODE
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Host "[1/3] Build saltado (SkipBuild)." -ForegroundColor Yellow
    if (-not (Test-Path $indexHtml)) {
        Write-Host "ERROR: SkipBuild pero no existe $indexHtml. Aborta." -ForegroundColor Red
        exit 1
    }
}

# ---------------------------------------------------------------
# 5. Sync a S3
# ---------------------------------------------------------------
Write-Host "[2/3] Sync a s3://$bucketName/ ..." -ForegroundColor Cyan
aws s3 sync $buildDir "s3://$bucketName/" --delete --cache-control "public,max-age=31536000,immutable"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: aws s3 sync falló con código $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

# index.html con cache-control restrictivo (el resto del bundle es immutable por hash)
aws s3 cp $indexHtml "s3://$bucketName/index.html" --cache-control "no-cache, no-store, must-revalidate" --content-type "text/html; charset=utf-8"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: aws s3 cp index.html falló con código $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

# ---------------------------------------------------------------
# 6. Invalidar CloudFront (la distribución CORRECTA)
# ---------------------------------------------------------------
Write-Host "[3/3] Invalidando CloudFront $distributionId ..." -ForegroundColor Cyan
aws cloudfront create-invalidation --distribution-id $distributionId --paths "/*"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: invalidación falló con código $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host " Deploy completado." -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host " La invalidación tarda 30-90s en propagarse en CloudFront." -ForegroundColor Yellow
