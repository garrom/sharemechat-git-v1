#!/usr/bin/env bash
# ops/_governance/check_ops_runtime.sh
#
# Runtime checker for the perimeter audit pipeline.
# READ-ONLY: no modifications, no restarts, no reloads, no nginx changes.
#
# Usage:
#   bash check_ops_runtime.sh [audit|test]
#
# If no argument is given the environment is inferred automatically from
# the presence of /etc/sharemechat-<env>-access-blocker/config.env.
#
# Exit codes:
#   0 — no errors (warnings may be present)
#   1 — one or more errors found

# ---------------------------------------------------------------------------
# Safety: no -e so individual check failures don't abort the whole script.
# ---------------------------------------------------------------------------
set -uo pipefail

# ---------------------------------------------------------------------------
# Message accumulators
# ---------------------------------------------------------------------------
OK_MSGS=()
WARN_MSGS=()
ERR_MSGS=()

_ok()   { OK_MSGS+=("$1"); }
_warn() { WARN_MSGS+=("$1"); }
_err()  { ERR_MSGS+=("$1"); }

# ---------------------------------------------------------------------------
# Date helpers (portable: GNU date and BSD date)
# ---------------------------------------------------------------------------
TODAY_UTC=$(date -u +%F)
YESTERDAY_UTC=$(  date -u -d "yesterday" +%F 2>/dev/null \
               || date -u -v-1d +%F 2>/dev/null \
               || echo "")

if [[ -z "${YESTERDAY_UTC}" ]]; then
  _err "No se pudo calcular la fecha de ayer en UTC (date -d / -v no disponible)"
  YESTERDAY_UTC="unknown"
fi

# ---------------------------------------------------------------------------
# Environment detection
# ---------------------------------------------------------------------------
ENV=""

if [[ $# -ge 1 ]]; then
  case "$1" in
    audit|test)
      ENV="$1"
      ;;
    -h|--help)
      echo "Uso: bash check_ops_runtime.sh [audit|test]"
      exit 0
      ;;
    *)
      echo "ERROR: parametro invalido '$1'. Usar: audit | test" >&2
      exit 1
      ;;
  esac
else
  # Auto-detect from config.env presence.
  AUDIT_CFG="/etc/sharemechat-audit-access-blocker/config.env"
  TEST_CFG="/etc/sharemechat-test-access-blocker/config.env"
  HAS_AUDIT=0; HAS_TEST=0
  [[ -f "${AUDIT_CFG}" ]] && HAS_AUDIT=1
  [[ -f "${TEST_CFG}"  ]] && HAS_TEST=1

  if   [[ ${HAS_AUDIT} -eq 1 && ${HAS_TEST} -eq 0 ]]; then ENV="audit"
  elif [[ ${HAS_TEST}  -eq 1 && ${HAS_AUDIT} -eq 0 ]]; then ENV="test"
  elif [[ ${HAS_AUDIT} -eq 1 && ${HAS_TEST}  -eq 1 ]]; then
    echo "ERROR: config.env encontrado en ambos entornos. Especificar: audit | test" >&2
    exit 1
  else
    echo "ERROR: no se encontro config.env en /etc/sharemechat-{audit,test}-access-blocker/." >&2
    echo "       Especificar entorno: bash $0 audit  |  bash $0 test" >&2
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# Environment-specific paths
# ---------------------------------------------------------------------------
BLOCKER_CONFIG="/etc/sharemechat-${ENV}-access-blocker/config.env"
BLOCKER_SERVICE="sharemechat-${ENV}-access-blocker.service"
BLOCKER_TIMER="sharemechat-${ENV}-access-blocker.timer"
BLOCKER_LOG_DIR="/var/log/sharemechat-${ENV}-access-blocker"
BLOCKER_STATE="/var/lib/sharemechat-${ENV}-access-blocker/ips.json"

DIFF_FILE="${BLOCKER_LOG_DIR}/${YESTERDAY_UTC}.blocker-diff.txt"
SNAPSHOT_FILE="${BLOCKER_LOG_DIR}/${YESTERDAY_UTC}.ips.json"

