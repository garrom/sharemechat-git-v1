<#
.SYNOPSIS
    ADR-060: sincroniza la Base de Conocimiento del Agente IA de soporte desde la
    fuente de verdad en git (sharemechat-v1/support-kb/*.md) hacia la tabla
    support_bot_prompts del entorno indicado, vía el endpoint admin de UPSERT.

.DESCRIPTION
    Lee los .md de support-kb/, parsea front-matter (case_key/role/active/
    description) + cuerpo markdown, calcula el hash SHA-256 del cuerpo y lo
    compara contra GET /api/admin/knowledge-base/state del entorno (drift-check).

    -DryRun (por defecto seguro): imprime el diff (CREATE/UPDATE/UNCHANGED/
    DEACTIVATE) y NO toca nada.
    Sin -DryRun: hace POST /api/admin/knowledge-base/sync (UPSERT idempotente +
    soft-delete + reload de la cache) y muestra el resultado.

    El mismo git-source aplicado a test -> audit -> prod deja los tres entornos
    identicos (anti-drift por construccion).

.PARAMETER Environment
    test | audit | prod.

.PARAMETER DryRun
    Solo muestra el diff; no envia cambios. Recomendado antes de cada sync real.

.PARAMETER ApiBase
    Override opcional de la URL base (por defecto se resuelve por entorno).

.NOTES
    Autenticacion (ADR-060): login admin por cookie HttpOnly. Credenciales desde
    variables de entorno de usuario SMC_ADMIN_EMAIL / SMC_ADMIN_PASSWORD (nunca
    por argv ni a disco). El endpoint hereda ROLE_ADMIN de /api/admin/**.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('test', 'audit', 'prod')]
    [string]$Environment,

    [switch]$DryRun,

    [string]$ApiBase
)

$ErrorActionPreference = 'Stop'

function Resolve-ApiBase([string]$env, [string]$override) {
    if ($override) { return $override.TrimEnd('/') }
    switch ($env) {
        'test'  { return 'https://test.sharemechat.com' }
        'audit' { return 'https://audit.sharemechat.com' }
        'prod'  { return 'https://sharemechat.com' }
    }
}

function Get-Sha256Hex([string]$text) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
        $hash = $sha.ComputeHash($bytes)
        return -join ($hash | ForEach-Object { $_.ToString('x2') })
    } finally {
        $sha.Dispose()
    }
}

# Parseo minimo de front-matter YAML plano (clave: valor). No soporta anidado.
function Parse-KbFile([string]$path) {
    $raw = Get-Content -Path $path -Raw -Encoding UTF8
    $raw = $raw -replace "`r`n", "`n"          # normaliza a LF (git checkout puede dar CRLF)
    if (-not $raw.StartsWith("---`n")) {
        throw "Fichero sin front-matter '---' al inicio: $path"
    }
    $rest = $raw.Substring(4)                   # tras el "---\n" inicial
    $endIdx = $rest.IndexOf("`n---`n")          # cierre del front-matter
    if ($endIdx -lt 0) {
        throw "Front-matter sin cierre '---' en: $path"
    }
    $fmBlock = $rest.Substring(0, $endIdx)
    $body = $rest.Substring($endIdx + 5)        # tras el "\n---\n" de cierre
    if ($body.StartsWith("`n")) { $body = $body.Substring(1) }  # quita la linea en blanco separadora

    $meta = @{ role = 'BOTH'; active = $true; description = $null; case_key = $null }
    foreach ($line in ($fmBlock -split "`n")) {
        if ($line -match '^\s*([A-Za-z_]+)\s*:\s*(.*)$') {
            $k = $Matches[1].Trim()
            $v = $Matches[2].Trim()
            switch ($k) {
                'case_key'    { $meta.case_key = $v }
                'role'        { $meta.role = $v.ToUpper() }
                'active'      { $meta.active = ($v -eq 'true') }
                'description' { $meta.description = $v }
            }
        }
    }
    $stem = [System.IO.Path]::GetFileNameWithoutExtension($path)
    if (-not $meta.case_key) { $meta.case_key = $stem }
    if ($meta.case_key -ne $stem) {
        Write-Warning "case_key '$($meta.case_key)' != nombre de fichero '$stem' en $path"
    }
    return [pscustomobject]@{
        caseKey     = $meta.case_key
        role        = $meta.role
        active      = $meta.active
        description = $meta.description
        content     = $body
        hash        = Get-Sha256Hex $body
    }
}

# --- Resolucion de rutas y entorno ---
$apiBase = Resolve-ApiBase $Environment $ApiBase
$kbDir = Join-Path $PSScriptRoot '..\..\support-kb'
$kbDir = [System.IO.Path]::GetFullPath($kbDir)
if (-not (Test-Path $kbDir)) { throw "No existe el directorio de la BdC: $kbDir" }

$adminEmail = [Environment]::GetEnvironmentVariable('SMC_ADMIN_EMAIL', 'User')
$adminPass  = [Environment]::GetEnvironmentVariable('SMC_ADMIN_PASSWORD', 'User')
if (-not $adminEmail -or -not $adminPass) {
    throw "Faltan credenciales admin. Define SMC_ADMIN_EMAIL y SMC_ADMIN_PASSWORD (User scope) antes de correr."
}

Write-Host "=== sync-support-kb :: $Environment ($apiBase) ==="
Write-Host "    fuente: $kbDir"
Write-Host "    modo:   $(if ($DryRun) { 'DRY-RUN (no aplica cambios)' } else { 'REAL (UPSERT + reload)' })"

# --- 1) Leer y parsear la fuente git ---
$files = Get-ChildItem -Path $kbDir -Filter '*.md' | Sort-Object Name
if (-not $files) { throw "No hay ficheros *.md en $kbDir" }
$local = @{}
foreach ($f in $files) {
    $p = Parse-KbFile $f.FullName
    $local[$p.caseKey] = $p
}
Write-Host "    ficheros parseados: $($local.Count)"

# --- 2) Login admin (cookie HttpOnly) ---
$loginBody = @{ email = $adminEmail; password = $adminPass } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri "$apiBase/api/admin/auth/login" -Method Post -ContentType 'application/json' `
    -Body $loginBody -SessionVariable sess | Out-Null

# --- 3) Estado remoto (hashes) ---
$stateResp = Invoke-RestMethod -Uri "$apiBase/api/admin/knowledge-base/state" -Method Get -WebSession $sess
$remote = @{}
foreach ($row in $stateResp.prompts) { $remote[$row.caseKey] = $row }

# --- 4) Diff ---
$toCreate = @(); $toUpdate = @(); $unchanged = @(); $toDeactivate = @()
foreach ($key in $local.Keys) {
    $l = $local[$key]
    if (-not $remote.ContainsKey($key)) { $toCreate += $key; continue }
    $r = $remote[$key]
    if ($l.hash -ne $r.contentHash -or $l.role -ne $r.role -or $l.active -ne $r.active) {
        $toUpdate += $key
    } else {
        $unchanged += $key
    }
}
foreach ($key in $remote.Keys) {
    if (-not $local.ContainsKey($key) -and $remote[$key].active) { $toDeactivate += $key }
}

Write-Host ""
Write-Host "--- DIFF git -> $Environment ---"
Write-Host ("  CREATE     ({0}): {1}" -f $toCreate.Count, ($toCreate -join ', '))
Write-Host ("  UPDATE     ({0}): {1}" -f $toUpdate.Count, ($toUpdate -join ', '))
Write-Host ("  DEACTIVATE ({0}): {1}" -f $toDeactivate.Count, ($toDeactivate -join ', '))
Write-Host ("  UNCHANGED  ({0})" -f $unchanged.Count)

if ($DryRun) {
    Write-Host ""
    Write-Host "DRY-RUN: no se aplico ningun cambio. Re-ejecuta sin -DryRun para aplicar."
    return
}

if ($toCreate.Count -eq 0 -and $toUpdate.Count -eq 0 -and $toDeactivate.Count -eq 0) {
    Write-Host ""
    Write-Host "Sin cambios: git y $Environment ya estan sincronizados. Nada que hacer."
    return
}

# --- 5) POST /sync ---
$prompts = @()
foreach ($key in ($local.Keys | Sort-Object)) {
    $l = $local[$key]
    $prompts += [ordered]@{
        caseKey     = $l.caseKey
        role        = $l.role
        content     = $l.content
        description = $l.description
        active      = $l.active
    }
}
$payload = @{ prompts = $prompts } | ConvertTo-Json -Depth 6
$syncResp = Invoke-RestMethod -Uri "$apiBase/api/admin/knowledge-base/sync" -Method Post `
    -ContentType 'application/json' -Body $payload -WebSession $sess

Write-Host ""
Write-Host "--- RESULTADO sync ($Environment) ---"
Write-Host ("  created:     {0} [{1}]" -f $syncResp.createdCount, ($syncResp.created -join ', '))
Write-Host ("  updated:     {0} [{1}]" -f $syncResp.updatedCount, ($syncResp.updated -join ', '))
Write-Host ("  unchanged:   {0}" -f $syncResp.unchangedCount)
Write-Host ("  deactivated: {0} [{1}]" -f $syncResp.deactivatedCount, ($syncResp.deactivated -join ', '))
Write-Host ("  cache:       {0} prompts activos" -f $syncResp.cachedPromptCount)
Write-Host ""
Write-Host "OK. Recuerda correr el sync tambien en los demas entornos para mantenerlos identicos."
