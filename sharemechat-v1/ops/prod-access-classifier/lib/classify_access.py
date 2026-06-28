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
        if host == "admin.sharemechat.com" or route.startswith("/api/admin/"):
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
    # VEREDICTO (adicion 2026-06-12): bloque de cabecera con un veredicto
    # operativo (VERDE/AMARILLO/ROJO) calculado tras la clasificacion. Se
    # antepone al .table.txt y se anade como primera linea del
    # .summary.jsonl con clave "type": "verdict". NO altera ninguna fila
    # ni el scoring existente; solo agrega contexto operativo.
    verdict = compute_verdict(input_path, rows, allowlisted_ips, output_root, day)
    summary_path = output_root / f"{day}.summary.jsonl"
    table_path = output_root / f"{day}.table.txt"
    write_summary(summary_path, rows, verdict=verdict)
    table = render_table(rows, day)
    verdict_block = render_verdict_block(verdict)
    full_table = verdict_block + "\n\n" + table
    table_path.write_text(full_table + "\n", encoding="utf-8")
    sys.stdout.write(full_table + "\n")
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
    # Short-circuit por allowlist (paquete 10.B.4): si la IP esta en la lista
    # operativa (variable ALLOWLIST_IPS del config.env), se la trata como
    # NORMAL sin aplicar el resto de reglas. Evita que la actividad legitima
    # del operador (validacion manual del frontend admin, pruebas con muchas
    # rutas, ratios anomalos de 404/401 durante onboarding, etc.) acabe
    # marcada como CRITICA y sea propuesta al blocker para Carril A real.
    # El features completo se conserva en el summary.jsonl para que la
    # actividad siga siendo auditable; solo el scoring queda neutralizado.
    if features.allowlisted:
        matched_rules = [RuleMatch("scoring", "allowlist", 0, "allowlisted_ip")]
        return Assessment(
            features=features,
            score=0,
            matched_rules=matched_rules,
            classification=CLASSIFICATION_NORMAL,
            recommended_action=ACTION_BY_CLASSIFICATION[CLASSIFICATION_NORMAL],
            main_reason="allowlisted_ip",
            evidence={
                "allowlisted": True,
                "dominant_ua": features.dominant_ua,
                "requests": features.requests,
                "distinct_routes": features.distinct_routes,
                "time_window": {"first_ts": features.first_ts, "last_ts": features.last_ts},
            },
        )

    score = 0
    matched_rules: List[RuleMatch] = []
    classification_floor = CLASSIFICATION_NORMAL
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
    if "admin.sharemechat.com" not in group.hosts:
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


def write_summary(path: Path, rows: Iterable[dict], verdict: Optional[dict] = None) -> None:
    with path.open("w", encoding="utf-8") as fh:
        if verdict is not None:
            # Primera linea: verdicto operativo del dia (adicion 2026-06-12).
            # No interfiere con las filas siguientes porque trae "type":
            # "verdict"; los consumidores aguas abajo (reporter, scripts ad
            # hoc) pueden filtrar por ese campo.
            fh.write(json.dumps(verdict, ensure_ascii=False, separators=(",", ":")) + "\n")
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


# ============================================================================
# VEREDICTO operativo (adicion 2026-06-12)
# ============================================================================
# Filosofia: VERDE por defecto. El operador NO necesita actuar en un dia
# normal aunque haya muchas IPs MALICIOSA/CRITICA, porque lo normal es que
# todos los sondeos terminen en 404 (PROD no expone superficies hostiles
# reales). VERDE solo se rompe si: (a) un sondeo a una ruta sensible obtuvo
# exito (2xx/3xx), o (b) hay evidencia de auth abuse, o (c) volumen anomalo.
# AMARILLO para anomalias sin exito pero llamativas (pico estadistico, foco
# de sondeo en /api/* real, exito en ruta rara no-publica-conocida).

VERDICT_LEVEL_GREEN = "VERDE"
VERDICT_LEVEL_YELLOW = "AMARILLO"
VERDICT_LEVEL_RED = "ROJO"

VERDICT_LEVEL_PRIORITY = {
    VERDICT_LEVEL_GREEN: 0,
    VERDICT_LEVEL_YELLOW: 1,
    VERDICT_LEVEL_RED: 2,
}

