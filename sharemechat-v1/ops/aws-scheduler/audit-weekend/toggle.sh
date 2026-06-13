#!/usr/bin/env bash
# toggle.sh — Enable or disable all 4 AUDIT weekend schedules atomically.
# Uses the caller's default AWS profile (sharemechat-deployer typically).
#
# Usage:
#   ./toggle.sh enable    # State -> ENABLED  (next FRI 22:00 Madrid will fire)
#   ./toggle.sh disable   # State -> DISABLED
#   ./toggle.sh status    # show current State per schedule
#
# BEFORE enabling: notify Segpay (or any external counterparty whose webhooks/
# pings might fail when AUDIT is down on weekends) — see README.md.

set -euo pipefail

REGION="eu-central-1"
GROUP="sharemechat-audit-weekend"
SCHEDULES=(
  audit-weekend-stop-ec2
  audit-weekend-stop-rds
  audit-weekend-start-rds
  audit-weekend-start-ec2
)

cmd="${1:-status}"

case "${cmd}" in
  status)
    aws scheduler list-schedules --group-name "${GROUP}" --region "${REGION}" \
      --query "Schedules[].[Name,State]" --output table
    ;;
  enable|disable)
    target_state=$([ "${cmd}" = "enable" ] && echo ENABLED || echo DISABLED)
    for name in "${SCHEDULES[@]}"; do
      echo "[toggle.sh] ${name} -> ${target_state}…"
      # Need to round-trip the existing schedule because update-schedule requires
      # the full payload. Pull, mutate State, push back.
      payload=$(aws scheduler get-schedule \
        --name "${name}" --group-name "${GROUP}" --region "${REGION}" \
        --output json)
      mutated=$(echo "${payload}" | python -c "
import json, sys
d = json.load(sys.stdin)
out = {
  'Name': d['Name'],
  'GroupName': d['GroupName'],
  'ScheduleExpression': d['ScheduleExpression'],
  'ScheduleExpressionTimezone': d.get('ScheduleExpressionTimezone'),
  'State': '${target_state}',
  'FlexibleTimeWindow': d['FlexibleTimeWindow'],
  'Target': {
    'Arn': d['Target']['Arn'],
    'RoleArn': d['Target']['RoleArn'],
    'Input': d['Target'].get('Input'),
  },
}
out = {k:v for k,v in out.items() if v is not None}
out['Target'] = {k:v for k,v in out['Target'].items() if v is not None}
print(json.dumps(out))
")
      aws scheduler update-schedule --region "${REGION}" --cli-input-json "${mutated}" >/dev/null
      echo "  done."
    done
    echo
    aws scheduler list-schedules --group-name "${GROUP}" --region "${REGION}" \
      --query "Schedules[].[Name,State]" --output table
    ;;
  *)
    echo "usage: $0 enable|disable|status"
    exit 2
    ;;
esac
