#!/usr/bin/env python3
import argparse
import json
import math
import re
import sys
from collections import Counter
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple


CLASSIFICATION_NORMAL = "NORMAL"
CLASSIFICATION_SUSPICIOUS = "SOSPECHOSA"
CLASSIFICATION_MALICIOUS = "MALICIOSA"
CLASSIFICATION_CRITICAL = "CRITICA"

CLASSIFICATION_PRIORITY = {
    CLASSIFICATION_NORMAL: 0,
    CLASSIFICATION_SUSPICIOUS: 1,
    CLASSIFICATION_MALICIOUS: 2,
    CLASSIFICATION_CRITICAL: 3,
}

ACTION_BY_CLASSIFICATION = {
    CLASSIFICATION_NORMAL: "ninguna",
    CLASSIFICATION_SUSPICIOUS: "observar",
    CLASSIFICATION_MALICIOUS: "observar_o_bloquear",
    CLASSIFICATION_CRITICAL: "actuar",
}


@dataclass(frozen=True)
class PatternRule:
    pattern: re.Pattern[str]
    label: str
    base_weight: int
    repeat_weight: int = 0
    max_repeat_steps: int = 0
    min_classification: Optional[str] = None


@dataclass(frozen=True)
class PrefixRule:
    prefix: str
    label: str
    base_weight: int
    repeat_weight: int = 0
    max_repeat_steps: int = 0


HOSTILE_ROUTE_RULES: Sequence[PatternRule] = (
    PatternRule(re.compile(r"/xmlrpc\.php(?:$|/)", re.IGNORECASE), "xmlrpc_scan", 70, 6, 3),
    PatternRule(re.compile(r"/wlwmanifest\.xml(?:$|/)", re.IGNORECASE), "wlwmanifest_scan", 55, 5, 3),
    PatternRule(re.compile(r"/wp-(?:admin|includes|content)(?:$|/)", re.IGNORECASE), "wordpress_scan", 60, 6, 3),
    PatternRule(re.compile(r"/cgi-bin(?:$|/)", re.IGNORECASE), "cgi_bin_scan", 70, 6, 3),
    PatternRule(re.compile(r"/bin/sh(?:$|/)", re.IGNORECASE), "shell_probe", 95, 8, 3, CLASSIFICATION_CRITICAL),
    PatternRule(re.compile(r"(?:^|/)\.env(?:$|[/?])", re.IGNORECASE), "dotenv_probe", 70, 5, 3),
    PatternRule(re.compile(r"/vendor/phpunit(?:$|/)", re.IGNORECASE), "phpunit_probe", 75, 6, 3),
    PatternRule(re.compile(r"/boaform(?:$|/)", re.IGNORECASE), "router_probe", 75, 6, 3),
    PatternRule(re.compile(r"/actuator(?:$|/)", re.IGNORECASE), "actuator_probe", 45, 4, 2),
    PatternRule(re.compile(r"/phpmyadmin(?:$|/)", re.IGNORECASE), "phpmyadmin_probe", 60, 5, 3),
    PatternRule(re.compile(r"/server-status(?:$|/)", re.IGNORECASE), "server_status_probe", 55, 5, 2),
)

HOSTILE_QUERY_RULES: Sequence[PatternRule] = (
    PatternRule(re.compile(r"(?:^|[=&])(cmd|exec|query)=", re.IGNORECASE), "hostile_query", 35, 4, 3),
)

