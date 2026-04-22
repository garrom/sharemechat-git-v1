#!/usr/bin/env python3
import argparse
import json
import smtplib
import sys
from collections import Counter
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path
from typing import List, Optional, Tuple


CLASSIFICATION_ORDER = {
    "CRITICA": 0,
    "MALICIOSA": 1,
    "SOSPECHOSA": 2,
    "NORMAL": 3,
}


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run")
    run.add_argument("--date")
    run.add_argument("--input")
    run.add_argument("--classifier-output-root", required=True)
    run.add_argument("--output-root", required=True)
    run.add_argument("--max-findings", type=int, default=20)
    run.add_argument("--send-email", action="store_true")
    run.add_argument("--smtp-host", default="")
    run.add_argument("--smtp-port", default="")
    run.add_argument("--smtp-username", default="")
    run.add_argument("--smtp-password", default="")
    run.add_argument("--smtp-starttls", default="")
    run.add_argument("--smtp-timeout-seconds", default="")
    run.add_argument("--email-from", default="")
    run.add_argument("--email-to", default="")

    args = parser.parse_args()
    if args.command == "run":
        return run_report(args)
    return 1


def run_report(args: argparse.Namespace) -> int:
    summary_path, day = resolve_summary_input(args.input, args.date, args.classifier_output_root)
    output_root = Path(args.output_root)
    output_root.mkdir(parents=True, exist_ok=True)

    rows = load_summary_rows(summary_path)
    report = build_report(day, rows, Path(args.classifier_output_root), args.max_findings)

    text_output = render_text_report(report)
    json_output = json.dumps(report, ensure_ascii=False, indent=2)

    report_txt_path = output_root / f"{day}.report.txt"
    report_json_path = output_root / f"{day}.report.json"

    report_txt_path.write_text(text_output + "\n", encoding="utf-8")
    report_json_path.write_text(json_output + "\n", encoding="utf-8")

    if args.send_email:
        send_report_email(
            day=day,
            text_output=text_output,
            report_txt_path=report_txt_path,
            report_json_path=report_json_path,
            smtp_host=args.smtp_host,
            smtp_port=args.smtp_port,
            smtp_username=args.smtp_username,
            smtp_password=args.smtp_password,
            smtp_starttls=args.smtp_starttls,
            smtp_timeout_seconds=args.smtp_timeout_seconds,
            email_from=args.email_from,
            email_to=args.email_to,
        )

    sys.stdout.write(text_output + "\n")
    return 0


def resolve_summary_input(input_value: Optional[str], date_value: Optional[str], classifier_output_root: str) -> Tuple[Path, str]:
    if input_value:
        path = Path(input_value)
        if not path.exists():
            raise SystemExit(f"Classifier summary not found: {path}")
        day = path.name.replace(".summary.jsonl", "")
        return path, day

    day = date_value or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    path = Path(classifier_output_root) / f"{day}.summary.jsonl"
    if not path.exists():
        raise SystemExit(f"Classifier summary not found: {path}")
    return path, day


def load_summary_rows(path: Path) -> List[dict]:
    rows: List[dict] = []
    with path.open("r", encoding="utf-8") as fh:
        for raw_line in fh:
            line = raw_line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def build_report(day: str, rows: List[dict], classifier_output_root: Path, max_findings: int) -> dict:
    counts = Counter(row.get("classification", "UNKNOWN") for row in rows)
    findings = [normalize_finding(row) for row in rows if row.get("classification") in {"CRITICA", "MALICIOSA", "SOSPECHOSA"}]
    findings.sort(key=finding_sort_key)
    findings = findings[:max_findings]

    table_path = classifier_output_root / f"{day}.table.txt"
    summary_path = classifier_output_root / f"{day}.summary.jsonl"

    return {
        "date": day,
        "ips_analyzed": len(rows),
        "classification_counts": {
            "CRITICA": counts.get("CRITICA", 0),
            "MALICIOSA": counts.get("MALICIOSA", 0),
            "SOSPECHOSA": counts.get("SOSPECHOSA", 0),
            "NORMAL": counts.get("NORMAL", 0),
        },
        "relevant_findings": findings,
        "sources": {
            "classifier_table": str(table_path),
            "classifier_summary": str(summary_path),
        },
    }


def normalize_finding(row: dict) -> dict:
    return {
        "ip": row.get("ip"),
        "classification": row.get("classification"),
        "score": int(row.get("score", 0)),
        "main_reason": row.get("main_reason") or "n/a",
        "recommended_action": row.get("recommended_action") or "n/a",
    }


