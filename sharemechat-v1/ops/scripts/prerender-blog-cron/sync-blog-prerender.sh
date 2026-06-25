#!/usr/bin/env bash
# sync-blog-prerender.sh
# Detecta articulos publicados sin HTML pre-renderizado en S3 y los renderiza.
# Auto-curativo, idempotente. Logs en /var/log/sharemechat-prerender/.
#
# Contrato con render.js (sharemechat-v1/ops/scripts/prerender-blog/render.js,
# copiado a /opt/sharemechat/prerender-blog/render.js):
#   - urls: array de strings con paths relativos ("/blog/es", "/blog/es/<slug>").
#   - hostname: base URL absoluta.
#   - shellTitle: title del shell SPA para fallback de hidratacion.
#   - outDir: render.js escribe <outDir>/<path-sin-slash-inicial>/index.html.
# Timeouts del render.js son hardcoded (45s nav, 20s selector, 10s fallback, 15s img);
# si necesitan ajuste, hacerlo en el render.js del repo.

set -euo pipefail

LOG_DIR="/var/log/sharemechat-prerender"
LOG_FILE="${LOG_DIR}/sync-$(date +%Y%m%d).log"
# Lock dentro de LOG_DIR (ownership ec2-user). /var/lock es root:root y el
# servicio corre como ec2-user; usar /var/lock daria EACCES.
LOCK_FILE="${LOG_DIR}/.lock"
WORK_DIR="/opt/sharemechat/prerender-blog"
S3_BUCKET="sharemechat-frontend-prod"
S3_PREFIX="blog"
CF_DIST_ID="E2FWNC80D4QDJC"
API_BASE="https://sharemechat.com/api/public/content/articles"
HOSTNAME_BASE="https://sharemechat.com"
SHELL_TITLE="1-to-1 Video Chat with Verified Models | SharemeChat"
# Patrones de error de hidratacion del SPA: BlogArticleView.jsx setea este
# texto via setError(t('blog:states.errorArticle')) cuando el fetch a
# /api/public/content/articles/{slug} falla durante la primera hidratacion.
# Puppeteer captura el DOM con el mensaje visible y pasa los checks de size
# + title (los meta tags si se aplicaron). Esto blinda contra race conditions
# entre publicacion y disponibilidad de htmlBody en la API/cache del backend.
# Se incluyen las dos variantes (con/sin tilde) por si la i18n cambia.
ERROR_PATTERNS=(
    "No se pudo cargar el articulo"
    "No se pudo cargar el artículo"
)

mkdir -p "$LOG_DIR"

log() {
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "$LOG_FILE"
}

# Cuenta lineas no-vacias de un string. Devuelve siempre un unico numero,
# 0 incluido. Necesario porque `grep -c . || echo 0` produce "0\n0" cuando
# el input es vacio (grep escribe "0" + exit 1 + echo "0"), rompiendo la
# aritmetica posterior con set -e + pipefail.
count_nonblank() {
    local count
    count=$(printf '%s\n' "$1" | grep -c '^.' 2>/dev/null) || count=0
    echo "$count"
}

# Lock con flock - si ya hay otra ejecucion, salir limpio
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
    log "Otra ejecucion en curso (lock activo). Saliendo."
    exit 0
fi

START_TS=$(date +%s)
log "===== Inicio sync-blog-prerender ====="

# 1. Obtener slugs publicados via API publica
log "Consultando API publica..."
ES_SLUGS=$(curl -fsS "${API_BASE}?locale=es&size=200" | python3 -c "import sys,json; d=json.load(sys.stdin); print('\n'.join(i['slug'] for i in d.get('items',[])))" || echo "")
EN_SLUGS=$(curl -fsS "${API_BASE}?locale=en&size=200" | python3 -c "import sys,json; d=json.load(sys.stdin); print('\n'.join(i['slug'] for i in d.get('items',[])))" || echo "")

ES_COUNT=$(count_nonblank "$ES_SLUGS")
EN_COUNT=$(count_nonblank "$EN_SLUGS")
log "API publica: ES=$ES_COUNT slugs, EN=$EN_COUNT slugs"