VERDICT_LEVEL_LABEL = {
    VERDICT_LEVEL_GREEN: "SIN ACCION",
    VERDICT_LEVEL_YELLOW: "REVISAR",
    VERDICT_LEVEL_RED: "ACTUA",
}

VERDICT_LEVEL_ICON = {
    VERDICT_LEVEL_GREEN: "[V]",
    VERDICT_LEVEL_YELLOW: "[A]",
    VERDICT_LEVEL_RED: "[R]",
}

# Rutas en las que un 2xx/3xx desde una IP no-allowlisted es ROJO automatico.
# Cubre la lista minima propuesta por el operador (.env .git .aws actuator
# wp-admin wp-login xmlrpc.php cgi-bin vendor phpmyadmin config), ampliada
# con las rutas hostile internas que el classifier ya conocia para coherencia.
VERDICT_RED_ROUTE_PATTERNS: Tuple[re.Pattern[str], ...] = (
    re.compile(r"(?:^|/)\.env(?:$|[/?])", re.IGNORECASE),
    re.compile(r"(?:^|/)\.git(?:$|[/?])", re.IGNORECASE),
    re.compile(r"(?:^|/)\.aws(?:$|[/?])", re.IGNORECASE),
    re.compile(r"/actuator(?:$|/)", re.IGNORECASE),
    re.compile(r"/wp-admin(?:$|/)", re.IGNORECASE),
    re.compile(r"/wp-login(?:\.php)?(?:$|[/?])", re.IGNORECASE),
    re.compile(r"/wp-includes(?:$|/)", re.IGNORECASE),
    re.compile(r"/wp-content(?:$|/)", re.IGNORECASE),
    re.compile(r"/xmlrpc\.php(?:$|[/?])", re.IGNORECASE),
    re.compile(r"/cgi-bin(?:$|/)", re.IGNORECASE),
    re.compile(r"/vendor(?:$|/)", re.IGNORECASE),
    re.compile(r"/phpmyadmin(?:$|/)", re.IGNORECASE),
    re.compile(r"/config(?:$|[/?])", re.IGNORECASE),
    re.compile(r"/server-status(?:$|/)", re.IGNORECASE),
    re.compile(r"/boaform(?:$|/)", re.IGNORECASE),
    re.compile(r"/bin/sh(?:$|/)", re.IGNORECASE),
)

# Conjunto de rutas "publica conocida" del producto. Un 2xx en algo fuera
# de esta lista por parte de una IP no-allowlisted activa AMARILLO (sospecha
# de exito en ruta rara). Se construye uniendo las constantes que el
# classifier ya usaba para detectar flujos coherentes.
VERDICT_KNOWN_PUBLIC_ROUTES = (
    COHERENT_FRONTEND_ROUTES
    | COHERENT_API_ROUTES
    | COHERENT_ADMIN_ROUTES
    | {"/api/admin/auth/login", "/sitemap.xml", "/robots.txt", "/index.html"}
)

# Prefijos /api/* publicos (permitAll en SecurityConfig.java del backend).
# Usar startswith() para capturar cualquier subpath sin enumerarlo. Ampliado
# el 2026-06-13 tras un falso positivo AMARILLO del 13-jun (la IP
# 154.159.237.224 obtuvo 204 en /api/consent/age-gate y /api/consent/terms,
# rutas legitimas del consent banner + age gate de visitantes anonimos).
VERDICT_KNOWN_PUBLIC_API_PREFIXES: Tuple[str, ...] = (
    "/api/public/",                 # CMS publico (home, content, ...)
    "/api/consent/",                # consent banner + age gate (visitantes anonimos)
    "/api/email-verification/",     # confirm, resend
    "/api/users/avatars/",          # avatares publicos
    "/api/users/register/",         # registro client/model y variantes
    "/api/auth/password/",          # forgot + reset
    "/api/kyc/veriff/",             # webhook Veriff (POST)
    "/api/kyc/didit/",              # webhook Didit (POST)
)


def _is_known_public_api_route(route: str) -> bool:
    """True si la ruta /api/* esta declarada como permitAll en SecurityConfig
    (verificada manualmente contra el backend). Combina membresia exacta en
    VERDICT_KNOWN_PUBLIC_ROUTES con coincidencia por prefijo en
    VERDICT_KNOWN_PUBLIC_API_PREFIXES para no enumerar cada subpath."""
    base = route.split("?", 1)[0]
    if base in VERDICT_KNOWN_PUBLIC_ROUTES:
        return True
    for prefix in VERDICT_KNOWN_PUBLIC_API_PREFIXES:
        if base.startswith(prefix):
            return True
    return False


