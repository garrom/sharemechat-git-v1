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

AWS_BIN="${AWS_BIN:-aws}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
WORK_ROOT="${WORK_ROOT:-/var/lib/sharemechat-audit-access-normalizer}"
STATE_ROOT="${STATE_ROOT:-${WORK_ROOT}/state}"
TMP_ROOT="${TMP_ROOT:-${WORK_ROOT}/tmp}"
CHUNK_ROOT="${CHUNK_ROOT:-${WORK_ROOT}/chunks}"
OUTPUT_ROOT="${OUTPUT_ROOT:-/var/log/sharemechat-audit-access-normalizer}"
LOCK_FILE="${LOCK_FILE:-${WORK_ROOT}/normalize.lock}"
NGINX_ACCESS_LOG="${NGINX_ACCESS_LOG:-/var/log/nginx/access.log}"
CF_BUCKET="${CF_BUCKET:-sharemechat-cf-logs-audit}"
CF_PREFIX_AUDIT="${CF_PREFIX_AUDIT:-cloudfront/audit/}"
CF_PREFIX_ADMIN="${CF_PREFIX_ADMIN:-cloudfront/admin-audit/}"

mkdir -p "${WORK_ROOT}" "${STATE_ROOT}" "${TMP_ROOT}" "${CHUNK_ROOT}" "${OUTPUT_ROOT}"

exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  echo "Another normalization run is already in progress." >&2
  exit 0
fi

exec "${PYTHON_BIN}" "${COMPONENT_ROOT}/lib/normalize_access.py" run \
  --aws-bin "${AWS_BIN}" \
  --work-root "${WORK_ROOT}" \
  --state-root "${STATE_ROOT}" \
  --tmp-root "${TMP_ROOT}" \
  --chunk-root "${CHUNK_ROOT}" \
  --output-root "${OUTPUT_ROOT}" \
  --cf-bucket "${CF_BUCKET}" \
  --cf-prefix "${CF_PREFIX_AUDIT}" \
  --cf-prefix "${CF_PREFIX_ADMIN}" \
  --nginx-log "${NGINX_ACCESS_LOG}" \
  "$@"
