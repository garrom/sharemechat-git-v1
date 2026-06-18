#Requires -Version 5.1
<#
.SYNOPSIS
    Descubre threads candidatos para comentar en subs target de Reddit usando
    los feeds Atom publicos (hot.rss). Output markdown listo para pegar en
    Cowork como input de la skill social-comment-helper (FASE 2B, pendiente).

.DESCRIPTION
    FASE 2A del sistema de warmup automatizado en Reddit. Descarga el feed
    hot.rss de cada sub configurado, parsea el XML Atom, aplica filtros de
    edad / palabras tabu / posts administrativos / autores bot, y emite a
    stdout una lista markdown de N candidatos por sub agrupados.

    NO usa OAuth, NO requiere credenciales, NO escribe nada al repo. El
    User-Agent se declara explicitamente porque Reddit penaliza fetches
    anonimos con 429 mas rapido.

    Decision RSS vs OAuth: ADR-038. Vivencia del problema: la Data API
    legacy de Reddit requiere submit request + captcha en bucle al crear
    app; el Developer Platform es overkill para descubrimiento read-only.
    El RSS publico es estable, estandar y suficiente para 3 subs x 1-2
    sesiones por dia.

    El script descubre. No publica. Posting sigue siendo manual desde el
    navegador del operador (ADR-034 "automatizar el pensar, no el publicar").

.PARAMETER SubsOverride
    Lista de subs separada por coma para sobreescribir la config por
    defecto. Formato: "r/X,r/Y". Si no se pasa, usa los 3 subs hardcoded
    en el header.

.PARAMETER MaxPerSub
    Numero maximo de candidatos a emitir por sub. Default 5 (max razonable
    para que el operador no se ahogue en candidatos por sesion). Total
    teorico: SubsCount * MaxPerSub (con 3 subs y default 5 = 15).

.PARAMETER SleepSeconds
    Espera en segundos entre fetches consecutivos. Default 15 (subido
    desde 8 tras observacion empirica de que Reddit aplica 429
    persistente incluso a 8s con UA declarado). Si se observa
    estabilidad a 15s, este valor puede bajar; si Reddit endurece,
    subir.

.PARAMETER OutputJson
    Si se pasa, ademas del markdown a stdout escribe el resultado tambien
    como JSON estructurado en C:\tmp\thread-candidates.json. Util para
    futuras automatizaciones (FASE 2C o posterior).

.PARAMETER DryRun
    Descarga y parsea pero NO aplica filtros. Emite estadisticas crudas
    por sub (entries totales, edades, autores, top 5 titulos sin filtrar)
    para debugging del feed o de los filtros.

.PARAMETER Verbose
    Switch estandar de PowerShell. Loggea fetches, conteos pre/post-filtro,
    motivos de exclusion por entry.

.EXAMPLE
    .\social-thread-finder.ps1
    Descubrimiento normal con la config por defecto. Output markdown a
    stdout.

.EXAMPLE
    .\social-thread-finder.ps1 -Verbose
    Lo mismo + log detallado de fetches y filtros.

.EXAMPLE
    .\social-thread-finder.ps1 -SubsOverride "r/Cooking,r/Coffee" -MaxPerSub 3
    Descubrimiento con subs alternativos y limite mas estricto.

.EXAMPLE
    .\social-thread-finder.ps1 -DryRun
    No aplica filtros. Muestra que devuelve cada feed antes de filtrar.

.EXAMPLE
    .\social-thread-finder.ps1 -OutputJson
    Markdown a stdout + JSON estructurado en C:\tmp\thread-candidates.json.