if [[ "${ENV}" == "audit" ]]; then
  PROPOSED_CONF="${BLOCKER_LOG_DIR}/${YESTERDAY_UTC}.deny-audit-ips.proposed.conf"
  NGINX_DENY_LIVE="/etc/nginx/deny-audit-ips.conf"
  NGINX_DENY_MANUAL="/etc/nginx/deny-audit-ips.manual.conf"
  EXPECTED_DRY_RUN="0"
else
  PROPOSED_CONF="${BLOCKER_LOG_DIR}/${YESTERDAY_UTC}.deny-test-ips.proposed.conf"
  NGINX_DENY_LIVE="/etc/nginx/deny-test-ips.conf"
  NGINX_DENY_MANUAL="/etc/nginx/deny-test-ips.manual.conf"
  EXPECTED_DRY_RUN="1"
fi

# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------
print_header() {
  echo "============================================================"
  echo "OPS RUNTIME CHECK"
  echo "environment  : ${ENV}"
  echo "date_checked : ${TODAY_UTC}"
  echo "target_day   : ${YESTERDAY_UTC}"
  echo "============================================================"
}

# ---------------------------------------------------------------------------
# Rule 1 + 2: Config exists and DRY_RUN value is correct
# ---------------------------------------------------------------------------
check_config() {
  echo ""
  echo "--- [1/2] Config y DRY_RUN ---"

  if [[ ! -f "${BLOCKER_CONFIG}" ]]; then
    _err "config no encontrado: ${BLOCKER_CONFIG}"
    return
  fi
  _ok "config existe: ${BLOCKER_CONFIG}"

  # Extract DRY_RUN value (last occurrence, strip spaces/quotes/CR).
  DRY_RUN_VAL=$(grep -E '^[[:space:]]*DRY_RUN=' "${BLOCKER_CONFIG}" \
    | tail -1 \
    | sed 's/.*DRY_RUN=[[:space:]]*//' \
    | tr -d "'\"" \
    | tr -d '[:space:]' \
    | tr -d '\r')

  if [[ -z "${DRY_RUN_VAL}" ]]; then
    _warn "DRY_RUN no encontrado en ${BLOCKER_CONFIG}"
  elif [[ "${DRY_RUN_VAL}" == "${EXPECTED_DRY_RUN}" ]]; then
    _ok "DRY_RUN=${DRY_RUN_VAL} correcto para ${ENV}"
  else
    if [[ "${ENV}" == "audit" ]]; then
      _err "DRY_RUN=${DRY_RUN_VAL} — AUDIT debe tener DRY_RUN=0 (bloqueo real Carril A activo)"
    else
      _err "DRY_RUN=${DRY_RUN_VAL} — TEST debe tener DRY_RUN=1 (modo observacion, sin bloqueo real)"
    fi
  fi
}

# ---------------------------------------------------------------------------
# Rule 3 + 4: Systemd timer y service
# ---------------------------------------------------------------------------
check_systemd() {
  echo ""
  echo "--- [3/4] Systemd timer y service ---"

  # --- Timer ---
  if ! systemctl cat "${BLOCKER_TIMER}" >/dev/null 2>&1; then
    _err "timer ${BLOCKER_TIMER} no encontrado (no cargado en systemd)"
  else
    _ok "timer ${BLOCKER_TIMER} existe (unit cargada)"

    TIMER_ENABLED=$(systemctl is-enabled "${BLOCKER_TIMER}" 2>/dev/null || echo "unknown")
    case "${TIMER_ENABLED}" in
      enabled)  _ok "timer ${BLOCKER_TIMER} enabled" ;;
      unknown)  _warn "no se pudo determinar si ${BLOCKER_TIMER} esta enabled" ;;
      *)        _err "timer ${BLOCKER_TIMER} no enabled (estado: ${TIMER_ENABLED})" ;;
    esac

    TIMER_ACTIVE=$(systemctl is-active "${BLOCKER_TIMER}" 2>/dev/null || echo "unknown")
    case "${TIMER_ACTIVE}" in
      active)   _ok "timer ${BLOCKER_TIMER} active" ;;
      unknown)  _warn "no se pudo determinar si ${BLOCKER_TIMER} esta active" ;;
      *)        _err "timer ${BLOCKER_TIMER} no active (estado: ${TIMER_ACTIVE})" ;;
    esac
  fi

  # --- Service (oneshot — no necesita estar active) ---
  if systemctl cat "${BLOCKER_SERVICE}" >/dev/null 2>&1; then
    _ok "service ${BLOCKER_SERVICE} existe (unit cargada)"
    LAST_RESULT=$(systemctl show -p Result "${BLOCKER_SERVICE}" 2>/dev/null \
      | sed 's/Result=//' || echo "unknown")
    if [[ "${LAST_RESULT}" == "success" || "${LAST_RESULT}" == "exit-code" ]]; then
      _ok "service ultima ejecucion: Result=${LAST_RESULT}"
    elif [[ "${LAST_RESULT}" == "unknown" ]]; then
      _warn "no se pudo obtener Result del service (puede no haber corrido todavia)"
    else
      _warn "service ultima ejecucion: Result=${LAST_RESULT} (revisar journal)"
    fi
  else
    _err "service ${BLOCKER_SERVICE} no encontrado (no cargado en systemd)"
  fi
}

