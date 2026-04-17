#!/usr/bin/env python3
import argparse
import gzip
import hashlib
import json
import re
import shutil
import stat
import subprocess
import sys
import tempfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional
from urllib.parse import unquote, urlsplit


STATE_FILE = "state.json"


NGINX_COMBINED_RE = re.compile(
    r'^(?P<remote_addr>\S+) \S+ \S+ \[(?P<ts>[^\]]+)\] '
    r'"(?P<method>[A-Z]+) (?P<target>[^"]*?) (?P<protocol>HTTP/\d\.\d)" '
    r'(?P<status>\d{3}) \S+ "(?P<referer>[^"]*)" "(?P<ua>[^"]*)"'
    r'(?: "(?P<xff>[^"]*)")?$'
)

NGINX_VHOST_COMBINED_RE = re.compile(
    r'^(?P<host>\S+) (?P<remote_addr>\S+) \S+ \S+ \[(?P<ts>[^\]]+)\] '
    r'"(?P<method>[A-Z]+) (?P<target>[^"]*?) (?P<protocol>HTTP/\d\.\d)" '
    r'(?P<status>\d{3}) \S+ "(?P<referer>[^"]*)" "(?P<ua>[^"]*)"'
    r'(?: "(?P<xff>[^"]*)")?$'
)


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run")
    run.add_argument("--aws-bin", required=True)
    run.add_argument("--work-root", required=True)
    run.add_argument("--state-root", required=True)
    run.add_argument("--tmp-root", required=True)
    run.add_argument("--chunk-root", required=True)
    run.add_argument("--output-root", required=True)
    run.add_argument("--cf-bucket", required=True)
    run.add_argument("--cf-prefix", action="append", default=[])
    run.add_argument("--nginx-log", required=True)

    args = parser.parse_args()
    if args.command == "run":
        return run_normalizer(args)
    return 1


def run_normalizer(args: argparse.Namespace) -> int:
    state_root = Path(args.state_root)
    tmp_root = Path(args.tmp_root)
    chunk_root = Path(args.chunk_root)
    output_root = Path(args.output_root)
    for path in (state_root, tmp_root, chunk_root, output_root):
        path.mkdir(parents=True, exist_ok=True)

    state = load_state(state_root / STATE_FILE)
    state.setdefault("cloudfront", {})
    state.setdefault("nginx", {})

    touched_days = set()

    for prefix in args.cf_prefix:
        touched_days.update(
            process_cloudfront_prefix(
                aws_bin=args.aws_bin,
                bucket=args.cf_bucket,
                prefix=prefix,
                state=state,
                state_root=state_root,
                tmp_root=tmp_root,
                chunk_root=chunk_root,
            )
        )

    touched_days.update(
        process_nginx_log(
            nginx_log=Path(args.nginx_log),
            state=state,
            state_root=state_root,
            chunk_root=chunk_root,
        )
    )

    save_state(state_root / STATE_FILE, state)

    for day in sorted(touched_days):
        rebuild_daily_file(chunk_root, output_root, day)

    return 0