HOSTILE_UA_RULES: Sequence[PatternRule] = (
    PatternRule(re.compile(r"\bzgrab\b", re.IGNORECASE), "ua_zgrab", 75, 6, 2, CLASSIFICATION_MALICIOUS),
    PatternRule(re.compile(r"\bwget\b", re.IGNORECASE), "ua_wget", 18, 4, 2),
    PatternRule(re.compile(r"\bcurl\b", re.IGNORECASE), "ua_curl", 8, 2, 2),
    PatternRule(re.compile(r"\bpython-requests\b", re.IGNORECASE), "ua_python_requests", 10, 2, 2),
    PatternRule(re.compile(r"\bgo-http-client\b", re.IGNORECASE), "ua_go_http_client", 10, 2, 2),
    PatternRule(re.compile(r"\bsqlmap\b", re.IGNORECASE), "ua_sqlmap", 85, 6, 2, CLASSIFICATION_CRITICAL),
    PatternRule(re.compile(r"\bnikto\b", re.IGNORECASE), "ua_nikto", 80, 6, 2, CLASSIFICATION_MALICIOUS),
    PatternRule(re.compile(r"\bnmap\b", re.IGNORECASE), "ua_nmap", 70, 5, 2, CLASSIFICATION_MALICIOUS),
    PatternRule(re.compile(r"\bmasscan\b", re.IGNORECASE), "ua_masscan", 85, 6, 2, CLASSIFICATION_CRITICAL),
)

SENSITIVE_ROUTE_RULES: Sequence[PrefixRule] = (
    PrefixRule("/api/admin/", "admin_api_access", 10, 3, 3),
    PrefixRule("/api/auth/login", "product_login", 4, 1, 2),
    PrefixRule("/api/admin/auth/login", "admin_login", 6, 2, 2),
    PrefixRule("/api/auth/password/", "password_flow", 8, 2, 2),
    PrefixRule("/api/billing/", "billing_flow", 9, 2, 2),
    PrefixRule("/api/transactions/", "transaction_flow", 8, 2, 2),
    PrefixRule("/api/kyc/", "kyc_flow", 7, 2, 2),
    PrefixRule("/match", "match_flow", 4, 1, 2),
    PrefixRule("/messages", "messages_flow", 4, 1, 2),
)

COHERENT_FRONTEND_ROUTES = {"/", "/favicon.ico", "/manifest.json", "/robots.txt"}
COHERENT_API_ROUTES = {
    "/api/users/me",
    "/api/auth/login",
    "/api/auth/refresh",
    "/api/auth/logout",
    "/api/users/register/client",
    "/api/users/register/model",
    "/api/email-verification/resend",
}
COHERENT_ADMIN_ROUTES = {"/", "/api/admin/auth/login"}
STATIC_ROUTE_PREFIXES = ("/static/", "/assets/", "/favicon", "/images/", "/img/", "/css/", "/js/")

HOSTILE_RULE_INDEX = {
    rule.label: rule
    for rule in tuple(HOSTILE_ROUTE_RULES) + tuple(HOSTILE_QUERY_RULES) + tuple(HOSTILE_UA_RULES)
}
SENSITIVE_RULE_INDEX = {rule.label: rule for rule in SENSITIVE_ROUTE_RULES}


@dataclass
class ActivityGroup:
    ip: str
    date: str
    requests: int = 0
    routes: Counter = field(default_factory=Counter)
    hosts: Counter = field(default_factory=Counter)
    channels: Counter = field(default_factory=Counter)
    statuses: Counter = field(default_factory=Counter)
    methods: Counter = field(default_factory=Counter)
    uas: Counter = field(default_factory=Counter)
    hostile_hits: Counter = field(default_factory=Counter)
    sensitive_hits: Counter = field(default_factory=Counter)
    query_present: int = 0
    admin_requests: int = 0
    first_ts: Optional[str] = None
    last_ts: Optional[str] = None

    def register_event(self, event: dict) -> None:
        self.requests += 1
        route = str(event.get("route") or "/")
        host = str(event.get("host") or "unknown")
        channel = str(event.get("channel") or "UNKNOWN")
        status = str(event.get("status") or "unknown")
        method = str(event.get("method") or "unknown")
        ua = str(event.get("ua") or "unknown")
        ts = str(event.get("ts") or "")
        query = event.get("query")
        self.routes[route] += 1
        self.hosts[host] += 1
        self.channels[channel] += 1
        self.statuses[status] += 1
        self.methods[method] += 1
        self.uas[ua] += 1
        if query:
            self.query_present += 1
        if host == "admin.audit.sharemechat.com" or route.startswith("/api/admin/"):
            self.admin_requests += 1
        if self.first_ts is None or ts < self.first_ts:
            self.first_ts = ts
        if self.last_ts is None or ts > self.last_ts:
            self.last_ts = ts


