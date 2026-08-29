<#
.SYNOPSIS
    Notifica a IndexNow (Bing / Yandex / Seznam / Naver) las URLs publicas de
    PROD para que las rastreen en horas en vez de semanas. Paso A del frente
    IndexNow (el paso B lo automatiza desde backend al publicar articulo).

.DESCRIPTION
    IndexNow es un protocolo abierto de "ping": en vez de esperar a que el
    crawler pase, se le envia la lista de URLs nuevas o modificadas. No tiene
    cuenta, ni credenciales, ni coste. La propiedad del dominio se demuestra
    publicando un fichero de texto en la raiz cuyo nombre y contenido son la
    misma clave.

    Por que importa aqui: Bing es la fuente de busqueda web de ChatGPT y
    Copilot. El canal `AI Assistant` de GA4 (10 sesiones / 9 engaged en 30d)
    supera al organico de Google (7 sesiones), y `pending-hardening` §6.2 ya
    documentaba que la IA convierte 4-5x mejor. Google NO consume IndexNow;
    para Google el canal sigue siendo el sitemap.

    Flujo:
      1) Validar el formato de la clave (8-128 chars, [a-zA-Z0-9-]).
      2) (opcional -UploadKeyFile) Subir <clave>.txt a la raiz del bucket PROD
         e invalidar esa ruta en CloudFront.
      3) Verificar que https://<host>/<clave>.txt responde 200 y su cuerpo es
         EXACTAMENTE la clave. Si no, ABORTA: sin fichero valido IndexNow
         rechaza el envio entero y no tiene sentido seguir.
      4) Obtener las URLs: las de -Urls si se pasan, o todas las <loc> del
         sitemap de PROD.
      5) POST JSON a api.indexnow.org con {host, key, keyLocation, urlList}.
      6) Reportar el resultado.

    Nota sobre la CloudFront Function: `redirect-spa-prod.js` solo reescribe a
    /index.html los paths SIN punto (`if (!uri.includes('.'))`), asi que un
    `.txt` en la raiz cae al origen S3 sin tocar. No hace falta cambiar la
    funcion ni anadir cache behaviors.

    Nota sobre la clave: NO es un secreto. Se publica a proposito en el
    dominio; su unica funcion es demostrar que quien envia controla el sitio.
    Por eso puede vivir en config.env y aparecer en logs sin problema.

    Codigos de respuesta de IndexNow:
      200 OK          - aceptado.
      202 Accepted    - aceptado, clave pendiente de validar.
      400 Bad Request - formato invalido.
      403 Forbidden   - clave no valida (fichero ausente o contenido distinto).
      422 Unprocessable - URLs que no pertenecen al host, o clave que no casa.
      429 Too Many Requests - exceso de envios (spam).

.PARAMETER Key
    Clave IndexNow. Si se omite, se lee de la variable de entorno
    SEO_INDEXNOW_KEY. 8-128 caracteres [a-zA-Z0-9-].

.PARAMETER Hostname
    URL base de PROD. Default https://sharemechat.com.

.PARAMETER Bucket
    Bucket S3 del frontend PROD. Default sharemechat-frontend-prod.

.PARAMETER DistributionId
    Distribucion CloudFront PROD. Default E2FWNC80D4QDJC. Solo se usa para
    invalidar el fichero de clave cuando se pasa -UploadKeyFile.

.PARAMETER Urls
    Lista explicita de URLs absolutas a enviar. Si se omite, se envian todas
    las <loc> del sitemap.

.PARAMETER UploadKeyFile
    Sube (o refresca) <clave>.txt en la raiz del bucket antes de enviar.
    Necesario la primera vez y si se rota la clave.

.PARAMETER DryRun
    Hace todas las verificaciones y muestra las URLs que se enviarian, pero NO
    llama a IndexNow ni sube nada.

.EXAMPLE
    # Primera vez: publica la clave y envia todo el sitemap
    .\indexnow-submit-prod.ps1 -Key "abc123..." -UploadKeyFile

.EXAMPLE
    # Envio incremental de dos URLs concretas
    .\indexnow-submit-prod.ps1 -Urls @(
        "https://sharemechat.com/blog/es/mi-articulo",
        "https://sharemechat.com/blog/en/my-article")

.EXAMPLE
    # Ensayo sin efectos
    .\indexnow-submit-prod.ps1 -DryRun