.NOTES
    PowerShell 5.1+ (Windows). No requiere modulos externos.
    Referencia ADR-038 (RSS publico sin auth para descubrimiento Reddit).
    Referencia ADR-034 (metodologia social-ops: automatizar el pensar).
    Referencia ADR-040 (pivote target subs adult-ecosystem, clients + models).
      - $SubsConfig: 4 subs target adult-ecosystem (CreatorsAdvice, SexWorkerSupport,
        CamGirlProblems, Fansly_Advice). Los 3 subs casuales anteriores (AskReddit,
        CasualConversation, Showerthoughts) ahora solo via -SubsOverride.
      - $TabuKeywords: ampliada con lineas rojas absolutas (menores, no-consent,
        trafficking, etc.). brand-legal-review hace filtro adicional.
      - $BoostKeywords: nueva. Threads que mencionan plataformas competencia
        (coomeet, luckycrush, chaturbate, etc.) suben al top con etiqueta [BOOST].
        Senalan oportunidades de captacion de modelos.
#>

[CmdletBinding()]
param(
    [string]$SubsOverride,
    [int]$MaxPerSub = 5,
    [int]$SleepSeconds = 15,
    [switch]$OutputJson,
    [switch]$DryRun
)

# Espera fija en segundos tras un 429 antes del UNICO retry permitido por
# fetch. Independiente de $SleepSeconds (que es entre fetches distintos).
$RetryDelayOn429 = 30

# ---------------------------------------------------------------------------
# CONFIG EN EL HEADER DEL SCRIPT (ADR-038: config inline, no archivo externo)
# ---------------------------------------------------------------------------

# Subs target. Cada entrada permite override de filtros por sub.
# Lista actual: 4 subs adult-ecosystem validados humanamente (ADR-040).
# Edades recalibradas: los subs adult-creators tienen ritmo mas lento que los
# casuales (que eran 24h-14d), threads viven mas tiempo en hot.
$SubsConfig = @(
    [pscustomobject]@{
        Name         = 'r/CreatorsAdvice'
        Feed         = 'hot.rss'
        MaxAgeHours  = 96
    },
    [pscustomobject]@{
        Name         = 'r/SexWorkerSupport'
        Feed         = 'hot.rss'
        MaxAgeHours  = 168
    },
    [pscustomobject]@{
        Name         = 'r/CamGirlProblems'
        Feed         = 'hot.rss'
        MaxAgeHours  = 72
    },
    [pscustomobject]@{
        Name         = 'r/Fansly_Advice'
        Feed         = 'hot.rss'
        MaxAgeHours  = 168
    }
)

# User-Agent declarado. Reddit penaliza UA generico (Mozilla/curl/etc.) con
# 429 mas rapido. UA estilo "AppName:purpose:version (by /u/handle)" es la
# convencion recomendada por Reddit para uso personal de la API.
$UserAgent = 'SharemeChat:warmup-finder:v1 (by /u/sharemechat)'

# NOTA sobre $SleepSeconds: ahora es parametro del script (default 15s).
# Subido desde 8s tras observacion empirica: Reddit aplica 429
# persistente incluso a 8s con UA declarado. Para 3 subs = 30s totales,
# asumible para ejecucion humana. La variable se inyecta como
# [int]$SleepSeconds en el bloque param() arriba.

# Palabras tabu en el TITULO (case-insensitive). Cualquier titulo que
# contenga alguna se descarta entero.
#
# Ampliada en ADR-040 con set adult-ecosystem (lineas rojas absolutas:
# menores, no-consent, trafficking). brand-legal-review aplica un filtro
# adicional sobre las variantes redactadas; el script es primera barrera
# basada solo en el titulo del thread.
#
# Nota sobre 'teen': palabra ambigua (puede aparecer en "teen years" no
# sexual). Se mantiene en la lista por prudencia maxima; si bloquea threads
# legitimos en uso real, el operador puede afinar via review de logs con
# -Verbose. La perdida de senal es preferible al riesgo de falso negativo.
$TabuKeywords = @(
    # Lineas rojas absolutas (eticas y legales)
    'underage', 'teen', 'minor', 'child', 'cp',
    'trafficking', 'snuff', 'rape', 'coercion', 'force',
    # Politizados / derail (riesgo en sex worker subs y advice)
    'religion', 'politics', 'trump', 'biden', 'israel', 'palestine',
    'abortion', 'AITA', 'rant', 'hate', 'racist',
    'gun', 'shooting', 'war'
)

