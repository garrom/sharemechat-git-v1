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
CLASSIFIER_OUTPUT_ROOT="${CLASSIFIER_OUTPUT_ROOT:-/var/log/sharemechat-test-access-classifier}"
OUTPUT_ROOT="${OUTPUT_ROOT:-/var/log/sharemechat-test-access-reporter}"
SMTP_HOST="${SMTP_HOST:-}"
SMTP_PORT="${SMTP_PORT:-}"
SMTP_USERNAME="${SMTP_USERNAME:-}"
SMTP_PASSWORD="${SMTP_PASSWORD:-}"
SMTP_STARTTLS="${SMTP_STARTTLS:-}"
SMTP_TIMEOUT_SECONDS="${SMTP_TIMEOUT_SECONDS:-}"
EMAIL_FROM="${EMAIL_FROM:-}"
EMAIL_TO="${EMAIL_TO:-}"

mkdir -p "${OUTPUT_ROOT}"

exec "${PYTHON_BIN}" "${COMPONENT_ROOT}/lib/report_access.py" run \
  --classifier-output-root "${CLASSIFIER_OUTPUT_ROOT}" \
  --output-root "${OUTPUT_ROOT}" \
  --smtp-host "${SMTP_HOST}" \
  --smtp-port "${SMTP_PORT}" \
  --smtp-username "${SMTP_USERNAME}" \
  --smtp-password "${SMTP_PASSWORD}" \
  --smtp-starttls "${SMTP_STARTTLS}" \
  --smtp-timeout-seconds "${SMTP_TIMEOUT_SECONDS}" \
  --email-from "${EMAIL_FROM}" \
  --email-to "${EMAIL_TO}" \
  "$@"
