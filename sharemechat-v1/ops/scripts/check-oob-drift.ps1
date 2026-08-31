<#
.SYNOPSIS
    Reporta el drift de artefactos fuera de banda (OOB) entre dos entornos:
    los que estan en SourceEnv y faltan (PENDING) o difieren (STALE) en TargetEnv.

.DESCRIPTION
    Schema v2. Complementa al drift commit-centrico (check-deploy-drift.ps1):
    los artefactos OOB (PDFs de compliance, assets a bucket) no viajan con el
    build, asi que una nivelacion podria olvidarlos. Este check los surface.

    Read-only. Modelo manifest-vs-manifest (mismo modelo de confianza que el
    drift de commits). Uso tipico en nivelacion: SourceEnv=test, TargetEnv=prod.

.PARAMETER SourceEnv
    Entorno de referencia (donde ya estan los artefactos). Default: test.

.PARAMETER TargetEnv
    Entorno a nivelar (donde se comprueba si faltan). Obligatorio.

.EXAMPLE
    .\check-oob-drift.ps1 -TargetEnv prod

    Compara TEST (default) -> PROD y lista los OOB PENDING/STALE en PROD.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [ValidateSet('audit', 'test', 'prod')]
    [string]$SourceEnv = 'test',

    [Parameter(Mandatory = $true)]
    [ValidateSet('audit', 'test', 'prod')]
    [string]$TargetEnv
)

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'check-deploy-drift.ps1')

$result = Invoke-OobDriftCheck -SourceEnv $SourceEnv -TargetEnv $TargetEnv
Write-OobDriftReport -Result $result

# Read-only: no salir con codigo por severidad; la decision es del operador.
exit 0