# 2. Obtener slugs ya pre-renderizados en S3
log "Listando S3..."
S3_ES_KEYS=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/es/" --recursive 2>/dev/null | grep '/index.html$' | awk '{print $4}' | sed -E "s|${S3_PREFIX}/es/||;s|/index.html||" | grep -v '^$' || echo "")
S3_EN_KEYS=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/en/" --recursive 2>/dev/null | grep '/index.html$' | awk '{print $4}' | sed -E "s|${S3_PREFIX}/en/||;s|/index.html||" | grep -v '^$' || echo "")

# 3. Calcular diff: slugs en API que NO estan en S3
MISSING_ES=$(comm -23 <(echo "$ES_SLUGS" | sort -u) <(echo "$S3_ES_KEYS" | sort -u) | grep -v '^$' || echo "")
MISSING_EN=$(comm -23 <(echo "$EN_SLUGS" | sort -u) <(echo "$S3_EN_KEYS" | sort -u) | grep -v '^$' || echo "")

MISSING_ES_COUNT=$(count_nonblank "$MISSING_ES")
MISSING_EN_COUNT=$(count_nonblank "$MISSING_EN")
TOTAL_MISSING=$((MISSING_ES_COUNT + MISSING_EN_COUNT))

if [ "$TOTAL_MISSING" -eq 0 ]; then
    log "Sin diff. Nada que hacer. Duracion: $(( $(date +%s) - START_TS ))s"
    exit 0
fi

log "DIFF detectado: ES=$MISSING_ES_COUNT faltantes, EN=$MISSING_EN_COUNT faltantes"
log "Slugs ES faltantes: $(echo $MISSING_ES | tr '\n' ' ')"
log "Slugs EN faltantes: $(echo $MISSING_EN | tr '\n' ' ')"

# 4. Construir config para render.js (formato OLD: hostname + urls strings + shellTitle)
TMP_OUT=$(mktemp -d /tmp/prerender-cron.XXXXXX)
CONFIG_FILE="${TMP_OUT}/config.json"

# Listings siempre se re-renderizan cuando hay diff (su JSON-LD incluye la lista
# completa de articulos; un articulo nuevo cambia el contenido del listing).
MISSING_ES_VAR="$MISSING_ES" MISSING_EN_VAR="$MISSING_EN" \
TMP_OUT_VAR="$TMP_OUT" HOSTNAME_VAR="$HOSTNAME_BASE" SHELL_TITLE_VAR="$SHELL_TITLE" \
python3 <<'PYEOF' > "$CONFIG_FILE"
import json, os
urls = ['/blog/es', '/blog/en']  # listings primero
for slug in os.environ['MISSING_ES_VAR'].strip().split('\n'):
    slug = slug.strip()
    if slug:
        urls.append(f'/blog/es/{slug}')
for slug in os.environ['MISSING_EN_VAR'].strip().split('\n'):
    slug = slug.strip()
    if slug:
        urls.append(f'/blog/en/{slug}')
config = {
    "outDir": os.environ['TMP_OUT_VAR'],
    "hostname": os.environ['HOSTNAME_VAR'],
    "urls": urls,
    "shellTitle": os.environ['SHELL_TITLE_VAR'],
}
print(json.dumps(config, indent=2))
PYEOF

URL_COUNT=$(python3 -c "import json; print(len(json.load(open('$CONFIG_FILE'))['urls']))")
log "Config preparado. URLs a renderizar: $URL_COUNT"

# 5. Ejecutar render.js
log "Ejecutando Puppeteer..."
RENDER_START=$(date +%s)
cd "$WORK_DIR"
if node render.js --config "$CONFIG_FILE" >> "$LOG_FILE" 2>&1; then
    log "Puppeteer OK. Duracion render: $(( $(date +%s) - RENDER_START ))s"
else
    RC=$?
    log "ERROR: Puppeteer fallo con exit $RC. Abortando esta pasada."
    rm -rf "$TMP_OUT"
    exit 1
fi

