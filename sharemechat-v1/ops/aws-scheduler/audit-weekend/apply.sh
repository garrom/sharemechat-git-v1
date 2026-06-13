#!/usr/bin/env bash
# apply.sh — Idempotent create/update of the AUDIT weekend schedule group + 4 schedules.
# Does NOT create the IAM role nor touch IAM. The role
# `sharemechat-scheduler-audit-role` must already exist (one-time bootstrap
# done with AWS_PROFILE=sharemechat-provisioner, see README.md).
#
# Day-to-day this script runs with the caller's default AWS profile (typically
# sharemechat-deployer, scoped to schedule-group/sharemechat-audit-weekend
# and PassRole limited to the scheduler role).
#
# All schedules are (re)created in State=DISABLED to match repo state. Use
# toggle.sh enable to activate, toggle.sh disable to deactivate.

set -euo pipefail

REGION="eu-central-1"
ACCOUNT_ID="430118829334"
GROUP="sharemechat-audit-weekend"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/sharemechat-scheduler-audit-role"
TZ_NAME="Europe/Madrid"
EC2_ID="i-0d9149cd8a0e24104"
RDS_ID="db1-sharemechat-audit"

echo "[apply.sh] caller identity:"
aws sts get-caller-identity --query "[Account,Arn]" --output text
echo

echo "[apply.sh] ensure schedule group ${GROUP} exists (idempotent)…"
if aws scheduler get-schedule-group --name "${GROUP}" --region "${REGION}" >/dev/null 2>&1; then
  echo "  group already exists."
else
  aws scheduler create-schedule-group \
    --name "${GROUP}" \
    --region "${REGION}" \
    --tags Key=Project,Value=sharemechat Key=Env,Value=audit Key=Frente,Value=audit-weekend-scheduler
  echo "  group created."
fi
echo

upsert_schedule() {
  local name="$1"; local cron="$2"; local target_arn="$3"; local input="$4"
  echo "[apply.sh] upsert schedule ${name} (cron=${cron}) DISABLED…"
  local payload
  payload=$(cat <<EOF
{
  "Name": "${name}",
  "GroupName": "${GROUP}",
  "ScheduleExpression": "${cron}",
  "ScheduleExpressionTimezone": "${TZ_NAME}",
  "State": "DISABLED",
  "FlexibleTimeWindow": {"Mode": "OFF"},
  "Target": {
    "Arn": "${target_arn}",
    "RoleArn": "${ROLE_ARN}",
    "Input": ${input}
  }
}
EOF
)
  if aws scheduler get-schedule --name "${name}" --group-name "${GROUP}" --region "${REGION}" >/dev/null 2>&1; then
    aws scheduler update-schedule --region "${REGION}" --cli-input-json "${payload}" >/dev/null
    echo "  updated."
  else
    aws scheduler create-schedule --region "${REGION}" --cli-input-json "${payload}" >/dev/null
    echo "  created."
  fi
}

# Inputs are JSON-encoded strings (Scheduler requires Input as a JSON string).
EC2_STOP_INPUT='"{\"InstanceIds\":[\"'"${EC2_ID}"'\"]}"'
EC2_START_INPUT='"{\"InstanceIds\":[\"'"${EC2_ID}"'\"]}"'
RDS_STOP_INPUT='"{\"DbInstanceIdentifier\":\"'"${RDS_ID}"'\"}"'
RDS_START_INPUT='"{\"DbInstanceIdentifier\":\"'"${RDS_ID}"'\"}"'

upsert_schedule "audit-weekend-stop-ec2"  "cron(0 22 ? * FRI *)"  "arn:aws:scheduler:::aws-sdk:ec2:stopInstances"   "${EC2_STOP_INPUT}"
upsert_schedule "audit-weekend-stop-rds"  "cron(20 22 ? * FRI *)" "arn:aws:scheduler:::aws-sdk:rds:stopDBInstance"  "${RDS_STOP_INPUT}"
upsert_schedule "audit-weekend-start-rds" "cron(0 7 ? * MON *)"   "arn:aws:scheduler:::aws-sdk:rds:startDBInstance" "${RDS_START_INPUT}"
upsert_schedule "audit-weekend-start-ec2" "cron(20 7 ? * MON *)"  "arn:aws:scheduler:::aws-sdk:ec2:startInstances"  "${EC2_START_INPUT}"

echo
echo "[apply.sh] final state:"
aws scheduler list-schedules --group-name "${GROUP}" --region "${REGION}" \
  --query "Schedules[].[Name,State]" --output table

echo
echo "[apply.sh] done. All schedules left in DISABLED. Use ./toggle.sh enable to activate."