@dataclass
class FeatureSet:
    date: str
    ip: str
    allowlisted: bool
    requests: int
    distinct_routes: int
    hosts: List[str]
    channels: List[str]
    host_counts: Dict[str, int]
    channel_counts: Dict[str, int]
    status_counts: Dict[str, int]
    method_counts: Dict[str, int]
    ua_counts: Dict[str, int]
    hostile_hits: Dict[str, int]
    sensitive_hits: Dict[str, int]
    admin_requests: int
    query_present: int
    query_ratio: float
    not_found_ratio: float
    unauthorized_ratio: float
    server_error_ratio: float
    zero_status_ratio: float
    dominant_ua: Optional[str]
    dominant_ua_count: int
    browser_like: bool
    non_browser_like: bool
    coherent_admin_flow: bool
    coherent_app_flow: bool
    static_frontend_flow: bool
    hostile_ioc_count: int
    sensitive_ioc_count: int
    first_ts: Optional[str]
    last_ts: Optional[str]


@dataclass
class RuleMatch:
    layer: str
    label: str
    points: int
    evidence: str


@dataclass
class Assessment:
    features: FeatureSet
    score: int
    matched_rules: List[RuleMatch]
    classification: str
    recommended_action: str
    main_reason: str
    evidence: Dict[str, object]


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    run = sub.add_parser("run")
    run.add_argument("--date")
    run.add_argument("--input")
    run.add_argument("--normalized-root", required=True)
    run.add_argument("--output-root", required=True)
    run.add_argument("--allowlist-file")
    run.add_argument("--allowlist-ips", default="")
    args = parser.parse_args()
    if args.command == "run":
        return run_classifier(args)
    return 1


def run_classifier(args: argparse.Namespace) -> int:
    input_path, day = resolve_input(args.input, args.date, args.normalized_root)
    output_root = Path(args.output_root)
    output_root.mkdir(parents=True, exist_ok=True)
    allowlisted_ips = load_allowlist(args.allowlist_file, args.allowlist_ips)
    groups = load_groups(input_path, day)
    assessments = [assess_group(group, allowlisted_ips) for group in groups.values()]
    rows = [assessment_to_row(assessment) for assessment in assessments]
    rows.sort(key=sort_key)
    summary_path = output_root / f"{day}.summary.jsonl"
    table_path = output_root / f"{day}.table.txt"
    write_summary(summary_path, rows)
    table = render_table(rows, day)
    table_path.write_text(table + "\n", encoding="utf-8")
    sys.stdout.write(table + "\n")
    return 0


def resolve_input(input_value: Optional[str], date_value: Optional[str], normalized_root_value: str) -> Tuple[Path, str]:
    if input_value:
        path = Path(input_value)
        if not path.exists():
            raise SystemExit(f"Input file not found: {path}")
        return path, path.stem
    day = date_value or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    path = Path(normalized_root_value) / f"{day}.jsonl"
    if not path.exists():
        raise SystemExit(f"Normalized JSONL not found: {path}")
    return path, day


def load_allowlist(file_value: Optional[str], ips_value: str) -> Set[str]:
    allowlisted: Set[str] = set()
    if ips_value:
        for value in ips_value.split(","):
            item = value.strip()
            if item:
                allowlisted.add(item)
    if file_value:
        path = Path(file_value)
        if path.exists():
            for raw_line in path.read_text(encoding="utf-8").splitlines():
                line = raw_line.strip()
                if not line or line.startswith("#"):
                    continue
                allowlisted.add(line)
    return allowlisted