def load_state(path: Path) -> dict:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def save_state(path: Path, state: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(".tmp")
    with tmp_path.open("w", encoding="utf-8") as fh:
        json.dump(state, fh, indent=2, sort_keys=True)
    tmp_path.replace(path)


def process_cloudfront_prefix(
    aws_bin: str,
    bucket: str,
    prefix: str,
    state: dict,
    state_root: Path,
    tmp_root: Path,
    chunk_root: Path,
) -> Iterable[str]:
    touched_days = set()
    prefix_state = state["cloudfront"].setdefault(prefix, {})

    for key in list_s3_keys(aws_bin, bucket, prefix):
        source_id = sha1_hex(f"s3://{bucket}/{key}")
        marker_path = state_root / "processed" / "cloudfront" / f"{source_id}.json"
        if marker_path.exists():
            continue

        events_by_day = parse_cloudfront_object(aws_bin, bucket, key, tmp_root)
        write_day_chunks(events_by_day, chunk_root, source_id)
        write_marker(
            marker_path,
            {
                "source": "cloudfront",
                "bucket": bucket,
                "key": key,
                "days": sorted(events_by_day.keys()),
                "processed_at": utc_now_iso(),
            },
        )
        touched_days.update(events_by_day.keys())

    prefix_state["last_scan_completed_at"] = utc_now_iso()

    return touched_days


def list_s3_keys(aws_bin: str, bucket: str, prefix: str) -> List[str]:
    cmd = [
        aws_bin,
        "s3api",
        "list-objects-v2",
        "--bucket",
        bucket,
        "--prefix",
        prefix,
        "--output",
        "json",
    ]

    keys: List[str] = []
    continuation = None
    while True:
        page_cmd = list(cmd)
        if continuation:
            page_cmd.extend(["--continuation-token", continuation])

        completed = subprocess.run(
            page_cmd,
            check=True,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        data = json.loads(completed.stdout or "{}")
        for item in data.get("Contents", []):
            key = item.get("Key")
            if key:
                keys.append(key)

        continuation = data.get("NextContinuationToken")
        if not data.get("IsTruncated"):
            break

    keys.sort()
    return keys


def parse_cloudfront_object(
    aws_bin: str,
    bucket: str,
    key: str,
    tmp_root: Path,
) -> Dict[str, List[dict]]:
    tmp_root.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=tmp_root, suffix=".gz", delete=False) as tmp_file:
        tmp_path = Path(tmp_file.name)

    try:
        subprocess.run(
            [aws_bin, "s3", "cp", f"s3://{bucket}/{key}", str(tmp_path)],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        events_by_day: Dict[str, List[dict]] = defaultdict(list)
        fields: List[str] = []
        with gzip.open(tmp_path, "rt", encoding="utf-8", errors="replace") as fh:
            for raw_line in fh:
                line = raw_line.rstrip("\n")
                if not line:
                    continue
                if line.startswith("#Fields:"):
                    fields = line.split(":", 1)[1].strip().split()
                    continue
                if line.startswith("#"):
                    continue
                if not fields:
                    raise RuntimeError(f"CloudFront log without #Fields header: s3://{bucket}/{key}")

                parts = line.split("\t")
                row = {fields[i]: parts[i] if i < len(parts) else "-" for i in range(len(fields))}
                event = normalize_cloudfront_row(bucket, key, row)
                events_by_day[event["ts"][:10]].append(event)

        return events_by_day
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


def normalize_cloudfront_row(bucket: str, key: str, row: dict) -> dict:
    ts = combine_cloudfront_ts(row.get("date"), row.get("time"))
    host = clean_value(row.get("x-host-header")) or clean_value(row.get("cs(Host)"))
    edge_host = clean_value(row.get("cs(Host)"))
    route = clean_value(row.get("cs-uri-stem")) or "/"
    query = clean_value(row.get("cs-uri-query"))
    referer = decode_log_value(clean_value(row.get("cs(Referer)")))
    ua = decode_log_value(clean_value(row.get("cs(User-Agent)")))
    xff = clean_value(row.get("x-forwarded-for"))
    ip = clean_value(row.get("c-ip"))

    event = {
        "ts": ts,
        "source": "cloudfront",
        "channel": classify_channel(host, route),
        "ip": ip,
        "host": host,
        "method": clean_value(row.get("cs-method")),
        "route": route,
        "status": clean_value(row.get("sc-status")),
        "ua": ua,
        "query": None if query in (None, "") else decode_log_value(query),
        "referer": referer,
        "xff": None if xff in (None, "") else xff,
        "raw_source": f"s3://{bucket}/{key}",
        "notes": None if not edge_host or edge_host == host else f"edge_host={edge_host}",
    }
    return event


def process_nginx_log(
    nginx_log: Path,
    state: dict,
    state_root: Path,
    chunk_root: Path,
) -> Iterable[str]:
    touched_days = set()
    if not nginx_log.exists():
        return touched_days

    file_stat = nginx_log.stat()
    if not stat.S_ISREG(file_stat.st_mode):
        return touched_days

    nginx_state = state["nginx"].setdefault("access_log", {})
    previous_inode = nginx_state.get("inode")
    previous_offset = int(nginx_state.get("offset", 0))

    current_inode = int(file_stat.st_ino)
    current_size = int(file_stat.st_size)

    if previous_inode == current_inode and current_size >= previous_offset:
        start_offset = previous_offset
    else:
        start_offset = 0

    end_offset = current_size
    if end_offset <= start_offset:
        nginx_state["inode"] = current_inode
        nginx_state["offset"] = end_offset
        return touched_days

    source_id = sha1_hex(f"{nginx_log}:{current_inode}:{start_offset}:{end_offset}")
    marker_path = state_root / "processed" / "nginx" / f"{source_id}.json"
    if marker_path.exists():
        nginx_state["inode"] = current_inode
        nginx_state["offset"] = end_offset
        return touched_days

    events_by_day: Dict[str, List[dict]] = defaultdict(list)
    with nginx_log.open("r", encoding="utf-8", errors="replace") as fh:
        fh.seek(start_offset)
        for raw_line in fh:
            line = raw_line.rstrip("\n")
            if not line:
                continue
            event = normalize_nginx_line(nginx_log, line)
            if event is None:
                continue
            events_by_day[event["ts"][:10]].append(event)

    write_day_chunks(events_by_day, chunk_root, source_id)
    write_marker(
        marker_path,
        {
            "source": "nginx",
            "log_path": str(nginx_log),
            "inode": current_inode,
            "start_offset": start_offset,
            "end_offset": end_offset,
            "days": sorted(events_by_day.keys()),
            "processed_at": utc_now_iso(),
        },
    )

    nginx_state["inode"] = current_inode
    nginx_state["offset"] = end_offset
    touched_days.update(events_by_day.keys())
    return touched_days


def normalize_nginx_line(nginx_log: Path, line: str) -> Optional[dict]:
    match = NGINX_VHOST_COMBINED_RE.match(line)
    host = None
    if match:
        host = clean_value(match.group("host"))
    else:
        match = NGINX_COMBINED_RE.match(line)
    if not match:
        return None

    target = match.group("target")
    split = urlsplit(target)
    route = split.path or "/"
    query = split.query or None
    xff = clean_value(match.groupdict().get("xff"))
    remote_addr = clean_value(match.group("remote_addr"))

    event = {
        "ts": parse_nginx_ts(match.group("ts")),
        "source": "nginx",
        "channel": classify_channel(host, route),
        "ip": first_ip_from_xff(xff) or remote_addr,
        "host": host,
        "method": clean_value(match.group("method")),
        "route": route,
        "status": clean_value(match.group("status")),
        "ua": clean_value(match.group("ua")),
        "query": query,
        "referer": clean_value(match.group("referer")),
        "xff": xff,
        "raw_source": str(nginx_log),
        "notes": None if host else "host_not_present_in_nginx_access_log",
    }
    return event


def write_day_chunks(events_by_day: Dict[str, List[dict]], chunk_root: Path, source_id: str) -> None:
    for day, events in events_by_day.items():
        day_dir = chunk_root / day
        day_dir.mkdir(parents=True, exist_ok=True)
        final_path = day_dir / f"{source_id}.jsonl"
        tmp_path = final_path.with_suffix(".tmp")
        with tmp_path.open("w", encoding="utf-8") as fh:
            for event in events:
                fh.write(json.dumps(strip_nulls(event), ensure_ascii=False, separators=(",", ":")) + "\n")
        tmp_path.replace(final_path)


def write_marker(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(".tmp")
    with tmp_path.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, sort_keys=True)
    tmp_path.replace(path)


def rebuild_daily_file(chunk_root: Path, output_root: Path, day: str) -> None:
    day_dir = chunk_root / day
    if not day_dir.exists():
        return

    output_root.mkdir(parents=True, exist_ok=True)
    final_path = output_root / f"{day}.jsonl"
    tmp_path = final_path.with_suffix(".tmp")

    events = []
    for chunk in sorted(day_dir.glob("*.jsonl")):
        with chunk.open("r", encoding="utf-8") as src:
            for line in src:
                line = line.strip()
                if not line:
                    continue
                events.append(json.loads(line))

    events.sort(
        key=lambda event: (
            event.get("ts", ""),
            event.get("source", ""),
            event.get("host", ""),
            event.get("route", ""),
            event.get("method", ""),
            event.get("status", ""),
            event.get("ip", ""),
            event.get("raw_source", ""),
        )
    )

    with tmp_path.open("w", encoding="utf-8") as out:
        for event in events:
            out.write(json.dumps(event, ensure_ascii=False, separators=(",", ":")) + "\n")
    tmp_path.replace(final_path)


def combine_cloudfront_ts(date_value: Optional[str], time_value: Optional[str]) -> str:
    if not date_value or not time_value:
        raise RuntimeError("CloudFront row without date/time")
    dt = datetime.strptime(f"{date_value} {time_value}", "%Y-%m-%d %H:%M:%S")
    dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


def parse_nginx_ts(value: str) -> str:
    dt = datetime.strptime(value, "%d/%b/%Y:%H:%M:%S %z")
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def classify_channel(host: Optional[str], route: Optional[str]) -> str:
    host = host or ""
    route = route or "/"
    if route in ("/match", "/messages"):
        return "REALTIME"
    if route.startswith("/api/admin/"):
        return "ADMIN"
    if host == "admin.audit.sharemechat.com":
        return "ADMIN"
    if route.startswith("/api/"):
        return "API"
    return "FRONTEND"


def clean_value(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    if value == "-":
        return None
    return value


def decode_log_value(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    return unquote(value)


def first_ip_from_xff(xff: Optional[str]) -> Optional[str]:
    if not xff:
        return None
    first = xff.split(",")[0].strip()
    return first or None


def strip_nulls(event: dict) -> dict:
    return {k: v for k, v in event.items() if v is not None}


def sha1_hex(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


if __name__ == "__main__":
    sys.exit(main())