# Plataformas competencia que SUBEN la prioridad del thread (case-insensitive
# como substring del titulo). Threads que matchean cualquiera de estas
# keywords aparecen al TOP de su sub en la salida markdown, con etiqueta
# visual ' [BOOST]' tras el titulo. Senalan oportunidades concretas para
# captacion de modelos insatisfechas con su plataforma actual.
# Referencia: ADR-040.
$BoostKeywords = @(
    'coomeet', 'luckycrush', 'chaturbate', 'stripchat',
    'bongacams', 'myfreecams', 'jerkmate', 'camsoda', 'flirt4free'
)

# Marcadores de post administrativo. Coincidencia case-insensitive como
# substring del titulo.
$AdminMarkers = @(
    'Welcome Thread', 'Megathread', 'Daily Discussion', 'Daily Thread',
    'Monthly', 'Weekly', 'Mod Post', 'Moderator',
    'looking for new moderators'
)

# Autores tipo bot. Coincidencia exacta o substring para nombres
# conocidos. Reddit prefija con /u/ en el feed Atom.
$BotAuthors = @(
    'AutoModerator',
    'Sub_Mentions',
    'reddit'
)

# Destino del JSON opcional. C:\tmp\ porque el script no debe escribir al
# repo (regla dura del prompt).
$JsonOutputPath = 'C:\tmp\thread-candidates.json'


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Format-Age {
    param([TimeSpan]$Span)
    if ($Span.TotalHours -lt 24) {
        return ('{0:N1}h' -f $Span.TotalHours)
    }
    return ('{0:N1}d' -f $Span.TotalDays)
}

function Test-TabuTitle {
    param([string]$Title, [string[]]$Keywords)
    if ([string]::IsNullOrWhiteSpace($Title)) { return $false }
    $lower = $Title.ToLowerInvariant()
    foreach ($k in $Keywords) {
        if ($lower.Contains($k.ToLowerInvariant())) {
            return $true
        }
    }
    return $false
}

function Test-AdminTitle {
    param([string]$Title, [string[]]$Markers)
    if ([string]::IsNullOrWhiteSpace($Title)) { return $false }
    $lower = $Title.ToLowerInvariant()
    foreach ($m in $Markers) {
        if ($lower.Contains($m.ToLowerInvariant())) {
            return $true
        }
    }
    return $false
}

function Test-BotAuthor {
    param([string]$Author, [string[]]$Bots)
    if ([string]::IsNullOrWhiteSpace($Author)) { return $false }
    # Atom feed prefija con /u/, normalizamos.
    $clean = $Author -replace '^/u/', '' -replace '^u/', ''
    foreach ($b in $Bots) {
        if ($clean -ieq $b) { return $true }
        if ($clean.ToLowerInvariant().Contains($b.ToLowerInvariant())) { return $true }
    }
    return $false
}

function Test-BoostKeyword {
    # Devuelve $true si el titulo contiene alguna BoostKeyword (substring
    # case-insensitive). Indica que el thread menciona una plataforma
    # competencia y por tanto sube al top de su sub en la salida.
    param([string]$Title, [string[]]$Keywords)
    if ([string]::IsNullOrWhiteSpace($Title)) { return $false }
    $lower = $Title.ToLowerInvariant()
    foreach ($k in $Keywords) {
        if ($lower.Contains($k.ToLowerInvariant())) {
            return $true
        }
    }
    return $false
}