# Canales que sirven SPA estatica via CDN. Un 2xx con HTML en una ruta
# sensible aqui es SPA fallback de CDN (CloudFront "Custom Error
# Responses" que mapea 403/404 a /index.html con codigo 200) o nginx
# try_files, NO fuga real. ROJO 1 (success_on_sensitive_route) se
# degrada a NOTA INFORMATIVA dentro del VEREDICTO VERDE para estos
# canales. Si la ruta sensible se sirve por channel="API"
# (api.sharemechat.com -> Spring backend real) el ROJO sigue intacto.
#
# Cambio 2026-06-17 tras falso positivo del 16-jun: LeakIX (l9scan/2.0)
# desde 4 IPs de DigitalOcean recibio 200 en /server-status y
# /actuator/env contra admin.sharemechat.com (canal ADMIN). curl real
# confirmo HTML del SPA, no JSON de Actuator. Sin esto, cada vez que un
# scanner publico golpee admin/producto con rutas hostile -> ROJO falso.
VERDICT_SPA_FALLBACK_CHANNELS: frozenset = frozenset({"FRONTEND", "ADMIN"})

# Iconos web top-level que cualquier navegador o cliente movil pide por
# defecto y que nginx sirve como estaticos. Un 200 aqui es trafico legitimo
# y NO debe disparar AMARILLO. STATIC_ROUTE_PREFIXES ya cubre /favicon* y
# /static/*, pero hay rutas top-level habituales sueltas (apple-touch,
# android-chrome, browserconfig, etc.) que conviene incluir explicitamente
# para evitar falsos positivos cuando un iPhone abre la home.
VERDICT_KNOWN_WEB_ICONS = (
    "/apple-touch-icon.png",
    "/apple-touch-icon-precomposed.png",
    "/apple-touch-icon-152x152.png",
    "/apple-touch-icon-180x180.png",
    "/android-chrome-192x192.png",
    "/android-chrome-512x512.png",
    "/browserconfig.xml",
    "/site.webmanifest",
    "/mstile-150x150.png",
)

def _is_known_web_icon(route: str) -> bool:
    """True si la ruta es uno de los iconos web top-level conocidos. Estos
    se piden de forma automatica por navegadores y apps moviles y devolver
    200 en ellos NO es sondeo malicioso."""
    base = route.split("?", 1)[0]
    return base in VERDICT_KNOWN_WEB_ICONS

# Umbrales (ajustables; sin recalibrar la lista hostile interna del
# classifier ni el scoring).
VERDICT_AUTH_LOGIN_SUCCESS_AFTER_FAILS = 5     # ROJO: 2xx en login tras >=5 fallos previos misma IP
VERDICT_AUTH_POST_VOLUME_PER_IP = 100          # ROJO: >100 POST a /api/auth/* o /api/users/register/* desde una IP
VERDICT_DOS_TOTAL_DAILY = 200000               # ROJO: >200k eventos totales en el dia (proteccion DoS minima)
VERDICT_DOS_PER_IP = 5000                      # ROJO: una IP individual >5000 requests
VERDICT_BASELINE_DAYS = 7                      # ventana para calcular linea base
# Retune 2026-06-12: AMARILLO se reserva para anomalias raras. Subido el
# multiplicador (2.5 -> 3) y el floor absoluto (5 -> 15) para evitar que
# picos pequenos del scoring del classifier (1-2 IPs adicionales) cuenten
# como pico. Un dia "raro" debe ser claramente raro.
VERDICT_BASELINE_MULTIPLIER = 3.0              # AMARILLO: pico de criticas >3x media
VERDICT_BASELINE_MIN_ABSOLUTE = 15             # AMARILLO: y al menos 15 criticas en absoluto
# Retune 2026-06-12: el sondeo de /api/* real sin exito (todos 401/404) NO
# es accionable: es la autenticacion funcionando. Antes disparaba AMARILLO,
# ahora se reporta como NOTA INFORMATIVA dentro del veredicto VERDE para
# conservar visibilidad sin generar ruido amarillo.
VERDICT_API_REAL_PROBE_PER_IP = 10             # umbral para listar IPs sondeadoras en la NOTA del VERDE
VERDICT_OUTPUT_LINE = "VEREDICTO:"             # prefijo de la linea al inicio del .table.txt