# ---------------------------------------------------------------------------
# Rule 5: Output files for yesterday
# ---------------------------------------------------------------------------
check_outputs() {
  echo ""
  echo "--- [5] Salidas del dia ${YESTERDAY_UTC} ---"

  local all_present=true
  for f in "${DIFF_FILE}" "${PROPOSED_CONF}" "${SNAPSHOT_FILE}"; do
    if [[ -f "${f}" ]]; then
      SIZE=$(wc -c < "${f}" 2>/dev/null || echo "?")
      _ok "salida presente: $(basename "${f}") (${SIZE} bytes)"
    else
      _warn "salida ausente: ${f} (normal si EC2 estuvo apagada o no hubo summary del clasificador)"
      all_present=false
    fi
  done

  if ${all_present}; then
    # Extract quick summary from diff if present.
    if [[ -f "${DIFF_FILE}" ]]; then
      DIFF_HEADER=$(head -5 "${DIFF_FILE}" 2>/dev/null || true)
      echo "  diff cabecera:"
      echo "${DIFF_HEADER}" | sed 's/^/    /'
    fi
  fi
}

# ---------------------------------------------------------------------------
# Rule 6: State file (ips.json) — existence and JSON validity
# ---------------------------------------------------------------------------
check_state_file() {
  echo ""
  echo "--- [6] State file ---"

  if [[ ! -f "${BLOCKER_STATE}" ]]; then
    _warn "state file ausente: ${BLOCKER_STATE} (normal si el componente nunca ha corrido)"
    return
  fi
  _ok "state file existe: ${BLOCKER_STATE}"

  # JSON validity via python3.
  if command -v python3 >/dev/null 2>&1; then
    if python3 -c "import json,sys; json.load(open(sys.argv[1]))" \
        "${BLOCKER_STATE}" >/dev/null 2>&1; then
      _ok "state file es JSON valido"
      IP_COUNT=$(python3 -c \
        "import json,sys; d=json.load(open(sys.argv[1])); print(len(d.get('ips',[])))" \
        "${BLOCKER_STATE}" 2>/dev/null || echo "?")
      UPDATED_AT=$(python3 -c \
        "import json,sys; d=json.load(open(sys.argv[1])); print(d.get('updated_at','?'))" \
        "${BLOCKER_STATE}" 2>/dev/null || echo "?")
      _ok "state file: ${IP_COUNT} IPs, updated_at=${UPDATED_AT}"
    else
      _err "state file existe pero no es JSON valido: ${BLOCKER_STATE}"
    fi
  else
    _warn "python3 no disponible — no se puede validar JSON del state file"
  fi
}

# ---------------------------------------------------------------------------
# Rule 7: nginx -t (read-only config test)
# ---------------------------------------------------------------------------
check_nginx_config() {
  echo ""
  echo "--- [7] nginx -t ---"

  if ! command -v nginx >/dev/null 2>&1; then
    _warn "nginx no encontrado en PATH (saltando nginx -t)"
    return
  fi

  NGINX_OUT=$(nginx -t 2>&1)
  NGINX_RC=$?

  if [[ ${NGINX_RC} -eq 0 ]]; then
    _ok "nginx -t: OK"
  else
    # Distinguish permission errors from real config failures.
    if echo "${NGINX_OUT}" | grep -qi "permission denied\|cannot open\|failed to open"; then
      _warn "nginx -t: fallo por permisos — ejecutar con sudo para validacion completa"
    else
      _err "nginx -t: FALLO — ${NGINX_OUT}"
    fi
  fi
}

