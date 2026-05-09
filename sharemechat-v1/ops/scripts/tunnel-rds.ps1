<#
.SYNOPSIS
    Abre un tunel SSH a la base de datos RDS de un entorno SharemeChat.

.DESCRIPTION
    Lee la tabla de mapeo en ~/.sharemechat/state-mapping.yaml para obtener
    el endpoint RDS y el alias SSH del entorno solicitado, y abre un tunel
    SSH local con port forwarding al puerto 3306 del RDS.

    El tunel queda en foreground en la PowerShell donde se ejecuta. Para
    cerrarlo, pulsar Ctrl+C.

    Antes de abrir el tunel, valida:
      - que el entorno existe en el mapping
      - que el campo rds_endpoint_real esta relleno (no vacio)
      - que el campo ec2_backend_ssh_alias esta relleno
      - que el puerto local 3307 NO esta ya ocupado (otro tunel previo)
      - que el alias SSH responde

.PARAMETER Environment
    Identificador del entorno: test, audit o pro.

.PARAMETER LocalPort
    Puerto local donde se hara el bind. Por defecto 3307.

.EXAMPLE
    .\tunnel-rds.ps1 test

    Abre tunel a RDS TEST en localhost:3307 usando el SSH alias 'test-backend'.

.NOTES
    Requiere:
      - ~/.sharemechat/state-mapping.yaml con el bloque del entorno relleno
      - ssh client en PATH
      - powershell-yaml module (se instala on demand si falta)
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('test', 'audit', 'pro')]
    [string]$Environment,

    [Parameter(Mandatory = $false)]
    [int]$LocalPort = 3307
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------
# 1. Localizar y leer el mapping
# ---------------------------------------------------------------
$mappingPath = Join-Path $HOME '.sharemechat\state-mapping.yaml'
if (-not (Test-Path $mappingPath)) {
    Write-Host "ERROR: No se encuentra $mappingPath" -ForegroundColor Red
    Write-Host "Crea el fichero antes de continuar. Ver docs/skills/state-inventory.md." -ForegroundColor Yellow
    exit 1
}

# Asegurarse de que powershell-yaml esta disponible
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
# 2. Validar campos requeridos
# ---------------------------------------------------------------
$rdsEndpoint = $envBlock.rds_endpoint_real
$sshAlias = $envBlock.ec2_backend_ssh_alias

if ([string]::IsNullOrWhiteSpace($rdsEndpoint)) {
    Write-Host "ERROR: rds_endpoint_real vacio para entorno '$Environment'." -ForegroundColor Red
    Write-Host "Editar $mappingPath y rellenar el campo." -ForegroundColor Yellow
    exit 1
}

if ([string]::IsNullOrWhiteSpace($sshAlias)) {
    Write-Host "ERROR: ec2_backend_ssh_alias vacio para entorno '$Environment'." -ForegroundColor Red
    Write-Host "Editar $mappingPath y rellenar el campo." -ForegroundColor Yellow
    exit 1
}

# ---------------------------------------------------------------
# 3. Verificar que el puerto local NO esta ocupado
# ---------------------------------------------------------------
$portCheck = Test-NetConnection -ComputerName 127.0.0.1 -Port $LocalPort -WarningAction SilentlyContinue -InformationLevel Quiet

if ($portCheck) {
    Write-Host "ERROR: El puerto local $LocalPort ya esta ocupado." -ForegroundColor Red
    Write-Host "Otro tunel SSH puede estar abierto. Cierralo (Ctrl+C en su PowerShell) o usa -LocalPort N para otro puerto." -ForegroundColor Yellow
    exit 1
}

# ---------------------------------------------------------------
# 4. Validar que el alias SSH responde
# ---------------------------------------------------------------
Write-Host "Verificando alias SSH '$sshAlias'..." -ForegroundColor Cyan
$sshTest = & ssh -o BatchMode=yes -o ConnectTimeout=5 $sshAlias "echo ok" 2>$null

if ($LASTEXITCODE -ne 0 -or $sshTest -ne 'ok') {
    Write-Host "ERROR: El alias SSH '$sshAlias' no responde." -ForegroundColor Red
    Write-Host "Comprueba ~/.ssh/config y que la EC2 esta accesible." -ForegroundColor Yellow
    exit 1
}

# ---------------------------------------------------------------
# 5. Abrir el tunel
# ---------------------------------------------------------------
Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host " Abriendo tunel SSH a RDS $($Environment.ToUpper())" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host " Local:    127.0.0.1:$LocalPort" -ForegroundColor Cyan
Write-Host " Remoto:   $rdsEndpoint`:3306" -ForegroundColor Cyan
Write-Host " Bastion:  $sshAlias" -ForegroundColor Cyan
Write-Host ""
Write-Host " El tunel queda abierto. Para cerrarlo: Ctrl+C." -ForegroundColor Yellow
Write-Host ""

# Comando final
ssh -L "${LocalPort}:${rdsEndpoint}:3306" $sshAlias -N