# 6. Sanity check: verificar que cada HTML generado NO es el shell SPA NI
#    contiene mensaje de error de hidratacion del SPA.
log "Verificando HTMLs generados..."
INVALID=0
GENERATED=0
ERROR_HYDRATION=0
while IFS= read -r html; do
    [ -z "$html" ] && continue
    GENERATED=$((GENERATED + 1))
    SIZE=$(wc -c < "$html")
    TITLE=$(grep -o '<title>[^<]*</title>' "$html" | head -1)
    # Check 1+2: shell SPA o size insuficiente
    if [ "$SIZE" -lt 10000 ] || echo "$TITLE" | grep -qF "$SHELL_TITLE"; then
        log "SOSPECHOSO: $html size=$SIZE title=$TITLE"
        INVALID=$((INVALID + 1))
        continue
    fi
    # Check 3: mensaje de error de hidratacion del SPA. Patron clave del
    # incidente identificado el 2026-06-25: el HTML tiene title y JSON-LD
    # correctos, size > 10KB, pero el cuerpo es el mensaje del setError de
    # BlogArticleView.jsx. SEO/preview pasan, contenido NO.
    for pat in "${ERROR_PATTERNS[@]}"; do
        if grep -qF "$pat" "$html"; then
            log "SOSPECHOSO: $html contiene mensaje de error de hidratacion ('$pat') - SPA fallo en fetch durante render"
            INVALID=$((INVALID + 1))
            ERROR_HYDRATION=$((ERROR_HYDRATION + 1))
            break
        fi
    done
done < <(find "$TMP_OUT" -name 'index.html')

log "HTMLs generados: $GENERATED, sospechosos: $INVALID (de los cuales $ERROR_HYDRATION con mensaje de error de hidratacion)"
if [ "$INVALID" -gt 0 ]; then
    if [ "$ERROR_HYDRATION" -gt 0 ]; then
        log "ERROR: $ERROR_HYDRATION HTML(s) contienen mensaje de error de hidratacion. SPA no rendero el contenido. Abortando upload sin tocar S3."
    else
        log "ERROR: $INVALID HTML(s) parecen ser shell SPA, no articulos pre-renderizados. Abortando upload."
    fi
    rm -rf "$TMP_OUT"
    exit 1
fi
if [ "$GENERATED" -eq 0 ]; then
    log "ERROR: render.js termino exit 0 pero no genero ningun index.html. Abortando."
    rm -rf "$TMP_OUT"
    exit 1
fi

# 7. Subir a S3 + recolectar paths a invalidar
log "Subiendo a S3..."
INVALIDATION_PATHS=()
while IFS= read -r html; do
    [ -z "$html" ] && continue
    # html = $TMP_OUT/blog/es/foo/index.html -> RELATIVE_KEY = blog/es/foo/index.html
    RELATIVE_KEY="${html#${TMP_OUT}/}"
    aws s3 cp "$html" "s3://${S3_BUCKET}/${RELATIVE_KEY}" \
        --content-type "text/html; charset=utf-8" \
        --cache-control "public, max-age=300" >> "$LOG_FILE" 2>&1
    # Path publico de CloudFront (sin /index.html). La funcion edge
    # redirect-spa-prod reescribe /blog/<path> a <path>/index.html, asi que
    # el cache key de CF es el path original SIN /index.html.
    PUB_PATH="/${RELATIVE_KEY%/index.html}"
    INVALIDATION_PATHS+=("$PUB_PATH")
done < <(find "$TMP_OUT" -name 'index.html')

log "S3 upload OK. ${#INVALIDATION_PATHS[@]} ficheros subidos."

# 8. Invalidar CloudFront SOLO las paths concretas afectadas (no /blog/*)
log "Invalidando CloudFront para: ${INVALIDATION_PATHS[*]}"
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$CF_DIST_ID" \
    --paths "${INVALIDATION_PATHS[@]}" \
    --query 'Invalidation.Id' \
    --output text 2>>"$LOG_FILE")
log "CloudFront invalidation lanzada: ID=$INVALIDATION_ID, paths=${#INVALIDATION_PATHS[@]}"

# 9. Limpieza
rm -rf "$TMP_OUT"
log "===== Fin sync-blog-prerender. Duracion total: $(( $(date +%s) - START_TS ))s ====="