# ---------------------------------------------------------------------------
# Rule 8: Nginx deny files
# ---------------------------------------------------------------------------
check_nginx_deny_files() {
  echo ""
  echo "--- [8] Nginx deny files ---"

  # Live deny file.
  if [[ -f "${NGINX_DENY_LIVE}" ]]; then
    DENY_COUNT=$(grep -c '^deny ' "${NGINX_DENY_LIVE}" 2>/dev/null || echo "0")
    _ok "deny live existe: ${NGINX_DENY_LIVE} (${DENY_COUNT} entradas)"
  else
    if [[ "${ENV}" == "audit" ]]; then
      _err "deny live ausente: ${NGINX_DENY_LIVE} (AUDIT con DRY_RUN=0 debe tenerlo)"
    else
      _warn "deny live ausente: ${NGINX_DENY_LIVE} (esperado — TEST en DRY_RUN=1, no se genera todavia)"
    fi
  fi

  # Manual deny file.
  if [[ -f "${NGINX_DENY_MANUAL}" ]]; then
    MANUAL_COUNT=$(grep -c '^deny ' "${NGINX_DENY_MANUAL}" 2>/dev/null || echo "0")
    _ok "deny manual existe: ${NGINX_DENY_MANUAL} (${MANUAL_COUNT} entradas)"
  else
    if [[ "${ENV}" == "audit" ]]; then
      _warn "deny manual ausente: ${NGINX_DENY_MANUAL} (opcional en AUDIT; sin bloqueos manuales activos)"
    else
      _ok "deny manual ausente: ${NGINX_DENY_MANUAL} (esperado — TEST en DRY_RUN=1)"
    fi
  fi
}

# ---------------------------------------------------------------------------
# Rule 9: Timer next execution
# ---------------------------------------------------------------------------
check_timer_next() {
  echo ""
  echo "--- [9] Timer: proxima ejecucion ---"

  TIMER_LINE=$(systemctl list-timers --all 2>/dev/null \
    | grep "${BLOCKER_TIMER}" || true)

  if [[ -n "${TIMER_LINE}" ]]; then
    echo "  ${TIMER_LINE}"
    _ok "timer presente en systemctl list-timers"
  else
    _warn "timer no aparece en systemctl list-timers --all (verificar estado manualmente)"
  fi
}

# ---------------------------------------------------------------------------
# Rule 10: Recent journal entries
# ---------------------------------------------------------------------------
check_journal() {
  echo ""
  echo "--- [10] Journal: ultimas entradas de ${BLOCKER_SERVICE} ---"

  journalctl -u "${BLOCKER_SERVICE}" -n 20 --no-pager 2>/dev/null \
    || echo "  (sin entradas en journal, journalctl no disponible, o permisos insuficientes)"
}

# ---------------------------------------------------------------------------
# Final report
# ---------------------------------------------------------------------------
print_report() {
  echo ""
  echo "============================================================"
  echo "RESULTADO"
  echo "============================================================"

  if [[ ${#OK_MSGS[@]} -gt 0 ]]; then
    echo ""
    echo "OK:"
    for msg in "${OK_MSGS[@]}"; do
      echo "  - ${msg}"
    done
  fi

  if [[ ${#ERR_MSGS[@]} -gt 0 ]]; then
    echo ""
    echo "ERROR:"
    for msg in "${ERR_MSGS[@]}"; do
      echo "  - ${msg}"
    done
  fi

  if [[ ${#WARN_MSGS[@]} -gt 0 ]]; then
    echo ""
    echo "WARNING:"
    for msg in "${WARN_MSGS[@]}"; do
      echo "  - ${msg}"
    done
  fi

  echo ""
  echo "SUMMARY:"
  echo "  errors=${#ERR_MSGS[@]} warnings=${#WARN_MSGS[@]}"
  echo "============================================================"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
print_header

check_config
check_systemd
check_outputs
check_state_file
check_nginx_config
check_nginx_deny_files
check_timer_next
check_journal

print_report

if [[ ${#ERR_MSGS[@]} -gt 0 ]]; then
  exit 1
fi
exit 0