def compute_verdict(
    events_path: Path,
    rows: Sequence[dict],
    allowlisted_ips: Set[str],
    output_root: Path,
    day: str,
) -> dict:
    """Calcula un veredicto operativo del dia leyendo los eventos crudos del
    normalizer (segunda pasada barata: misma estructura que load_groups, pero
    aqui solo recogemos hechos relevantes al veredicto). El parametro `rows`
    se usa para el conteo de IPs CRITICA del propio dia. La linea base se
    calcula leyendo los .summary.jsonl de los dias previos.
    """
    reasons_red: List[dict] = []
    reasons_yellow: List[dict] = []

    # 1) Hechos del dia a partir de events.jsonl.
    success_on_sensitive_api: List[dict] = []   # ROJO real: 2xx en sensible con channel=API o ausente (fail-safe)
    sensitive_on_spa_channel: List[dict] = []   # nota informativa: 2xx en sensible con channel in VERDICT_SPA_FALLBACK_CHANNELS
    channel_missing_warned = False              # log de canal ausente solo una vez por dia
    auth_login_per_ip: Dict[str, Dict[str, int]] = {}  # ip -> {success, fail}
    auth_post_per_ip: Counter = Counter()
    api_real_probe_per_ip: Counter = Counter()  # IP no-allowlisted sondeando /api/* no-publica-conocida
    successes_on_unknown_route: List[dict] = []  # 2xx/3xx en ruta no-publica-conocida (y no sensible)
    total_events = 0
    requests_per_ip: Counter = Counter()
    # P2.a 2026-06-28: distribucion de status por IP para enriquecer el
    # summary de dos_per_ip. Buckets fijos (2xx, 401, 404, 429, 4xx_otro,
    # 5xx) para que el operador vea de un vistazo si una IP con 5862
    # requests obtuvo algun exito (2xx) o solo 401/404 (defensa OK).
    status_buckets_per_ip: Dict[str, Counter] = {}

    with events_path.open("r", encoding="utf-8") as fh:
        for raw_line in fh:
            line = raw_line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            total_events += 1
            ip = str(event.get("ip") or "").strip()
            if not ip:
                continue
            requests_per_ip[ip] += 1
            allowlisted = ip in allowlisted_ips
            route = str(event.get("route") or "/")
            status_raw = str(event.get("status") or "")
            try:
                status_int = int(status_raw)
            except ValueError:
                status_int = 0
            method = str(event.get("method") or "").upper()

            is_success_2xx = 200 <= status_int <= 299
            is_redirect_3xx = 300 <= status_int <= 399
            is_success = is_success_2xx or is_redirect_3xx
            is_failure_auth = 400 <= status_int <= 499

            # P2.a 2026-06-28: bucket de status por IP para el summary
            # enriquecido de dos_per_ip. Buckets disjuntos en orden de
            # comprobacion (401 y 404 sacados aparte por su valor diagnostico).
            if is_success_2xx:
                bucket = "2xx"
            elif status_int == 401:
                bucket = "401"
            elif status_int == 404:
                bucket = "404"
            elif status_int == 429:
                bucket = "429"
            elif is_failure_auth:
                bucket = "4xx_otro"
            elif 500 <= status_int <= 599:
                bucket = "5xx"
            elif is_redirect_3xx:
                bucket = "3xx"
            else:
                bucket = "otro"
            status_buckets_per_ip.setdefault(ip, Counter())[bucket] += 1

            # ROJO 1: SOLO 2xx en ruta sensible desde IP no-allowlisted.
            # Decision (2026-06-12): aunque el operador menciono "2xx/3xx",
            # observamos que /wp-login.php devuelve 301 (redirect de nginx,
            # probablemente a la home o HTTPS canonica) y eso NO implica que
            # el atacante haya leido nada. Aceptar 3xx genera falsos positivos
            # ROJOS sobre sondeos benignos. Solo 2xx implica que el recurso
            # se entrego con cuerpo real.
            #
            # Retune 2026-06-17 (F1 tras FP del 16-jun): un 2xx en ruta
            # sensible servida por canal FRONTEND/ADMIN es SPA fallback de
            # CDN (CloudFront S3 Custom Error Responses) o de nginx
            # try_files, NO fuga real. Se degrada a NOTA INFORMATIVA dentro
            # del VERDE. Solo channel=API (Spring backend en api.sharemechat
            # .com) mantiene ROJO. Si el evento no trae channel: fail-safe,
            # cuenta como API (que no se silencie un ROJO real por dato
            # faltante) y se loguea un warning a stderr (una vez por dia).
            if is_success_2xx and not allowlisted:
                for pattern in VERDICT_RED_ROUTE_PATTERNS:
                    if pattern.search(route):
                        channel = str(event.get("channel") or "").upper()
                        hit = {"ip": ip, "route": route, "status": status_int, "channel": channel or "UNKNOWN"}
                        if channel in VERDICT_SPA_FALLBACK_CHANNELS:
                            sensitive_on_spa_channel.append(hit)
                        else:
                            if not channel and not channel_missing_warned:
                                sys.stderr.write(
                                    "[classify_access] event with sensitive route hit has empty channel; "
                                    "fail-safe to API (ROJO). ip=%s route=%s\n" % (ip, route)
                                )
                                channel_missing_warned = True
                            success_on_sensitive_api.append(hit)
                        break

            # Auth login (ROJO 2): contadores success/fail por IP.
            if route == "/api/auth/login" or route.startswith("/api/auth/login"):
                bucket = auth_login_per_ip.setdefault(ip, {"success": 0, "fail": 0})
                if is_success:
                    bucket["success"] += 1
                elif is_failure_auth:
                    bucket["fail"] += 1

            # Auth abuse volumetrico (ROJO 3): POST a /api/auth/* o /api/users/register/*
            if method == "POST" and (
                route.startswith("/api/auth/") or route.startswith("/api/users/register")
            ):
                auth_post_per_ip[ip] += 1

            # Sondeo /api/* real no-publica-conocida (AMARILLO 2 candidato).
            # Retune 2026-06-13: usar _is_known_public_api_route en lugar de
            # comparar solo membresia exacta, para reconocer las rutas
            # permitAll del SecurityConfig que aceptan subpaths (consent/*,
            # email-verification/*, users/avatars/*, kyc/*/webhook, etc.).
            # Antes una IP que pidiera /api/consent/age-gate y recibiera 401
            # se contaba como "sondeo a /api/* no-publica-conocida"; ahora se
            # reconoce como ruta publica legitima y no se cuenta.
            if not allowlisted and route.startswith("/api/") and not _is_known_public_api_route(route):
                # excluir hostile probes ya cubiertos por las reglas del classifier
                hostile_match = any(p.search(route) for p in VERDICT_RED_ROUTE_PATTERNS)
                if not hostile_match:
                    api_real_probe_per_ip[ip] += 1

            # AMARILLO 2: 200/201 en endpoint /api/* PROTEGIDO (fuga real).
            # Retune 2026-06-12: la regla anterior "2xx en ruta no-publica
            # conocida" generaba falsos positivos por el SPA fallback de
            # nginx, que devuelve 200 + index.html para cualquier ruta
            # extensionless del frontend (/login, /blog, /forgot-password,
            # y tambien rutas aleatorias que pida un scanner). Whitelistar
            # la lista SPA no resuelve porque un scanner pide rutas que
            # no estan en la lista y tambien recibe 200 del fallback.
            # La regla refinada IGNORA cualquier 2xx en el frontend y SOLO
            # dispara para 2xx en /api/* que no este en /api/public/* ni
            # sea sitemap/robots. Un 200 ahi es fuga real (endpoint
            # protegido devolviendo datos a una IP no-allowlisted).
            #
            # Retune 2026-06-13: restringir "exito visible" a status 200 o
            # 201 (cuerpo o creacion). Un 204 = "registrado sin cuerpo" no
            # expone datos (el consent banner devuelve 204 a /api/consent/*
            # y disparaba AMARILLO falso positivo el 13-jun). 202/203/205-208/
            # 226 tampoco son fuga real desde la perspectiva del atacante.
            is_visible_success = status_int in (200, 201)
            if is_visible_success and not allowlisted and route.startswith("/api/"):
                hostile_match = any(p.search(route) for p in VERDICT_RED_ROUTE_PATTERNS)
                if not _is_known_public_api_route(route) and not hostile_match:
                    successes_on_unknown_route.append(
                        {"ip": ip, "route": route, "status": status_int}
                    )

    # 2) Aplicar reglas ROJO.
    # Cambio 2026-06-17 (F1): success_on_sensitive_api solo. Los hits con
    # channel in VERDICT_SPA_FALLBACK_CHANNELS van a notas, no a ROJO.
    for hit in success_on_sensitive_api:
        reasons_red.append(
            {
                "rule": "success_on_sensitive_route",
                "ip": hit["ip"],
                "route": hit["route"],
                "status": hit["status"],
                "channel": hit.get("channel", "UNKNOWN"),
                "summary": (
                    f"{hit['ip']} obtuvo {hit['status']} en {hit['route']}"
                ),
            }
        )
    for ip, counts in auth_login_per_ip.items():
        if ip in allowlisted_ips:
            continue
        if counts["success"] >= 1 and counts["fail"] >= VERDICT_AUTH_LOGIN_SUCCESS_AFTER_FAILS:
            reasons_red.append(
                {
                    "rule": "auth_login_success_after_fails",
                    "ip": ip,
                    "success_count": counts["success"],
                    "fail_count": counts["fail"],
                    "summary": (
                        f"{ip} consiguio login tras {counts['fail']} fallos"
                    ),
                }
            )
    for ip, count in auth_post_per_ip.items():
        if ip in allowlisted_ips:
            continue
        if count > VERDICT_AUTH_POST_VOLUME_PER_IP:
            reasons_red.append(
                {
                    "rule": "auth_post_volume",
                    "ip": ip,
                    "count": count,
                    "summary": (
                        f"{ip} hizo {count} POST a /api/auth/* o "
                        f"/api/users/register/* (umbral {VERDICT_AUTH_POST_VOLUME_PER_IP})"
                    ),
                }
            )
    if total_events > VERDICT_DOS_TOTAL_DAILY:
        reasons_red.append(
            {
                "rule": "dos_total_volume",
                "total_events": total_events,
                "threshold": VERDICT_DOS_TOTAL_DAILY,
                "summary": (
                    f"volumen total del dia ({total_events}) supera el umbral "
                    f"{VERDICT_DOS_TOTAL_DAILY}"
                ),
            }
        )
    for ip, count in requests_per_ip.most_common(5):
        if ip in allowlisted_ips:
            continue
        if count > VERDICT_DOS_PER_IP:
            # P2.a 2026-06-28: enriquecer summary con distribucion de status.
            # Si la IP no tiene ningun 2xx, la defensa aguanto y el operador
            # lo ve sin abrir el .table.txt. Si tiene 2xx, hay que revisar a
            # que rutas. Buckets en orden fijo legible; omitimos los con 0.
            buckets = status_buckets_per_ip.get(ip, Counter())
            bucket_order = ("2xx", "401", "404", "429", "4xx_otro", "5xx", "3xx", "otro")
            parts = [f"{buckets[b]}x {b}" for b in bucket_order if buckets.get(b, 0) > 0]
            dist_str = ", ".join(parts) if parts else "sin status"
            reasons_red.append(
                {
                    "rule": "dos_per_ip",
                    "ip": ip,
                    "count": count,
                    "threshold": VERDICT_DOS_PER_IP,
                    "status_distribution": dict(buckets),
                    "summary": (
                        f"{ip} hizo {count} requests (umbral {VERDICT_DOS_PER_IP}); "
                        f"distribucion: {dist_str}"
                    ),
                }
            )

    # 3) Aplicar reglas AMARILLO (solo si no hay ROJO).
    if not reasons_red:
        # 3.a Pico de criticas vs media de los 7 dias previos.
        critical_today = sum(1 for row in rows if row.get("classification") == CLASSIFICATION_CRITICAL)
        baseline_mean = read_critical_baseline(output_root, day, VERDICT_BASELINE_DAYS)
        if (
            baseline_mean is not None
            and critical_today >= VERDICT_BASELINE_MIN_ABSOLUTE
            and critical_today > VERDICT_BASELINE_MULTIPLIER * baseline_mean
        ):
            reasons_yellow.append(
                {
                    "rule": "critical_spike",
                    "critical_today": critical_today,
                    "baseline_mean_7d": round(baseline_mean, 2),
                    "summary": (
                        f"pico de IPs CRITICA ({critical_today} vs media "
                        f"{round(baseline_mean, 1)}/dia ultimos {VERDICT_BASELINE_DAYS}d)"
                    ),
                }
            )

        # 3.b 2xx en ruta rara no-publica-conocida (sin ser sensible).
        for hit in successes_on_unknown_route:
            reasons_yellow.append(
                {
                    "rule": "success_on_unknown_route",
                    "ip": hit["ip"],
                    "route": hit["route"],
                    "status": hit["status"],
                    "summary": (
                        f"{hit['ip']} obtuvo {hit['status']} en ruta no-publica "
                        f"{hit['route']}"
                    ),
                }
            )

    # Nota informativa: sondeos de /api/* real sin exito (todos 401/404). NO
    # generan AMARILLO (es la autenticacion funcionando), pero se conservan
    # como nota en el bloque VERDE para que el operador tenga visibilidad
    # sobre IPs especificamente interesadas en la API real.
    notes_info: List[dict] = []
    for ip, count in api_real_probe_per_ip.most_common(5):
        if count >= VERDICT_API_REAL_PROBE_PER_IP:
            notes_info.append(
                {
                    "kind": "api_real_probing",
                    "ip": ip,
                    "count": count,
                    "summary": (
                        f"{ip} sondeo {count} veces /api/* no-publica-conocida (todos sin exito)"
                    ),
                }
            )

    # Nota informativa (cambio 2026-06-17, F1): 2xx en ruta sensible servida
    # por canal FRONTEND/ADMIN (SPA fallback de CDN). Degradado de ROJO 1.
    # Agrupado por (ip, channel) para no inundar cuando un scanner pega
    # multiples rutas hostile.
    spa_hits_by_ip_channel: Dict[Tuple[str, str], List[str]] = {}
    for hit in sensitive_on_spa_channel:
        key = (hit["ip"], hit["channel"])
        spa_hits_by_ip_channel.setdefault(key, []).append(hit["route"])
    for (ip, channel), routes in sorted(spa_hits_by_ip_channel.items()):
        routes_dedup = sorted(set(routes))
        shown = routes_dedup[:5]
        routes_str = ", ".join(shown)
        if len(routes_dedup) > 5:
            routes_str += f" (+{len(routes_dedup) - 5} mas)"
        notes_info.append(
            {
                "kind": "sensitive_on_spa_channel",
                "ip": ip,
                "channel": channel,
                "routes": routes_dedup,
                "count": len(routes_dedup),
                "summary": (
                    f"{ip} sondeo {routes_str} en {channel} (SPA fallback en CDN, no es fuga)"
                ),
            }
        )

    # 4) Decidir nivel y construir resumen.
    if reasons_red:
        level = VERDICT_LEVEL_RED
        reasons = reasons_red
    elif reasons_yellow:
        level = VERDICT_LEVEL_YELLOW
        reasons = reasons_yellow
    else:
        level = VERDICT_LEVEL_GREEN
        reasons = []

    # Stats agregados informativos.
    n_critical = sum(1 for row in rows if row.get("classification") == CLASSIFICATION_CRITICAL)
    n_malicious = sum(1 for row in rows if row.get("classification") == CLASSIFICATION_MALICIOUS)
    n_suspicious = sum(1 for row in rows if row.get("classification") == CLASSIFICATION_SUSPICIOUS)
    n_normal = sum(1 for row in rows if row.get("classification") == CLASSIFICATION_NORMAL)

    summary_text = build_verdict_summary(
        level=level,
        reasons=reasons,
        n_critical=n_critical,
        n_malicious=n_malicious,
        n_total_events=total_events,
    )

    pointer_file_table = f"/var/log/sharemechat-prod-access-classifier/{day}.table.txt"
    pointer_file_summary = f"/var/log/sharemechat-prod-access-classifier/{day}.summary.jsonl"

    return {
        "type": "verdict",
        "day": day,
        "level": level,
        "label": VERDICT_LEVEL_LABEL[level],
        "summary": summary_text,
        "reasons": reasons,
        "notes": notes_info,
        "stats": {
            "n_critical": n_critical,
            "n_malicious": n_malicious,
            "n_suspicious": n_suspicious,
            "n_normal": n_normal,
            "n_total_events": total_events,
        },
        "pointers": {
            "table": pointer_file_table,
            "summary": pointer_file_summary,
        },
    }