def load_groups(path: Path, day: str) -> Dict[str, ActivityGroup]:
    groups: Dict[str, ActivityGroup] = {}
    with path.open("r", encoding="utf-8") as fh:
        for raw_line in fh:
            line = raw_line.strip()
            if not line:
                continue
            event = json.loads(line)
            ip = str(event.get("ip") or "").strip()
            if not ip:
                continue
            group = groups.setdefault(ip, ActivityGroup(ip=ip, date=day))
            group.register_event(event)
            inspect_event(group, event)
    return groups


def inspect_event(group: ActivityGroup, event: dict) -> None:
    route = str(event.get("route") or "/")
    query = str(event.get("query") or "")
    ua = str(event.get("ua") or "")
    for rule in HOSTILE_ROUTE_RULES:
        if rule.pattern.search(route):
            group.hostile_hits[rule.label] += 1
    if query:
        for rule in HOSTILE_QUERY_RULES:
            if rule.pattern.search(query):
                group.hostile_hits[rule.label] += 1
    for rule in HOSTILE_UA_RULES:
        if rule.pattern.search(ua):
            group.hostile_hits[rule.label] += 1
    for rule in SENSITIVE_ROUTE_RULES:
        if route.startswith(rule.prefix):
            group.sensitive_hits[rule.label] += 1


def assess_group(group: ActivityGroup, allowlisted_ips: Set[str]) -> Assessment:
    features = extract_features(group, group.ip in allowlisted_ips)
    deterministic = deterministic_assess(features)
    # Future extension point:
    # ai_assessment = ai_assess(features)
    # final = merge_assessments(deterministic, ai_assessment)
    return deterministic


def extract_features(group: ActivityGroup, allowlisted: bool) -> FeatureSet:
    requests = group.requests or 1
    dominant_ua, dominant_ua_count = most_common(group.uas)
    coherent_admin = looks_like_admin_flow(group)
    coherent_app = looks_like_app_flow(group)
    static_frontend = looks_like_static_frontend(group)
    not_found_count = group.statuses.get("404", 0)
    unauthorized_count = group.statuses.get("401", 0) + group.statuses.get("403", 0)
    server_error_count = sum(count for status, count in group.statuses.items() if status.startswith("5"))
    zero_status_count = group.statuses.get("000", 0)
    return FeatureSet(
        date=group.date,
        ip=group.ip,
        allowlisted=allowlisted,
        requests=group.requests,
        distinct_routes=len(group.routes),
        hosts=sorted(group.hosts.keys()),
        channels=sorted(group.channels.keys()),
        host_counts=dict(group.hosts),
        channel_counts=dict(group.channels),
        status_counts=dict(group.statuses),
        method_counts=dict(group.methods),
        ua_counts=dict(group.uas),
        hostile_hits=dict(group.hostile_hits),
        sensitive_hits=dict(group.sensitive_hits),
        admin_requests=group.admin_requests,
        query_present=group.query_present,
        query_ratio=round(group.query_present / requests, 4),
        not_found_ratio=round(not_found_count / requests, 4),
        unauthorized_ratio=round(unauthorized_count / requests, 4),
        server_error_ratio=round(server_error_count / requests, 4),
        zero_status_ratio=round(zero_status_count / requests, 4),
        dominant_ua=dominant_ua,
        dominant_ua_count=dominant_ua_count,
        browser_like=is_browser_ua(dominant_ua or ""),
        non_browser_like=bool(dominant_ua) and not is_browser_ua(dominant_ua),
        coherent_admin_flow=coherent_admin,
        coherent_app_flow=coherent_app,
        static_frontend_flow=static_frontend,
        hostile_ioc_count=sum(group.hostile_hits.values()),
        sensitive_ioc_count=sum(group.sensitive_hits.values()),
        first_ts=group.first_ts,
        last_ts=group.last_ts,
    )


