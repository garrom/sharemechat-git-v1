#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPONENT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

CONFIG_FILE="${COMPONENT_ROOT}/config/config.env"
if [[ $# -ge 2 && "$1" == "--config" ]]; then
  CONFIG_FILE="$2"
  shift 2
fi

if [[ ! -f "${CONFIG_FILE}" ]]; then
  echo "Config file not found: ${CONFIG_FILE}" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "${CONFIG_FILE}"

PYTHON_BIN="${PYTHON_BIN:-python3}"
WORK_ROOT="${WORK_ROOT:-/var/lib/sharemechat-audit-access-blocker}"
OUTPUT_ROOT="${OUTPUT_ROOT:-/var/log/sharemechat-audit-access-blocker}"
CLASSIFIER_OUTPUT_ROOT="${CLASSIFIER_OUTPUT_ROOT:-/var/log/sharemechat-audit-access-classifier}"
STATE_FILE="${STATE_FILE:-${WORK_ROOT}/ips.json}"
LOCK_FILE="${LOCK_FILE:-${WORK_ROOT}/block.lock}"
ALLOWLIST_FILE="${ALLOWLIST_FILE:-}"
ALLOWLIST_IPS="${ALLOWLIST_IPS:-}"
CARRIL_A_TTL_DAYS="${CARRIL_A_TTL_DAYS:-30}"
CARRIL_B_TTL_DAYS="${CARRIL_B_TTL_DAYS:-14}"
CARRIL_B_WINDOW_DAYS="${CARRIL_B_WINDOW_DAYS:-7}"
DRY_RUN="${DRY_RUN:-1}"
# Ruta del fichero live de nginx. Solo se usa en modo real (DRY_RUN=0).
NGINX_DENY_FILE="${NGINX_DENY_FILE:-/etc/nginx/deny-audit-ips.conf}"
# Fichero de bloqueos manuales (solo lectura). Si no existe, no falla.
# Sus entradas se preservan en el fichero live y sus IPs no se duplican.
NGINX_MANUAL_DENY_FILE="${NGINX_MANUAL_DENY_FILE:-/etc/nginx/deny-audit-ips.manual.conf}"

mkdir -p "${WORK_ROOT}" "${OUTPUT_ROOT}"

exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  echo "Another blocker run is already in progress." >&2
  exit 0
fi

# Validar DRY_RUN: solo se admiten "0" o "1".
if [[ "${DRY_RUN}" != "0" && "${DRY_RUN}" != "1" ]]; then
  echo "DRY_RUN debe ser 0 o 1 (valor actual: '${DRY_RUN}'). Abortando." >&2
  exit 2
fi

if [[ "${DRY_RUN}" == "1" ]]; then
  # Modo DRY-RUN: propuesta advisory, sin tocar nginx.
  exec "${PYTHON_BIN}" "${COMPONENT_ROOT}/lib/block_access.py" run \
    --classifier-output-root "${CLASSIFIER_OUTPUT_ROOT}" \
    --output-root "${OUTPUT_ROOT}" \
    --state-file "${STATE_FILE}" \
    --allowlist-file "${ALLOWLIST_FILE}" \
    --allowlist-ips "${ALLOWLIST_IPS}" \
    --carril-a-ttl-days "${CARRIL_A_TTL_DAYS}" \
    --carril-b-ttl-days "${CARRIL_B_TTL_DAYS}" \
    --carril-b-window-days "${CARRIL_B_WINDOW_DAYS}" \
    --dry-run \
    "$@"
else
  # Modo REAL (DRY_RUN=0): aplica bloqueo Carril A en nginx.
  # Carril B y Carril C siguen siendo solo propuesta.
  exec "${PYTHON_BIN}" "${COMPONENT_ROOT}/lib/block_access.py" run \
    --classifier-output-root "${CLASSIFIER_OUTPUT_ROOT}" \
    --output-root "${OUTPUT_ROOT}" \
    --state-file "${STATE_FILE}" \
    --allowlist-file "${ALLOWLIST_FILE}" \
    --allowlist-ips "${ALLOWLIST_IPS}" \
    --carril-a-ttl-days "${CARRIL_A_TTL_DAYS}" \
    --carril-b-ttl-days "${CARRIL_B_TTL_DAYS}" \
    --carril-b-window-days "${CARRIL_B_WINDOW_DAYS}" \
    --nginx-deny-file "${NGINX_DENY_FILE}" \
    --nginx-manual-deny-file "${NGINX_MANUAL_DENY_FILE}" \
    "$@"
fi