def read_critical_baseline(output_root: Path, day: str, days_back: int) -> Optional[float]:
    """Calcula la media de IPs CRITICA observadas en los `days_back` dias
    inmediatamente anteriores al `day` actual, leyendo los `.summary.jsonl`
    ya escritos en el output_root. Si no hay suficientes ficheros, devuelve
    None (no se puede hacer baseline confiable; AMARILLO 3.a se salta).
    """
    try:
        current_dt = datetime.strptime(day, "%Y-%m-%d").date()
    except ValueError:
        return None
    counts: List[int] = []
    for delta in range(1, days_back + 1):
        prev_day = current_dt.toordinal() - delta
        prev_date = datetime.fromordinal(prev_day).date().isoformat()
        path = output_root / f"{prev_date}.summary.jsonl"
        if not path.exists():
            continue
        try:
            with path.open("r", encoding="utf-8") as fh:
                day_critical = 0
                for raw_line in fh:
                    line = raw_line.strip()
                    if not line:
                        continue
                    try:
                        item = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if item.get("type") == "verdict":
                        # Linea de veredicto (formato nuevo); ignorar.
                        continue
                    if item.get("classification") == CLASSIFICATION_CRITICAL:
                        day_critical += 1
                counts.append(day_critical)
        except OSError:
            continue
    if len(counts) < 3:
        # Sin suficientes dias para una media razonable.
        return None
    return sum(counts) / len(counts)