def deterministic_assess(features: FeatureSet) -> Assessment:
    score = 0
    matched_rules: List[RuleMatch] = []
    classification_floor = CLASSIFICATION_NORMAL
    score, matched_rules = apply_allowlist_rule(features, score, matched_rules)
    score, matched_rules, classification_floor = apply_hostile_rules(features, score, matched_rules, classification_floor)
    score, matched_rules = apply_sensitive_rules(features, score, matched_rules)
    score, matched_rules, classification_floor = apply_override_rules(features, score, matched_rules, classification_floor)
    score, matched_rules = apply_volume_rules(features, score, matched_rules)
    score, matched_rules = apply_status_rules(features, score, matched_rules)
    score, matched_rules = apply_behavior_rules(features, score, matched_rules)
    score, matched_rules = apply_coherence_rules(features, score, matched_rules)
    if score < 0:
        score = 0
    classification = classify_score(score, classification_floor)
    recommended_action = ACTION_BY_CLASSIFICATION[classification]
    main_reason = build_main_reason(matched_rules, classification)
    evidence = build_evidence(features, matched_rules)
    return Assessment(
        features=features,
        score=score,
        matched_rules=matched_rules,
        classification=classification,
        recommended_action=recommended_action,
        main_reason=main_reason,
        evidence=evidence,
    )


def apply_allowlist_rule(features: FeatureSet, score: int, matched_rules: List[RuleMatch]) -> Tuple[int, List[RuleMatch]]:
    if features.allowlisted:
        score -= 30
        matched_rules.append(RuleMatch("scoring", "allowlist", -30, "allowlisted_ip"))
    return score, matched_rules


def apply_hostile_rules(
    features: FeatureSet,
    score: int,
    matched_rules: List[RuleMatch],
    classification_floor: str,
) -> Tuple[int, List[RuleMatch], str]:
    for label, count in sorted(features.hostile_hits.items()):
        rule = HOSTILE_RULE_INDEX[label]
        points = scaled_points(rule.base_weight, count, rule.repeat_weight, rule.max_repeat_steps)
        score += points
        matched_rules.append(RuleMatch("hostile", label, points, f"count={count}"))
        if rule.min_classification:
            classification_floor = max_classification(classification_floor, rule.min_classification)
    return score, matched_rules, classification_floor


def apply_sensitive_rules(features: FeatureSet, score: int, matched_rules: List[RuleMatch]) -> Tuple[int, List[RuleMatch]]:
    for label, count in sorted(features.sensitive_hits.items()):
        rule = SENSITIVE_RULE_INDEX[label]
        points = scaled_points(rule.base_weight, count, rule.repeat_weight, rule.max_repeat_steps)
        score += points
        matched_rules.append(RuleMatch("sensitive", label, points, f"count={count}"))
    return score, matched_rules


def apply_override_rules(
    features: FeatureSet,
    score: int,
    matched_rules: List[RuleMatch],
    classification_floor: str,
) -> Tuple[int, List[RuleMatch], str]:
    has_hostile = features.hostile_ioc_count > 0
    has_sensitive_admin = features.sensitive_hits.get("admin_api_access", 0) > 0 or features.sensitive_hits.get("admin_login", 0) > 0
    has_sensitive_api = any(
        features.sensitive_hits.get(label, 0) > 0
        for label in ("billing_flow", "transaction_flow", "kyc_flow", "password_flow", "product_login")
    )
    if has_hostile and has_sensitive_admin:
        classification_floor = max_classification(classification_floor, CLASSIFICATION_CRITICAL)
        matched_rules.append(RuleMatch("override", "hostile_plus_admin_sensitive", 0, "floor=CRITICA"))
    elif has_hostile and has_sensitive_api:
        classification_floor = max_classification(classification_floor, CLASSIFICATION_MALICIOUS)
        matched_rules.append(RuleMatch("override", "hostile_plus_api_sensitive", 0, "floor=MALICIOSA"))
    return score, matched_rules, classification_floor


