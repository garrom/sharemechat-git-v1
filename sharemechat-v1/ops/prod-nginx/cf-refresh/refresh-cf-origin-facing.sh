#!/usr/bin/env bash
# Regenera /etc/nginx/cloudfront-origin-facing.conf desde ip-ranges.json.
# Hace nginx -t y nginx -s reload si OK. Backup automatico con timestamp.
# Llamado por systemd timer sharemechat-cf-cidrs-refresh.timer (mensual).
set -euo pipefail

TARGET=/etc/nginx/cloudfront-origin-facing.conf
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

# Generar contenido con CIDRs CLOUDFRONT_ORIGIN_FACING
python3 << 'PY' > "$TMP"
import json, urllib.request, sys
try:
    d = json.loads(urllib.request.urlopen("https://ip-ranges.amazonaws.com/ip-ranges.json", timeout=30).read())
except Exception as e:
    print(f"# refresh ABORT: {e}", file=sys.stderr); sys.exit(2)
cidrs = sorted({p["ip_prefix"] for p in d["prefixes"] if p["service"] == "CLOUDFRONT_ORIGIN_FACING"})
print("# CloudFront origin-facing IP ranges (service=CLOUDFRONT_ORIGIN_FACING)")
print("# Generado automaticamente por sharemechat-cf-cidrs-refresh.timer")
print("# desde https://ip-ranges.amazonaws.com/ip-ranges.json")
print("# NO editar manualmente: el timer sobrescribira los cambios.")
print(f"# Total CIDRs: {len(cidrs)}")
print("#")
for c in cidrs:
    print(f"set_real_ip_from {c};")
PY

if [[ ! -s "$TMP" ]]; then
    echo "refresh: temp vacio, abort sin tocar nada" >&2
    exit 1
fi

# Diff: si no hay cambios, no tocamos
if cmp -s "$TMP" "$TARGET"; then
    echo "refresh: sin cambios"
    exit 0
fi

# Backup + replace + nginx -t + reload
TS=$(date -u +%Y%m%d-%H%M%S)
cp "$TARGET" "${TARGET}.bak-refresh-${TS}"
cat "$TMP" > "$TARGET"
chmod 0644 "$TARGET"

if ! nginx -t 2>&1; then
    echo "refresh: nginx -t FAIL, restaurando backup" >&2
    cp "${TARGET}.bak-refresh-${TS}" "$TARGET"
    exit 1
fi

nginx -s reload
echo "refresh OK: $(grep -c '^set_real_ip_from' $TARGET) CIDRs activos"