def build_verdict_summary(
    level: str,
    reasons: Sequence[dict],
    n_critical: int,
    n_malicious: int,
    n_total_events: int,
) -> str:
    if level == VERDICT_LEVEL_GREEN:
        parts = []
        n_malicious_critical = n_critical + n_malicious
        if n_malicious_critical:
            parts.append(
                f"{n_malicious_critical} IPs MALICIOSA/CRITICA, sin exito en rutas sensibles"
            )
        else:
            parts.append("sin actividad maliciosa relevante")
        if n_total_events:
            parts.append(f"{n_total_events} eventos totales")
        parts.append("nada que revisar")
        return "; ".join(parts) + "."
    # AMARILLO o ROJO: primera razon como sumario corto + n adicionales.
    first = reasons[0]
    head = first.get("summary", first.get("rule", "incidencia"))
    extra = len(reasons) - 1
    if extra > 0:
        head += f" (+{extra} mas)"
    return head + "."


def render_verdict_block(verdict: dict) -> str:
    level = verdict.get("level", VERDICT_LEVEL_GREEN)
    label = VERDICT_LEVEL_LABEL.get(level, level)
    icon = VERDICT_LEVEL_ICON.get(level, "")
    head = f"{VERDICT_OUTPUT_LINE} {icon} {label} -- {verdict.get('summary', '')}".rstrip()
    lines = [head]
    pointers = verdict.get("pointers", {})
    if level != VERDICT_LEVEL_GREEN:
        for reason in verdict.get("reasons", []):
            ip = reason.get("ip")
            route = reason.get("route")
            rule = reason.get("rule")
            extras = []
            if ip:
                extras.append(f"ip={ip}")
            if route:
                extras.append(f"route={route}")
            if "status" in reason:
                extras.append(f"status={reason['status']}")
            tag = f" [{rule}]" if rule else ""
            detail = reason.get("summary", "")
            if extras:
                lines.append(f"  - {detail}{tag} ({', '.join(extras)})")
            else:
                lines.append(f"  - {detail}{tag}")
        if pointers.get("table"):
            lines.append(f"  Revisar: {pointers['table']}")
    else:
        # Bloque VERDE: si hay notas informativas (sondeos /api/* sin exito,
        # etc.), listarlas debajo del veredicto. NO son accionables, solo
        # visibilidad para el operador.
        for note in verdict.get("notes", []):
            kind = note.get("kind")
            ip = note.get("ip")
            extras = []
            if ip:
                extras.append(f"ip={ip}")
            tag = f" [{kind}]" if kind else ""
            detail = note.get("summary", "")
            if extras:
                lines.append(f"  (nota) {detail}{tag} ({', '.join(extras)})")
            else:
                lines.append(f"  (nota) {detail}{tag}")
    return "\n".join(lines)


# ============================================================================


if __name__ == "__main__":
    sys.exit(main())