def apply_volume_rules(features: FeatureSet, score: int, matched_rules: List[RuleMatch]) -> Tuple[int, List[RuleMatch]]:
    if features.requests >= 500:
        score += 35
        matched_rules.append(RuleMatch("volume", "request_burst_500", 35, f"requests={features.requests}"))
    elif features.requests >= 200:
        score += 25
        matched_rules.append(RuleMatch("volume", "request_burst_200", 25, f"requests={features.requests}"))
    elif features.requests >= 80:
        score += 15
        matched_rules.append(RuleMatch("volume", "request_burst_80", 15, f"requests={features.requests}"))
    if features.distinct_routes >= 25:
        score += 25
        matched_rules.append(RuleMatch("volume", "many_routes_25", 25, f"distinct_routes={features.distinct_routes}"))
    elif features.distinct_routes >= 12:
        score += 15
        matched_rules.append(RuleMatch("volume", "many_routes_12", 15, f"distinct_routes={features.distinct_routes}"))
    elif features.distinct_routes >= 6:
        score += 8
        matched_rules.append(RuleMatch("volume", "many_routes_6", 8, f"distinct_routes={features.distinct_routes}"))
    if len(features.hosts) > 1:
        score += 10
        matched_rules.append(RuleMatch("volume", "multi_host", 10, f"hosts={len(features.hosts)}"))
    if len(features.channels) > 2:
        score += 8
        matched_rules.append(RuleMatch("volume", "multi_channel", 8, f"channels={len(features.channels)}"))
    return score, matched_rules


def apply_status_rules(features: FeatureSet, score: int, matched_rules: List[RuleMatch]) -> Tuple[int, List[RuleMatch]]:
    not_found = features.status_counts.get("404", 0)
    server_errors = sum(count for status, count in features.status_counts.items() if status.startswith("5"))
    unauthorized = features.status_counts.get("401", 0) + features.status_counts.get("403", 0)
    zero_status = features.status_counts.get("000", 0)
    if not_found >= 8 and features.not_found_ratio >= 0.5:
        score += 25
        matched_rules.append(RuleMatch("status", "high_404_ratio", 25, f"count={not_found};ratio={features.not_found_ratio}"))
    elif not_found >= 4 and features.not_found_ratio >= 0.4:
        score += 15
        matched_rules.append(RuleMatch("status", "moderate_404_ratio", 15, f"count={not_found};ratio={features.not_found_ratio}"))
    if server_errors >= 3:
        score += 12
        matched_rules.append(RuleMatch("status", "server_errors", 12, f"count={server_errors}"))
    if unauthorized >= 6:
        score += 12
        matched_rules.append(RuleMatch("status", "auth_failures", 12, f"count={unauthorized}"))
    if zero_status >= 3:
        score += 12
        matched_rules.append(RuleMatch("status", "zero_status", 12, f"count={zero_status};ratio={features.zero_status_ratio}"))
    return score, matched_rules


def apply_behavior_rules(features: FeatureSet, score: int, matched_rules: List[RuleMatch]) -> Tuple[int, List[RuleMatch]]:
    if features.admin_requests >= 3 and features.hostile_ioc_count > 0:
        score += 20
        matched_rules.append(RuleMatch("behavior", "admin_plus_hostile", 20, f"admin_requests={features.admin_requests}"))
    if features.query_present >= 5 and features.distinct_routes >= 5:
        score += 10
        matched_rules.append(RuleMatch("behavior", "query_heavy", 10, f"query_present={features.query_present}"))
    dominant_ua = (features.dominant_ua or "").lower()
    if dominant_ua in {"-", "unknown"} and features.requests >= 10:
        score += 8
        matched_rules.append(RuleMatch("behavior", "unknown_ua", 8, f"requests={features.requests}"))
    if features.non_browser_like and features.dominant_ua_count >= 20 and features.distinct_routes >= 10:
        matched_rules.append(
            RuleMatch(
                "behavior",
                "non_browser_scanner_pattern",
                12,
                f"dominant_ua_count={features.dominant_ua_count};distinct_routes={features.distinct_routes}",
            )
        )
        score += 12
    return score, matched_rules


