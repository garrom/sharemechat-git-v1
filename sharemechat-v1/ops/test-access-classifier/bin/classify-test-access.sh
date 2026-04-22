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
WORK_ROOT="${WORK_ROOT:-/var/lib/sharemechat-test-access-classifier}"
OUTPUT_ROOT="${OUTPUT_ROOT:-/var/log/sharemechat-test-access-classifier}"
NORMALIZED_ROOT="${NORMALIZED_ROOT:-/var/log/sharemechat-test-access-normalizer}"
LOCK_FILE="${LOCK_FILE:-${WORK_ROOT}/classify.lock}"
ALLOWLIST_FILE="${ALLOWLIST_FILE:-}"
ALLOWLIST_IPS="${ALLOWLIST_IPS:-}"

mkdir -p "${WORK_ROOT}" "${OUTPUT_ROOT}"

exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  echo "Another classification run is already in progress." >&2
  exit 0
fi

exec "${PYTHON_BIN}" "${COMPONENT_ROOT}/lib/classify_access.py" run \
  --normalized-root "${NORMALIZED_ROOT}" \
  --output-root "${OUTPUT_ROOT}" \
  --allowlist-file "${ALLOWLIST_FILE}" \
  --allowlist-ips "${ALLOWLIST_IPS}" \
  "$@"
