<#
.SYNOPSIS
    Registra (o elimina) un artefacto fuera de banda (OOB) en el manifest de
    despliegue de un entorno. Schema v2.

.DESCRIPTION
    Los artefactos OOB son cosas desplegadas FUERA del build y por tanto
    invisibles al drift commit-centrico: PDFs de compliance en buckets privados,
    assets estaticos, etc. Este script los registra en ops/deploy-state/<env>.yaml
    para que check-oob-drift.ps1 y el auto-surface de los deploy scripts detecten
    el gap cross-entorno (presente en TEST, ausente/stale en PROD).

    Alcance v1: solo artefactos que deben replicarse IDENTICOS entre entornos
    (mismo sha256). config.env NO entra (sus valores difieren por diseno).

    NO commitea (decision D2): el operador commitea el manifest cuando le conviene.

.PARAMETER Environment
    Entorno del manifest a tocar: audit | test | prod.

.PARAMETER Id
    Identificador estable del artefacto, MISMO en todos los entornos (p.ej.
    'dpia-biometric'). Es la clave de comparacion cross-entorno.

.PARAMETER Kind
    compliance_pdf | bucket_asset. Obligatorio salvo con -Remove.

.PARAMETER Location
    URI del artefacto en ESE entorno (p.ej. s3://.../compliance/x.pdf).
    Obligatorio salvo con -Remove.

.PARAMETER File
    Ruta local al fichero para calcular el sha256 automaticamente. Alternativa
    a -Sha256.

.PARAMETER Sha256
    sha256 del artefacto. Si se pasa -File se calcula solo. Obligatorio (por -File
    o directo) salvo con -Remove.

.PARAMETER Source
    Referencia a la fuente en el repo (p.ej. ops/legal-history/compliance/x.pdf).

.PARAMETER Notes
    Nota humana.

.PARAMETER Remove
    Elimina el artefacto con ese -Id del entorno (retiro).

.EXAMPLE
    .\register-oob-artifact.ps1 -Environment test -Id dpia-biometric `
        -Kind compliance_pdf `
        -Location s3://sharemechat-content-private-test/compliance/dpia_biometric_v1_2026-08-31.pdf `
        -File .\dpia_biometric_v1_2026-08-31.pdf `
        -Source ops/legal-history/compliance/dpia_biometric_v1_2026-08-31.pdf `
        -Notes 'DPIA GDPR Art.35 (interno). Copia entregable on-request.'
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('audit', 'test', 'prod')]
    [string]$Environment,

    [Parameter(Mandatory = $true)]
    [string]$Id,

    [Parameter(Mandatory = $false)]
    [ValidateSet('compliance_pdf', 'bucket_asset')]
    [string]$Kind,

    [Parameter(Mandatory = $false)]
    [string]$Location,

    [Parameter(Mandatory = $false)]
    [string]$File,

    [Parameter(Mandatory = $false)]
    [string]$Sha256,

    [Parameter(Mandatory = $false)]
    [string]$Source,

    [Parameter(Mandatory = $false)]
    [string]$Notes,

    [Parameter(Mandatory = $false)]
    [switch]$Remove
)

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'check-deploy-drift.ps1')

if (-not $Remove) {
    if ($File -and -not $Sha256) {
        if (-not (Test-Path $File)) { throw "No existe el fichero -File: $File" }
        $Sha256 = (Get-FileHash -Algorithm SHA256 -Path $File).Hash.ToLower()
        Write-Host "sha256 calculado desde $File -> $Sha256" -ForegroundColor DarkGray
    }
}

$deployedBy = "$env:USERNAME@$env:COMPUTERNAME"

$res = Update-DeployStateManifestOob `
    -Env $Environment `
    -Id $Id `
    -Kind $Kind `
    -Location $Location `
    -Sha256 $Sha256 `
    -Source $Source `
    -DeployedBy $deployedBy `
    -Notes $Notes `
    -Remove:$Remove

Write-Host ""
Write-Host "OOB $($res.Action): id='$($res.Id)' en $($Environment.ToUpper())  ($($res.ManifestFile))" -ForegroundColor Green
Write-Host "Recordatorio: commitea el manifest cuando te convenga (no se hace auto-commit)." -ForegroundColor DarkGray