#>

[CmdletBinding()]
param(
    [string]   $Key            = $env:SEO_INDEXNOW_KEY,
    [string]   $Hostname       = "https://sharemechat.com",
    [string]   $Bucket         = "sharemechat-frontend-prod",
    [string]   $DistributionId = "E2FWNC80D4QDJC",
    [string[]] $Urls,
    [switch]   $UploadKeyFile,
    [switch]   $DryRun
)

$ErrorActionPreference = 'Stop'

# Limite del protocolo: 10.000 URLs por envio.
$INDEXNOW_MAX_URLS = 10000
$INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"

function Write-Step { param([string]$N, [string]$L) ; Write-Host "" ; Write-Host "    > $N $L" }

Write-Host "=================================================="
Write-Host " indexnow-submit-prod.ps1 -> PROD"
Write-Host "=================================================="
Write-Host " Hostname: $Hostname"
Write-Host " Bucket:   $Bucket"
if ($DryRun) { Write-Host " MODO:     DRY-RUN (no sube nada, no envia nada)" }

# -----------------------------------------------------------
Write-Step "1/6" "Validar clave"
# -----------------------------------------------------------
if ([string]::IsNullOrWhiteSpace($Key)) {
    throw "Falta la clave. Pasa -Key o define SEO_INDEXNOW_KEY. Genera una con: -join ((1..32) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })"
}
if ($Key -notmatch '^[a-zA-Z0-9-]{8,128}$') {
    throw "Clave con formato invalido. IndexNow exige 8-128 caracteres [a-zA-Z0-9-]. Recibida: longitud $($Key.Length)."
}
$keyFileName = "$Key.txt"
$keyLocation = "$Hostname/$keyFileName"
Write-Host "      OK - clave valida (longitud $($Key.Length)). keyLocation=$keyLocation"

# -----------------------------------------------------------
Write-Step "2/6" "Publicar fichero de clave en S3"
# -----------------------------------------------------------
if (-not $UploadKeyFile) {
    Write-Host "      SALTADO (sin -UploadKeyFile). Se asume ya publicado."
} elseif ($DryRun) {
    Write-Host "      DRY-RUN: se subiria s3://$Bucket/$keyFileName y se invalidaria /$keyFileName"
} else {
    $tmp = Join-Path ([System.IO.Path]::GetTempPath()) $keyFileName
    # Sin BOM y sin salto final: IndexNow compara el cuerpo con la clave.
    [System.IO.File]::WriteAllText($tmp, $Key, (New-Object System.Text.UTF8Encoding($false)))

    aws s3 cp $tmp "s3://$Bucket/$keyFileName" --content-type "text/plain" --cache-control "public, max-age=3600" | Out-Null
    if ($LASTEXITCODE -ne 0) { Remove-Item $tmp -Force -EA SilentlyContinue; throw "Fallo la subida a S3 (exit $LASTEXITCODE)." }
    Remove-Item $tmp -Force -EA SilentlyContinue
    Write-Host "      subido s3://$Bucket/$keyFileName"

    $inv = aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/$keyFileName" --query "Invalidation.Id" --output text
    if ($LASTEXITCODE -ne 0) { throw "Fallo la invalidacion de CloudFront (exit $LASTEXITCODE)." }
    Write-Host "      invalidacion CloudFront $inv"
}

# -----------------------------------------------------------
Write-Step "3/6" "Verificar que la clave se sirve correctamente"
# -----------------------------------------------------------
# Critico: si el fichero no se sirve con el contenido exacto, IndexNow
# responde 403 y descarta el envio COMPLETO. Mejor abortar aqui.
# Ojo: el Custom Error Response de la distribucion convierte el 403 de S3 en
# 200 + shell SPA, asi que un fichero ausente NO da 404 sino HTML. Por eso se
# compara el cuerpo, no solo el status.
if ($DryRun -and $UploadKeyFile) {
    Write-Host "      DRY-RUN: se omite (el fichero aun no se ha subido)."
} else {
    try {
        $resp = Invoke-WebRequest -Uri $keyLocation -UseBasicParsing -TimeoutSec 30
    } catch {
        throw "No se pudo leer $keyLocation : $($_.Exception.Message). Lanza con -UploadKeyFile."
    }
    $body = ($resp.Content | Out-String).Trim()
    if ($body -cne $Key) {
        $preview = $body.Substring(0, [Math]::Min(80, $body.Length))
        throw "El cuerpo de $keyLocation NO coincide con la clave (recibido: '$preview'...). Si parece HTML, el fichero no existe en el bucket y el CER esta sirviendo el shell SPA. Lanza con -UploadKeyFile."
    }
    Write-Host "      OK - $keyLocation devuelve la clave exacta."
}