function Get-EntryProp {
    # Helper defensivo: el [xml] de PowerShell devuelve a veces strings
    # directos y otras objetos con propiedades anidadas (cuando hay
    # attributos). Esta funcion extrae siempre la representacion texto.
    param($Node)
    if ($null -eq $Node) { return '' }
    if ($Node -is [string]) { return $Node }
    if ($null -ne $Node.'#text') { return [string]$Node.'#text' }
    if ($null -ne $Node.InnerText) { return [string]$Node.InnerText }
    return [string]$Node
}

function Get-LinkHref {
    # En el Atom de Reddit, <link href="..."/> tiene el href como atributo.
    param($LinkNode)
    if ($null -eq $LinkNode) { return '' }
    if ($LinkNode -is [array]) {
        # Toma el primer <link> con href.
        foreach ($l in $LinkNode) {
            if ($l.href) { return [string]$l.href }
        }
        return ''
    }
    if ($LinkNode.href) { return [string]$LinkNode.href }
    return ''
}

function Invoke-RedditFetch {
    # Hace un fetch a Reddit con manejo explicito de 429:
    #   - Si la primera peticion devuelve 429, espera $RetryDelaySeconds
    #     y reintenta UNA vez.
    #   - Si el retry vuelve a dar 429, devuelve $null (el caller seguira
    #     con el siguiente sub).
    #   - Errores que no son 429 (404, 5xx, timeout, red): retornan $null
    #     en el primer intento sin retry.
    #
    # Devuelve el body como string en exito, o $null en fallo.
    param(
        [Parameter(Mandatory = $true)] [string]$Url,
        [Parameter(Mandatory = $true)] [string]$Sub,
        [Parameter(Mandatory = $true)] [string]$UA,
        [int]$RetryDelaySeconds = 30
    )

    foreach ($attempt in 1, 2) {
        if ($attempt -eq 2) {
            Write-Verbose ("[{0}] 429 detected, retry in {1}s..." -f $Sub, $RetryDelaySeconds)
            Start-Sleep -Seconds $RetryDelaySeconds
        }

        try {
            $response = Invoke-WebRequest -Uri $Url -UserAgent $UA `
                -UseBasicParsing -ErrorAction Stop -TimeoutSec 30
            if ($attempt -eq 2) {
                Write-Verbose ("[{0}] retry OK" -f $Sub)
            }
            return [string]$response.Content
        } catch {
            $code = $null
            try {
                if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
                    $code = [int]$_.Exception.Response.StatusCode
                }
            } catch { }

            if ($code -eq 429) {
                if ($attempt -eq 1) {
                    # Salir del catch y dejar que el loop vaya al attempt 2.
                    continue
                } else {
                    Write-Warning ("[{0}] retry tambien 429, skipping" -f $Sub)
                    return $null
                }
            } else {
                # No-429: abandono inmediato sin retry.
                Write-Warning ("[{0}] Fetch fallo: {1}" -f $Sub, $_.Exception.Message)
                return $null
            }
        }
    }

    return $null
}


# ---------------------------------------------------------------------------
# Override de subs si se pasa por param
# ---------------------------------------------------------------------------

if ($SubsOverride) {
    $parts = $SubsOverride -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    if ($parts.Count -eq 0) {
        Write-Error 'SubsOverride esta vacio tras split por coma. Aborto.'
        exit 1
    }
    # Para overrides usamos filtros default (24h para mantener prudencia).
    $SubsConfig = $parts | ForEach-Object {
        [pscustomobject]@{
            Name        = $_
            Feed        = 'hot.rss'
            MaxAgeHours = 24
        }
    }
    Write-Verbose ("SubsOverride aplicado: {0}" -f ($parts -join ', '))
}


# ---------------------------------------------------------------------------
# Banner inicial
# ---------------------------------------------------------------------------

$timestamp = ((Get-Date).ToUniversalTime()).ToString('yyyy-MM-ddTHH:mm')
$subNames = ($SubsConfig | ForEach-Object { $_.Name }) -join ', '

Write-Verbose ("UTC stamp: {0}" -f $timestamp)
Write-Verbose ("Subs a consultar: {0}" -f $subNames)
Write-Verbose ("MaxPerSub: {0}" -f $MaxPerSub)
Write-Verbose ("DryRun: {0}" -f $DryRun.IsPresent)


# ---------------------------------------------------------------------------
# Fetch + parse + filtro por sub
# ---------------------------------------------------------------------------

$results = @{}                         # name -> array de candidatos
$dryRunStats = @{}                     # name -> stats crudos en DryRun
$totalCandidates = 0
$now = [DateTime]::UtcNow
$first = $true

foreach ($sub in $SubsConfig) {
    $subName = $sub.Name
    $cleanSub = $subName -replace '^r/', ''
    $url = ('https://www.reddit.com/r/{0}/{1}' -f $cleanSub, $sub.Feed)

    if (-not $first) {
        Write-Verbose ("Sleeping {0}s antes del siguiente fetch..." -f $SleepSeconds)
        Start-Sleep -Seconds $SleepSeconds
    }
    $first = $false

    Write-Verbose ("Fetch -> {0}" -f $url)

    # Delegamos en el helper Invoke-RedditFetch para tener retry on 429
    # encapsulado. Cualquier otro error (404, 5xx, timeout, malformado)
    # se loggea como warning y devuelve $null en el primer intento sin
    # retry.
    $contentString = Invoke-RedditFetch -Url $url -Sub $subName -UA $UserAgent -RetryDelaySeconds $RetryDelayOn429
    if ([string]::IsNullOrWhiteSpace($contentString)) {
        $results[$subName] = @()
        continue
    }

    $xml = $null
    try {
        $xml = [xml]$contentString
    } catch {
        Write-Warning ("[{0}] XML malformado: {1}" -f $subName, $_.Exception.Message)
        $results[$subName] = @()
        continue
    }

    # Atom feed namespace: xmlns="http://www.w3.org/2005/Atom".
    # PowerShell [xml] permite acceso por nombre local cuando es el
    # namespace por defecto del documento.
    $entries = $null
    try {
        if ($xml.feed -and $xml.feed.entry) {
            $entries = @($xml.feed.entry)
        } elseif ($xml.entry) {
            $entries = @($xml.entry)
        } else {
            $entries = @()
        }
    } catch {
        $entries = @()
    }

    Write-Verbose ("[{0}] entries en feed: {1}" -f $subName, $entries.Count)

    if ($DryRun) {
        $dryRunStats[$subName] = [pscustomobject]@{
            EntriesTotal = $entries.Count
            FirstFiveTitles = @($entries | Select-Object -First 5 | ForEach-Object {
                Get-EntryProp $_.title
            })
            AuthorsUnique = @($entries | ForEach-Object {
                Get-EntryProp $_.author.name
            } | Sort-Object -Unique)
        }
        $results[$subName] = @()
        continue
    }

    # Filtrado normal.
    $kept = @()
    $seenUrls = New-Object 'System.Collections.Generic.HashSet[string]'

    foreach ($e in $entries) {
        $title = (Get-EntryProp $e.title).Trim()
        $author = (Get-EntryProp $e.author.name).Trim()
        $linkHref = (Get-LinkHref $e.link).Trim()
        $publishedStr = (Get-EntryProp $e.published).Trim()

        if ([string]::IsNullOrWhiteSpace($title) -or [string]::IsNullOrWhiteSpace($linkHref)) {
            Write-Verbose ("[{0}] descartado por campos vacios: '{1}' / '{2}'" -f $subName, $title, $linkHref)
            continue
        }

        # Dedup por URL
        if (-not $seenUrls.Add($linkHref)) {
            Write-Verbose ("[{0}] descartado duplicado: {1}" -f $subName, $linkHref)
            continue
        }

        # Edad
        $publishedUtc = $null
        try {
            $publishedUtc = [DateTime]::Parse($publishedStr, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::AdjustToUniversal -bor [System.Globalization.DateTimeStyles]::AssumeUniversal)
        } catch {
            Write-Verbose ("[{0}] descartado: timestamp ilegible '{1}'" -f $subName, $publishedStr)
            continue
        }
        $age = $now - $publishedUtc
        if ($age.TotalHours -gt $sub.MaxAgeHours) {
            Write-Verbose ("[{0}] descartado por edad ({1}h > {2}h): {3}" -f $subName, [int]$age.TotalHours, $sub.MaxAgeHours, $title)
            continue
        }
        if ($age.TotalSeconds -lt 0) {
            # Reloj desincronizado o post futuro raro. Descartamos.
            Write-Verbose ("[{0}] descartado por timestamp futuro: {1}" -f $subName, $title)
            continue
        }

        # Tabu / admin / bot
        if (Test-TabuTitle -Title $title -Keywords $TabuKeywords) {
            Write-Verbose ("[{0}] descartado por keyword tabu: {1}" -f $subName, $title)
            continue
        }
        if (Test-AdminTitle -Title $title -Markers $AdminMarkers) {
            Write-Verbose ("[{0}] descartado por post administrativo: {1}" -f $subName, $title)
            continue
        }
        if (Test-BotAuthor -Author $author -Bots $BotAuthors) {
            Write-Verbose ("[{0}] descartado por autor bot '{1}': {2}" -f $subName, $author, $title)
            continue
        }

        $isBoost = Test-BoostKeyword -Title $title -Keywords $BoostKeywords

        $kept += [pscustomobject]@{
            Subreddit       = $subName
            Title           = $title
            Url             = $linkHref
            Author          = $author
            PublishedUtc    = $publishedUtc
            AgeFormatted    = Format-Age $age
            IsBoost         = $isBoost
        }

        # NOTA: NO cortamos por MaxPerSub dentro del bucle (a diferencia del
        # comportamiento pre-ADR-040). Recolectamos TODOS los candidatos que
        # pasan filtros y luego ordenamos por IsBoost desc + PublishedUtc desc.
        # El truncado a MaxPerSub se aplica tras el sort, fuera del bucle.
        # Asi garantizamos que threads con BoostKeyword aparezcan al top aunque
        # esten mas abajo en el feed RSS.
    }

    # Sort: boost al top, despues por edad ascendente (mas reciente primero).
    $sorted = @($kept | Sort-Object -Property @{Expression='IsBoost';Descending=$true}, @{Expression='PublishedUtc';Descending=$true})
    $finalKept = @($sorted | Select-Object -First $MaxPerSub)

    $results[$subName] = $finalKept
    $totalCandidates += $finalKept.Count
    $boostCount = @($finalKept | Where-Object { $_.IsBoost }).Count
    Write-Verbose ("[{0}] candidatos tras filtros: {1} (de los cuales {2} boost)" -f $subName, $finalKept.Count, $boostCount)
}


# ---------------------------------------------------------------------------
# DryRun: stats crudos y salida temprana
# ---------------------------------------------------------------------------

if ($DryRun) {
    Write-Output ('# DryRun: estadisticas crudas por sub')
    Write-Output ''
    Write-Output ('UTC stamp: {0}' -f $timestamp)
    Write-Output ('Subs consultados: {0}' -f $subNames)
    Write-Output ('User-Agent: {0}' -f $UserAgent)
    Write-Output ''
    foreach ($sub in $SubsConfig) {
        $st = $dryRunStats[$sub.Name]
        Write-Output ('## {0}' -f $sub.Name)
        if ($null -eq $st) {
            Write-Output '  (sin datos: fetch fallo o XML invalido)'
            Write-Output ''
            continue
        }
        Write-Output ('- Entries en feed: {0}' -f $st.EntriesTotal)
        Write-Output ('- Autores unicos: {0}' -f $st.AuthorsUnique.Count)
        Write-Output ('- Primeros 5 titulos (sin filtrar):')
        $i = 1
        foreach ($t in $st.FirstFiveTitles) {
            Write-Output ('  {0}. {1}' -f $i, $t)
            $i++
        }
        Write-Output ''
    }
    exit 0
}


# ---------------------------------------------------------------------------
# Output markdown
# ---------------------------------------------------------------------------

$mdLines = New-Object System.Collections.Generic.List[string]
[void]$mdLines.Add(('# Candidatos para comentario (descubrimiento {0})' -f $timestamp))
[void]$mdLines.Add('')
[void]$mdLines.Add(('Subs consultados: {0}' -f $subNames))
[void]$mdLines.Add(('Total candidatos despues de filtros: {0}' -f $totalCandidates))
[void]$mdLines.Add('')

foreach ($sub in $SubsConfig) {
    $list = $results[$sub.Name]
    if ($null -eq $list) { $list = @() }
    [void]$mdLines.Add(('## {0}' -f $sub.Name))
    [void]$mdLines.Add('')
    if ($list.Count -eq 0) {
        [void]$mdLines.Add('(sin candidatos tras filtros)')
        [void]$mdLines.Add('')
        continue
    }
    $i = 1
    foreach ($c in $list) {
        $boostTag = ''
        if ($c.IsBoost) { $boostTag = ' [BOOST]' }
        [void]$mdLines.Add(('### {0}. {1}{2}' -f $i, $c.Title, $boostTag))
        [void]$mdLines.Add(('- URL: {0}' -f $c.Url))
        [void]$mdLines.Add(('- Edad: {0} (publicado {1:yyyy-MM-ddTHH:mm}Z)' -f $c.AgeFormatted, $c.PublishedUtc))
        [void]$mdLines.Add(('- Autor: /u/{0}' -f ($c.Author -replace '^/u/', '' -replace '^u/', '')))
        [void]$mdLines.Add('')
        $i++
    }
}

$mdLines | ForEach-Object { Write-Output $_ }


# ---------------------------------------------------------------------------
# JSON opcional (-OutputJson)
# ---------------------------------------------------------------------------

if ($OutputJson) {
    $jsonObj = [pscustomobject]@{
        generated_at       = $timestamp
        user_agent         = $UserAgent
        subs_consultados   = @($SubsConfig | ForEach-Object { $_.Name })
        total_candidatos   = $totalCandidates
        candidatos_por_sub = @{}
    }
    foreach ($sub in $SubsConfig) {
        $jsonObj.candidatos_por_sub[$sub.Name] = @($results[$sub.Name] | ForEach-Object {
            [pscustomobject]@{
                subreddit     = $_.Subreddit
                title         = $_.Title
                url           = $_.Url
                author        = ($_.Author -replace '^/u/', '' -replace '^u/', '')
                published_utc = $_.PublishedUtc.ToString('yyyy-MM-ddTHH:mm:ssZ')
                age           = $_.AgeFormatted
                is_boost      = [bool]$_.IsBoost
            }
        })
    }
    $jsonDir = Split-Path -Parent $JsonOutputPath
    if (-not (Test-Path -LiteralPath $jsonDir)) {
        New-Item -ItemType Directory -Path $jsonDir -Force | Out-Null
    }
    $jsonStr = $jsonObj | ConvertTo-Json -Depth 8
    Set-Content -LiteralPath $JsonOutputPath -Value $jsonStr -Encoding UTF8
    Write-Verbose ("JSON escrito en: {0}" -f $JsonOutputPath)
}


# ---------------------------------------------------------------------------
# Salida con codigo de error si no hay candidatos
# ---------------------------------------------------------------------------

if ($totalCandidates -eq 0) {
    Write-Error 'No se encontraron candidatos tras aplicar filtros en ninguno de los subs. Revisa logs con -Verbose o usa -DryRun para inspeccionar el feed crudo.'
    exit 1
}

exit 0
