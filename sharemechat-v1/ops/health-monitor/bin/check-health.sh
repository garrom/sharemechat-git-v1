#!/usr/bin/env bash
# Observabilidad #5 — lanzador del vigilante de salud. Carga config.env (+ secrets.env
# adyacente) y ejecuta el python. La password SMTP se EXPORTA al entorno (no se pasa
# por argv -> no queda visible en ps).
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
SECRETS_FILE="$(dirname "${CONFIG_FILE}")/secrets.env"
# shellcheck disable=SC1090
[[ -f "${SECRETS_FILE}" ]] && source "${SECRETS_FILE}"

PYTHON_BIN="${PYTHON_BIN:-python3}"
HEALTH_URL="${HEALTH_URL:-http://localhost:8080/actuator/health}"
ENV_NAME="${ENV_NAME:-prod}"
STATE_FILE="${STATE_FILE:-/var/lib/sharemechat-health-monitor/state.json}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-5}"
REALERT_MINUTES="${REALERT_MINUTES:-120}"
SEND_EMAIL="${SEND_EMAIL:-false}"
SMTP_HOST="${SMTP_HOST:-}"
SMTP_PORT="${SMTP_PORT:-}"
SMTP_USERNAME="${SMTP_USERNAME:-}"
SMTP_STARTTLS="${SMTP_STARTTLS:-true}"
SMTP_TIMEOUT_SECONDS="${SMTP_TIMEOUT_SECONDS:-30}"
EMAIL_FROM="${EMAIL_FROM:-}"
EMAIL_TO="${EMAIL_TO:-}"

# La password se pasa al python por entorno, nunca por argv.
export SMTP_PASSWORD="${SMTP_PASSWORD:-}"

ARGS=(
  "${COMPONENT_ROOT}/lib/check_health.py"
  --health-url "${HEALTH_URL}"
  --env-name "${ENV_NAME}"
  --state-file "${STATE_FILE}"
  --timeout-seconds "${TIMEOUT_SECONDS}"
  --realert-minutes "${REALERT_MINUTES}"
  --smtp-host "${SMTP_HOST}"
  --smtp-port "${SMTP_PORT}"
  --smtp-username "${SMTP_USERNAME}"
  --smtp-starttls "${SMTP_STARTTLS}"
  --smtp-timeout-seconds "${SMTP_TIMEOUT_SECONDS}"
  --email-from "${EMAIL_FROM}"
  --email-to "${EMAIL_TO}"
)
if [[ "${SEND_EMAIL,,}" == "true" ]]; then
  ARGS+=(--send-email)
fi

exec "${PYTHON_BIN}" "${ARGS[@]}"