def apply_coherence_rules(features: FeatureSet, score: int, matched_rules: List[RuleMatch]) -> Tuple[int, List[RuleMatch]]:
    if features.hostile_ioc_count > 0:
        return score, matched_rules
    if features.coherent_admin_flow:
        score -= 10
        matched_rules.append(RuleMatch("coherence", "admin_flow_coherente", -10, "coherent_admin_flow"))
    elif features.coherent_app_flow:
        score -= 8
        matched_rules.append(RuleMatch("coherence", "app_flow_coherente", -8, "coherent_app_flow"))
    elif features.static_frontend_flow:
        score -= 5
        matched_rules.append(RuleMatch("coherence", "frontend_basico", -5, "static_frontend_flow"))
    return score, matched_rules


def scaled_points(base_weight: int, count: int, repeat_weight: int, max_repeat_steps: int) -> int:
    if count <= 0:
        return 0
    repeat_steps = 0
    if count > 1 and repeat_weight > 0 and max_repeat_steps > 0:
        repeat_steps = min(int(math.log2(count)), max_repeat_steps)
    return base_weight + (repeat_steps * repeat_weight)


def classify_score(score: int, classification_floor: str) -> str:
    if score >= 100:
        raw = CLASSIFICATION_CRITICAL
    elif score >= 60:
        raw = CLASSIFICATION_MALICIOUS
    elif score >= 20:
        raw = CLASSIFICATION_SUSPICIOUS
    else:
        raw = CLASSIFICATION_NORMAL
    return max_classification(raw, classification_floor)


def max_classification(left: str, right: str) -> str:
    return left if CLASSIFICATION_PRIORITY[left] >= CLASSIFICATION_PRIORITY[right] else right


def build_main_reason(matched_rules: Sequence[RuleMatch], classification: str) -> str:
    if not matched_rules:
        return "actividad_baja"
    positive = [rule for rule in matched_rules if rule.points > 0]
    negative = [rule for rule in matched_rules if rule.points < 0]
    if classification == CLASSIFICATION_NORMAL and negative:
        top_negative = sorted(negative, key=lambda item: item.points)[:2]
        return "+".join(rule.label for rule in top_negative)
    top_positive = sorted(positive, key=lambda item: (-item.points, item.label))[:2]
    if top_positive:
        return "+".join(rule.label for rule in top_positive)
    return matched_rules[0].label


def build_evidence(features: FeatureSet, matched_rules: Sequence[RuleMatch]) -> Dict[str, object]:
    route_counter = dict(features.hostile_hits)
    for label, count in features.sensitive_hits.items():
        route_counter[label] = route_counter.get(label, 0) + count
    return {
        "dominant_ua": features.dominant_ua,
        "top_statuses": top_counter_items(features.status_counts, 3),
        "top_route_signals": top_counter_items(route_counter, 5),
        "hostile_hits": top_counter_items(features.hostile_hits, 5),
        "sensitive_hits": top_counter_items(features.sensitive_hits, 5),
        "matched_rule_labels": [rule.label for rule in matched_rules[:8]],
        "time_window": {"first_ts": features.first_ts, "last_ts": features.last_ts},
    }


def assessment_to_row(assessment: Assessment) -> dict:
    features = assessment.features
    return {
        "date": features.date,
        "ip": features.ip,
        "classification": assessment.classification,
        "score": assessment.score,
        "requests": features.requests,
        "distinct_routes": features.distinct_routes,
        "hosts": features.hosts,
        "channels": features.channels,
        "main_reason": assessment.main_reason,
        "recommended_action": assessment.recommended_action,
        "features": asdict(features),
        "matched_rules": [asdict(rule) for rule in assessment.matched_rules],
        "evidence": assessment.evidence,
    }