# -----------------------------------------------------------
Write-Step "4/6" "Recolectar URLs"
# -----------------------------------------------------------
if ($Urls -and $Urls.Count -gt 0) {
    $urlList = @($Urls)
    Write-Host "      $($urlList.Count) URL(s) explicitas."
} else {
    $sitemapUrl = "$Hostname/sitemap.xml"
    Write-Host "      Leyendo $sitemapUrl ..."
    $sm = Invoke-WebRequest -Uri $sitemapUrl -UseBasicParsing -TimeoutSec 45
    $xml = [xml]$sm.Content
    $urlList = @($xml.urlset.url | ForEach-Object { $_.loc } | Where-Object { $_ })
    Write-Host "      $($urlList.Count) URL(s) en el sitemap."
}

# IndexNow rechaza (422) el lote entero si alguna URL no pertenece al host.
$hostOnly = ([System.Uri]$Hostname).Host
$foreign  = @($urlList | Where-Object { ([System.Uri]$_).Host -ne $hostOnly })
if ($foreign.Count -gt 0) {
    Write-Warning "      Descartadas $($foreign.Count) URL(s) de otro host (IndexNow devolveria 422):"
    $foreign | ForEach-Object { Write-Warning "        $_" }
    $urlList = @($urlList | Where-Object { ([System.Uri]$_).Host -eq $hostOnly })
}
if ($urlList.Count -eq 0) { throw "No hay URLs que enviar." }
if ($urlList.Count -gt $INDEXNOW_MAX_URLS) {
    throw "El lote excede el limite del protocolo ($($urlList.Count) > $INDEXNOW_MAX_URLS). Trocea con -Urls."
}

# -----------------------------------------------------------
Write-Step "5/6" "Enviar a IndexNow"
# -----------------------------------------------------------
$payload = [ordered]@{
    host        = $hostOnly
    key         = $Key
    keyLocation = $keyLocation
    urlList     = $urlList
} | ConvertTo-Json -Depth 4

if ($DryRun) {
    Write-Host "      DRY-RUN: no se envia. Se enviarian $($urlList.Count) URL(s):"
    $urlList | ForEach-Object { Write-Host "        $_" }
} else {
    try {
        $r = Invoke-WebRequest -Uri $INDEXNOW_ENDPOINT -Method Post -Body $payload `
                -ContentType "application/json; charset=utf-8" -UseBasicParsing -TimeoutSec 60
        $code = [int]$r.StatusCode
    } catch {
        $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { -1 }
        if ($code -le 0) { throw "Fallo de red al llamar a IndexNow: $($_.Exception.Message)" }
    }

    switch ($code) {
        200 { Write-Host "      OK 200 - $($urlList.Count) URL(s) aceptadas." }
        202 { Write-Host "      OK 202 - aceptadas; clave pendiente de validar por el buscador." }
        400 { throw "400 Bad Request - payload mal formado." }
        403 { throw "403 Forbidden - clave no valida. Verifica $keyLocation (relanza con -UploadKeyFile)." }
        422 { throw "422 Unprocessable - URLs que no pertenecen al host, o clave que no casa con keyLocation." }
        429 { throw "429 Too Many Requests - demasiados envios. Espera antes de reintentar." }
        default { throw "Respuesta inesperada de IndexNow: HTTP $code" }
    }
}

# -----------------------------------------------------------
Write-Step "6/6" "Cierre"
# -----------------------------------------------------------
Write-Host "      Host:        $hostOnly"
Write-Host "      URLs:        $($urlList.Count)"
Write-Host "      keyLocation: $keyLocation"
Write-Host ""
Write-Host "    IndexNow no confirma indexacion, solo recepcion. Verifica el efecto"
Write-Host "    en Bing Webmaster Tools (URL Inspection / Site Explorer) en 24-72h."
Write-Host ""