def finding_sort_key(finding: dict) -> Tuple[int, int, str]:
    classification = str(finding.get("classification") or "NORMAL")
    return (
        CLASSIFICATION_ORDER.get(classification, 99),
        -int(finding.get("score", 0)),
        str(finding.get("ip") or ""),
    )


def render_text_report(report: dict) -> str:
    lines: List[str] = []
    lines.append(f"TEST access summary - {report['date']}")
    lines.append("")
    lines.append(f"IPs analizadas: {report['ips_analyzed']}")
    lines.append("")

    counts = report["classification_counts"]
    lines.append(f"CRITICA: {counts['CRITICA']}")
    lines.append(f"MALICIOSA: {counts['MALICIOSA']}")
    lines.append(f"SOSPECHOSA: {counts['SOSPECHOSA']}")
    lines.append(f"NORMAL: {counts['NORMAL']}")
    lines.append("")

    findings = report["relevant_findings"]
    if findings:
        lines.append("Hallazgos principales:")
        for finding in findings:
            lines.append(
                f"- {finding['ip']} | {finding['classification']} | "
                f"score={finding['score']} | {finding['main_reason']} | {finding['recommended_action']}"
            )
    else:
        lines.append("Hallazgos principales:")
        lines.append("- sin hallazgos no normales")

    lines.append("")
    lines.append("Fuentes:")
    lines.append(f"- {report['sources']['classifier_table']}")
    lines.append(f"- {report['sources']['classifier_summary']}")
    return "\n".join(lines)


def send_report_email(
    day: str,
    text_output: str,
    report_txt_path: Path,
    report_json_path: Path,
    smtp_host: str,
    smtp_port: str,
    smtp_username: str,
    smtp_password: str,
    smtp_starttls: str,
    smtp_timeout_seconds: str,
    email_from: str,
    email_to: str,
) -> None:
    missing = []
    if not smtp_host:
        missing.append("SMTP_HOST")
    if not smtp_port:
        missing.append("SMTP_PORT")
    if not email_from:
        missing.append("EMAIL_FROM")
    recipients = parse_recipients(email_to)
    if not recipients:
        missing.append("EMAIL_TO")
    if missing:
        raise SystemExit(f"Missing SMTP config for --send-email: {', '.join(missing)}")

    port = parse_port(smtp_port)
    timeout_seconds = parse_timeout(smtp_timeout_seconds)
    use_starttls = parse_bool(smtp_starttls, default=True)

    message = EmailMessage()
    message["Subject"] = f"TEST access summary - {day}"
    message["From"] = email_from
    message["To"] = ", ".join(recipients)
    message.set_content(text_output + "\n")

    message.add_attachment(
        report_txt_path.read_bytes(),
        maintype="text",
        subtype="plain",
        filename=report_txt_path.name,
    )
    message.add_attachment(
        report_json_path.read_bytes(),
        maintype="application",
        subtype="json",
        filename=report_json_path.name,
    )

    try:
        with smtplib.SMTP(smtp_host, port, timeout=timeout_seconds) as smtp:
            smtp.ehlo()
            if use_starttls:
                smtp.starttls()
                smtp.ehlo()
            if smtp_username:
                smtp.login(smtp_username, smtp_password)
            smtp.send_message(message)
    except Exception as exc:
        raise SystemExit(f"SMTP send failed: {exc}") from exc


def parse_recipients(value: str) -> List[str]:
    recipients = []
    for part in value.replace(";", ",").split(","):
        item = part.strip()
        if item:
            recipients.append(item)
    return recipients


def parse_port(value: str) -> int:
    try:
        port = int(value)
    except ValueError as exc:
        raise SystemExit(f"Invalid SMTP_PORT value: {value}") from exc
    if port <= 0:
        raise SystemExit(f"Invalid SMTP_PORT value: {value}")
    return port


def parse_timeout(value: str) -> int:
    if not value:
        return 30
    try:
        timeout_seconds = int(value)
    except ValueError as exc:
        raise SystemExit(f"Invalid SMTP_TIMEOUT_SECONDS value: {value}") from exc
    if timeout_seconds <= 0:
        raise SystemExit(f"Invalid SMTP_TIMEOUT_SECONDS value: {value}")
    return timeout_seconds


def parse_bool(value: str, default: bool) -> bool:
    if not value:
        return default
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise SystemExit(f"Invalid SMTP_STARTTLS value: {value}")


if __name__ == "__main__":
    sys.exit(main())
