#Requires -Version 5.1
<#
.SYNOPSIS
    Sincroniza las skills del repo Sharemechat a la carpeta de skills de Cowork.

.DESCRIPTION
    El repo de producto (sharemechat-git-v1) es la fuente de verdad de las skills
    que se ejecutan en Cowork. Este script copia las skills desde el repo a la
    carpeta donde Cowork las carga (carpeta por skill con SKILL.md dentro).

    Direccion: UNIDIRECCIONAL repo -> Cowork.

    Cualquier edicion hecha directamente en la carpeta de Cowork se sobreescribe
    en la siguiente sincronizacion. Para cambiar una skill, editar el .md en el
    repo y volver a ejecutar este script.

    El script entiende dos formatos de origen y los normaliza al formato Cowork:

      Formato A (frontmatter YAML, ya formato Cowork):
          ---
          name: <slug>
          description: <desc>
          ---
          <cuerpo>
        Usado hoy por docs/social/skills/*.md.

      Formato B (cabeceras de seccion del repo):
          # Descripcion
          <desc>
          # Instrucciones
          <cuerpo>
        Usado hoy por docs/cms/skills/*.md.

    El destino siempre queda como:
          <CoworkSkillsDir>\<slug>\SKILL.md
    con frontmatter YAML y cuerpo, que es lo que Cowork espera.

    El alcance del script y de la opcion -Prune queda LIMITADO a las skills cuyo
    nombre empieza por uno de los prefijos gestionados (-ManagedPrefixes). Esto
    evita tocar skills builtin de Cowork (docx, pdf, pptx, schedule, skill-creator,
    consolidate-memory, etc.) aunque convivan en el mismo directorio.

.PARAMETER RepoRoot
    Raiz del repo. Por defecto se deduce del path del script (ops/scripts/.. /..).

.PARAMETER CoworkSkillsDir
    Carpeta de Cowork donde se cargan las skills. Default detectado en este equipo
    bajo %APPDATA%\Claude\local-agent-mode-sessions\skills-plugin\... Si Cowork
    reinstala o cambia los UUIDs intermedios, pasar la nueva ruta como parametro.

.PARAMETER SourceSubdirs
    Subcarpetas del repo que contienen .md de skills. Default: docs/cms/skills y
    docs/social/skills, ambas bajo sharemechat-v1.

.PARAMETER ManagedPrefixes
    Prefijos de slug considerados "gestionados por este script". Solo las skills
    de Cowork cuyo nombre empieza por uno de estos prefijos se consideran para
    -Prune o se reportan como huerfanas. Default: cms-, social-, sharemechat-.

.PARAMETER Prune
    Si esta presente, borra del destino las skills gestionadas que ya no estan
    en el origen. Sin -Prune, solo se listan como warning.

.EXAMPLE
    .\sync-skills-to-cowork.ps1 -WhatIf
    Muestra que haria, sin escribir ni borrar nada.

.EXAMPLE
    .\sync-skills-to-cowork.ps1
    Sincroniza el repo a Cowork sin borrar huerfanas.

.EXAMPLE
    .\sync-skills-to-cowork.ps1 -Prune
    Sincroniza y borra huerfanas dentro del scope de prefijos gestionados.

.EXAMPLE
    .\sync-skills-to-cowork.ps1 -CoworkSkillsDir "D:\otra\ruta\skills"
    Apunta a una carpeta de Cowork distinta.

.NOTES
    No requiere modulos externos. PowerShell 5.1+ (Windows).
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$RepoRoot,

    [string]$CoworkSkillsDir = 'C:\Users\alain\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\34859fec-5f3d-49cc-b1f4-014cd75575f7\94ce7d72-5747-4a78-9fcf-18c39c3c24ad\skills',

    [string[]]$SourceSubdirs = @(
        'docs/cms/skills',
        'docs/social/skills'
    ),

    [string[]]$ManagedPrefixes = @('cms-', 'social-', 'sharemechat-'),

    [switch]$Prune
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Resolucion de paths
# ---------------------------------------------------------------------------

if (-not $RepoRoot) {
    if ($PSScriptRoot) {
        $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    } else {
        throw "No se pudo deducir RepoRoot: pasar -RepoRoot explicitamente."
    }
} else {
    if (-not (Test-Path -LiteralPath $RepoRoot)) {
        throw "RepoRoot no existe: $RepoRoot"
    }
    $RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
}

if (-not (Test-Path -LiteralPath $CoworkSkillsDir)) {
    throw @"
CoworkSkillsDir no existe: $CoworkSkillsDir

Causas habituales:
  - Cowork no esta instalado en este equipo.
  - Cowork reinstalo y cambio los UUIDs intermedios.
  - La ruta default del script quedo obsoleta.

Solucion: pasar la ruta correcta con -CoworkSkillsDir, o editar el default
en la cabecera del script (parametro CoworkSkillsDir).
"@
}

$CoworkSkillsDir = (Resolve-Path -LiteralPath $CoworkSkillsDir).Path

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Get-SourceSkillFiles {
    param([string]$Root, [string[]]$Subdirs)

    $files = @()
    foreach ($sub in $Subdirs) {
        $full = Join-Path $Root $sub
        if (-not (Test-Path -LiteralPath $full)) {
            Write-Warning "Subcarpeta de origen no existe, se omite: $full"
            continue
        }
        $found = Get-ChildItem -LiteralPath $full -Filter '*.md' -File |
            Where-Object { $_.Name -ne 'README.md' }
        $files += $found
    }
    return $files
}

function ConvertTo-CoworkSkill {
    param(
        [Parameter(Mandatory = $true)] [string]$SourcePath
    )

    $raw = Get-Content -LiteralPath $SourcePath -Raw -Encoding UTF8
    $name = [System.IO.Path]::GetFileNameWithoutExtension($SourcePath)

    # Detectar primera linea no vacia para discriminar formato.
    $firstNonEmpty = ($raw -split "`r?`n" |
        Where-Object { $_.Trim() -ne '' } |
        Select-Object -First 1)

    if ($firstNonEmpty -and $firstNonEmpty.Trim() -eq '---') {
        # Formato A: ya es frontmatter YAML. Se reusa tal cual.
        return ($raw.TrimEnd() + "`n")
    }

    # Formato B: "# Descripcion" + "# Instrucciones"
    $pattern = '(?ims)^\s*#\s*Descripci[oó]n\s*\r?\n(?<desc>.*?)(?:\r?\n\s*#\s*Instrucciones\s*\r?\n(?<body>.*))?\s*$'
    $m = [regex]::Match($raw, $pattern)
    if (-not $m.Success) {
        throw "Formato desconocido en $SourcePath (esperaba frontmatter YAML o '# Descripcion' / '# Instrucciones')."
    }

    $desc = $m.Groups['desc'].Value.Trim()
    $body = if ($m.Groups['body'].Success) { $m.Groups['body'].Value.TrimEnd() } else { '' }

    # La description va en una linea: colapsar saltos a espacios.
    $descOneLine = ($desc -replace "`r?`n", ' ' -replace '\s+', ' ').Trim()

    # Escape para comillas dobles YAML: \ -> \\, " -> \"
    $descEscaped = $descOneLine -replace '\\', '\\' -replace '"', '\"'

    $sb = New-Object System.Text.StringBuilder
    [void]$sb.AppendLine('---')
    [void]$sb.AppendLine("name: $name")
    [void]$sb.AppendLine("description: ""$descEscaped""")
    [void]$sb.AppendLine('---')
    [void]$sb.AppendLine('')
    if ($body) {
        [void]$sb.AppendLine($body)
    }
    return $sb.ToString()
}

function Write-SkillFile {
    param(
        [Parameter(Mandatory = $true)] [string]$Path,
        [Parameter(Mandatory = $true)] [string]$Content
    )
    $dir = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    # UTF-8 sin BOM, EOL como vino del contenido (no se normaliza CRLF/LF aqui).
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Test-ContentEquals {
    param(
        [Parameter(Mandatory = $true)] [string]$ExistingPath,
        [Parameter(Mandatory = $true)] [string]$NewContent
    )
    if (-not (Test-Path -LiteralPath $ExistingPath)) { return $false }
    try {
        $existing = Get-Content -LiteralPath $ExistingPath -Raw -Encoding UTF8
    } catch {
        return $false
    }
    # Normalizar EOL para comparar (CRLF -> LF) y trim final.
    $normA = ($existing -replace "`r`n", "`n").TrimEnd("`n")
    $normB = ($NewContent -replace "`r`n", "`n").TrimEnd("`n")
    return $normA -ceq $normB
}

function Test-IsManaged {
    param([string]$Name, [string[]]$Prefixes)
    foreach ($p in $Prefixes) {
        if ($Name.StartsWith($p, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }
    return $false
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "Sync skills repo -> Cowork" -ForegroundColor Cyan
Write-Host "  RepoRoot         : $RepoRoot"
Write-Host "  CoworkSkillsDir  : $CoworkSkillsDir"
Write-Host "  SourceSubdirs    : $($SourceSubdirs -join ', ')"
Write-Host "  ManagedPrefixes  : $($ManagedPrefixes -join ', ')"
Write-Host "  Prune            : $($Prune.IsPresent)"
if ($WhatIfPreference) {
    Write-Host "  Modo             : WhatIf (dry-run)" -ForegroundColor Yellow
}
Write-Host ""

$sourceFiles = Get-SourceSkillFiles -Root $RepoRoot -Subdirs $SourceSubdirs
if ($sourceFiles.Count -eq 0) {
    throw "No se encontraron .md de skills en ninguna de las subcarpetas de origen."
}

# Detectar colisiones de slug entre las dos subcarpetas.
$byName = @{}
foreach ($f in $sourceFiles) {
    $n = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
    if ($byName.ContainsKey($n)) {
        Write-Warning "Colision de slug '$n' entre $($byName[$n].FullName) y $($f.FullName). Se usara el ultimo."
    }
    $byName[$n] = $f
}

$sourceNames = @($byName.Keys | Sort-Object)

$counters = [ordered]@{
    new        = 0
    updated    = 0
    unchanged  = 0
    orphans    = 0
    pruned     = 0
    errors     = 0
}

# --- Procesar origen -> destino ---
foreach ($name in $sourceNames) {
    $srcFile = $byName[$name]
    $destDir = Join-Path $CoworkSkillsDir $name
    $destFile = Join-Path $destDir 'SKILL.md'

    try {
        $newContent = ConvertTo-CoworkSkill -SourcePath $srcFile.FullName
    } catch {
        Write-Host "  [ERROR] $name :: $_" -ForegroundColor Red
        $counters.errors++
        continue
    }

    if (-not (Test-Path -LiteralPath $destFile)) {
        if ($PSCmdlet.ShouldProcess($destFile, "Crear skill NUEVA '$name'")) {
            Write-SkillFile -Path $destFile -Content $newContent
        }
        Write-Host "  [NUEVA      ] $name" -ForegroundColor Green
        $counters.new++
        continue
    }

    if (Test-ContentEquals -ExistingPath $destFile -NewContent $newContent) {
        Write-Host "  [SIN CAMBIOS] $name" -ForegroundColor DarkGray
        $counters.unchanged++
    } else {
        if ($PSCmdlet.ShouldProcess($destFile, "Actualizar skill '$name'")) {
            Write-SkillFile -Path $destFile -Content $newContent
        }
        Write-Host "  [ACTUALIZADA] $name" -ForegroundColor Yellow
        $counters.updated++
    }
}

# --- Detectar huerfanas (solo dentro del scope de prefijos gestionados) ---
$destDirs = Get-ChildItem -LiteralPath $CoworkSkillsDir -Directory |
    Where-Object { Test-IsManaged -Name $_.Name -Prefixes $ManagedPrefixes }

$orphans = @()
foreach ($d in $destDirs) {
    if (-not ($sourceNames -contains $d.Name)) {
        $orphans += $d
    }
}

if ($orphans.Count -gt 0) {
    Write-Host ""
    if ($Prune) {
        Write-Host "Huerfanas a borrar (-Prune activo):" -ForegroundColor Yellow
    } else {
        Write-Host "Huerfanas detectadas (no se borran sin -Prune):" -ForegroundColor Yellow
    }
    foreach ($o in $orphans) {
        $counters.orphans++
        if ($Prune) {
            if ($PSCmdlet.ShouldProcess($o.FullName, "Borrar huerfana '$($o.Name)'")) {
                try {
                    Remove-Item -LiteralPath $o.FullName -Recurse -Force
                    Write-Host "  [PRUNED     ] $($o.Name)" -ForegroundColor Red
                    $counters.pruned++
                } catch {
                    Write-Host "  [ERROR PRUNE] $($o.Name) :: $_" -ForegroundColor Red
                    $counters.errors++
                }
            } else {
                Write-Host "  [PRUNE WhatIf] $($o.Name)" -ForegroundColor DarkYellow
            }
        } else {
            Write-Host "  [HUERFANA   ] $($o.Name)" -ForegroundColor Yellow
        }
    }
    if (-not $Prune) {
        Write-Host "  Sugerencia: relanzar con -Prune para borrarlas." -ForegroundColor DarkYellow
    }
}

# --- Resumen ---
Write-Host ""
Write-Host "Resumen:" -ForegroundColor Cyan
Write-Host ("  Nuevas      : {0}" -f $counters.new)        -ForegroundColor Green
Write-Host ("  Actualizadas: {0}" -f $counters.updated)    -ForegroundColor Yellow
Write-Host ("  Sin cambios : {0}" -f $counters.unchanged)  -ForegroundColor DarkGray
Write-Host ("  Huerfanas   : {0}" -f $counters.orphans)    -ForegroundColor Yellow
if ($Prune) {
    Write-Host ("  Pruned      : {0}" -f $counters.pruned) -ForegroundColor Red
}
if ($counters.errors -gt 0) {
    Write-Host ("  Errores     : {0}" -f $counters.errors) -ForegroundColor Red
    exit 1
}
Write-Host ""