def looks_like_admin_flow(group: ActivityGroup) -> bool:
    if "admin.audit.sharemechat.com" not in group.hosts:
        return False
    allowed = set(COHERENT_ADMIN_ROUTES)
    allowed.update(route for route in group.routes if is_static_route(route))
    return set(group.routes.keys()).issubset(allowed)


def looks_like_app_flow(group: ActivityGroup) -> bool:
    allowed = set(COHERENT_FRONTEND_ROUTES) | set(COHERENT_API_ROUTES)
    allowed.update(route for route in group.routes if is_static_route(route))
    return set(group.routes.keys()).issubset(allowed)


def looks_like_static_frontend(group: ActivityGroup) -> bool:
    return all(route in COHERENT_FRONTEND_ROUTES or is_static_route(route) for route in group.routes.keys())


def is_static_route(route: str) -> bool:
    return route in COHERENT_FRONTEND_ROUTES or any(route.startswith(prefix) for prefix in STATIC_ROUTE_PREFIXES)


def is_browser_ua(ua: str) -> bool:
    lower = ua.lower()
    return any(token in lower for token in ("mozilla/", "chrome/", "safari/", "firefox/", "edg/"))


def write_summary(path: Path, rows: Iterable[dict]) -> None:
    with path.open("w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")


def render_table(rows: Sequence[dict], day: str) -> str:
    if not rows:
        return f"{day} | sin actividad"
    headers = [
        "date",
        "ip",
        "classification",
        "score",
        "requests",
        "distinct_routes",
        "hosts",
        "channels",
        "main_reason",
        "recommended_action",
    ]
    formatted_rows: List[List[str]] = []
    for row in rows:
        formatted_rows.append(
            [
                str(row["date"]),
                str(row["ip"]),
                str(row["classification"]),
                str(row["score"]),
                str(row["requests"]),
                str(row["distinct_routes"]),
                truncate(",".join(row["hosts"]), 28),
                truncate(",".join(row["channels"]), 14),
                truncate(str(row["main_reason"]), 34),
                str(row["recommended_action"]),
            ]
        )
    widths = []
    for index, header in enumerate(headers):
        width = len(header)
        for row in formatted_rows:
            width = max(width, len(row[index]))
        widths.append(width)
    lines = [format_row(headers, widths), format_row(["-" * width for width in widths], widths)]
    for row in formatted_rows:
        lines.append(format_row(row, widths))
    return "\n".join(lines)


def format_row(values: Sequence[str], widths: Sequence[int]) -> str:
    return " | ".join(value.ljust(width) for value, width in zip(values, widths))


def truncate(value: str, limit: int) -> str:
    if len(value) <= limit:
        return value
    if limit <= 3:
        return value[:limit]
    return value[: limit - 3] + "..."


def top_counter_items(counter_like: Dict[str, int], limit: int) -> List[Dict[str, object]]:
    items = sorted(counter_like.items(), key=lambda item: (-item[1], item[0]))[:limit]
    return [{"key": key, "count": count} for key, count in items]


def sort_key(row: dict) -> Tuple[int, int, str]:
    priority = {
        CLASSIFICATION_CRITICAL: 0,
        CLASSIFICATION_MALICIOUS: 1,
        CLASSIFICATION_SUSPICIOUS: 2,
        CLASSIFICATION_NORMAL: 3,
    }
    return (priority[row["classification"]], -row["score"], row["ip"])


def most_common(counter: Counter) -> Tuple[Optional[str], int]:
    if not counter:
        return None, 0
    value, count = counter.most_common(1)[0]
    return value, count


if __name__ == "__main__":
    sys.exit(main())
