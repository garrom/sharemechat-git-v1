#!/usr/bin/env python3
"""
TEST access blocker.

Consume el summary diario del clasificador y produce:

  - <OUTPUT_ROOT>/YYYY-MM-DD.deny-test-ips.proposed.conf
  - <OUTPUT_ROOT>/YYYY-MM-DD.blocker-diff.txt
  - <OUTPUT_ROOT>/YYYY-MM-DD.ips.json  (snapshot del estado tras este run)
  - <STATE_FILE>                       (estado persistente actualizado)

Soporta dos modos de operacion controlados via DRY_RUN en config.env:

  DRY_RUN=1 (default seguro):
    NO escribe /etc/nginx/deny-test-ips.conf, NO ejecuta nginx -t ni reload.
    SOLO genera propuesta advisory, diff razonado y estado persistente.

  DRY_RUN=0 (modo real controlado, solo Carril A):
    Aplica bloqueo real en nginx EXCLUSIVAMENTE para IPs de Carril A.
    Carril B y Carril C siguen siendo solo propuesta advisory.
    Requiere --nginx-deny-file. Ejecuta doble nginx -t con rollback automatico.

Estrategia de decision (ver README.md):

  Carril A (TTL largo, 30 dias por defecto):
    - UA scanner con firma conocida
      (ua_sqlmap, ua_masscan, ua_zgrab, ua_nikto, ua_nmap)
    - shell_probe (ejecucion remota tipica, IOC CRITICA)
    - override hostile_plus_admin_sensitive activo
    - classification=CRITICA con >=1 IOC hostil en rutas hostiles
    - 2+ probes distintos de rutas hostiles el mismo dia

  Carril B (TTL medio, 14 dias por defecto):
    - IOC hostil repetido en >=2 dias distintos dentro de la ventana
      (7 dias por defecto)
    - al menos uno de esos dias con classification MALICIOSA o CRITICA

  Carril C: observar, no bloquear.

Allowlist: si la IP pertenece a la allowlist (IP exacta o CIDR), queda
descartada aunque cumpla carriles A o B.
"""

from __future__ import annotations

import argparse
import ipaddress
import json
import re
import shutil
import subprocess
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple


# ---------------------------------------------------------------------------
# Reglas declarativas
# ---------------------------------------------------------------------------

UA_SCANNER_IOCS: Set[str] = {
    "ua_sqlmap",
    "ua_masscan",
    "ua_zgrab",
    "ua_nikto",
    "ua_nmap",
}

SHELL_PROBE_IOC: str = "shell_probe"

OVERRIDE_LABEL_CRITICAL_FLOOR: str = "hostile_plus_admin_sensitive"

HOSTILE_ROUTE_LABELS: Set[str] = {
    "xmlrpc_scan",
    "wlwmanifest_scan",
    "wordpress_scan",
    "cgi_bin_scan",
    "shell_probe",
    "dotenv_probe",
    "phpunit_probe",
    "router_probe",
    "actuator_probe",
    "phpmyadmin_probe",
    "server_status_probe",
}

CRITICAL = "CRITICA"
MALICIOUS = "MALICIOSA"
HIGH_SEVERITY = {CRITICAL, MALICIOUS}


# ---------------------------------------------------------------------------
# Estructuras de estado
# ---------------------------------------------------------------------------

@dataclass
class IPHistory:
    """Historial persistente por IP."""
    ip: str
    first_seen: str
    last_seen: str
    # Lista de dias observados con >=1 IOC hostil y su severidad/etiquetas.
    # Se mantiene para aplicar ventana deslizante de Carril B.
    hostile_days: List[dict] = field(default_factory=list)
    # Estado de bloqueo propuesto.
    block: Optional[dict] = None

    def to_dict(self) -> dict:
        return {
            "ip": self.ip,
            "first_seen": self.first_seen,
            "last_seen": self.last_seen,
            "hostile_days": self.hostile_days,
            "block": self.block,
        }

    @staticmethod
    def from_dict(row: dict) -> "IPHistory":
        return IPHistory(
            ip=row["ip"],
            first_seen=row.get("first_seen") or row.get("last_seen") or "",
            last_seen=row.get("last_seen") or "",
            hostile_days=list(row.get("hostile_days") or []),
            block=row.get("block"),
        )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run")
    run.add_argument("--date")
    run.add_argument("--input")
    run.add_argument("--classifier-output-root", required=True)
    run.add_argument("--output-root", required=True)
    run.add_argument("--state-file", required=True)
    run.add_argument("--allowlist-file", default="")
    run.add_argument("--allowlist-ips", default="")
    run.add_argument("--carril-a-ttl-days", type=int, default=30)
    run.add_argument("--carril-b-ttl-days", type=int, default=14)
    run.add_argument("--carril-b-window-days", type=int, default=7)
    run.add_argument("--dry-run", action="store_true")
    # Real-mode (DRY_RUN=0): ruta al fichero live de nginx deny list.
    # Solo se usa cuando --dry-run NO esta presente.
    # Si falta en modo real, el binario aborta.
    run.add_argument("--nginx-deny-file", default="")
    # Fichero de bloqueos manuales (lectura solo). Si existe, sus entradas
    # se preservan en el fichero live y sus IPs no se duplican en el bloque
    # auto-generado. Si no existe, no falla.
    run.add_argument("--nginx-manual-deny-file", default="")

    args = parser.parse_args()
    if args.command == "run":
        return run_blocker(args)
    return 1


def run_blocker(args: argparse.Namespace) -> int:
    is_dry_run = args.dry_run

    # Modo real: exige --nginx-deny-file explicitamente.
    if not is_dry_run and not args.nginx_deny_file:
        sys.stderr.write(
            "block_access.py: modo real (sin --dry-run) requiere --nginx-deny-file.\n"
        )
        return 2

    summary_path, day = resolve_summary_input(
        args.input, args.date, args.classifier_output_root
    )

    output_root = Path(args.output_root)
    output_root.mkdir(parents=True, exist_ok=True)

    state_path = Path(args.state_file)
    state_path.parent.mkdir(parents=True, exist_ok=True)

    allowlist = load_allowlist(args.allowlist_file, args.allowlist_ips)
    rows = load_summary_rows(summary_path)
    state = load_state(state_path)

    decisions = evaluate_decisions(
        day=day,
        rows=rows,
        state=state,
        allowlist=allowlist,
        carril_a_ttl_days=args.carril_a_ttl_days,
        carril_b_ttl_days=args.carril_b_ttl_days,
        carril_b_window_days=args.carril_b_window_days,
    )

    proposed_path = output_root / f"{day}.deny-test-ips.proposed.conf"
    diff_path = output_root / f"{day}.blocker-diff.txt"
    snapshot_path = output_root / f"{day}.ips.json"

    # Las salidas advisory se generan siempre (dry-run y real).
    write_proposed_deny_list(proposed_path, decisions, day)
    write_state(state_path, state)
    write_state_snapshot(snapshot_path, state, day)

    nginx_result: Optional[dict] = None
    if not is_dry_run:
        nginx_result = apply_carril_a_to_nginx(
            decisions=decisions,
            nginx_deny_file=args.nginx_deny_file,
            nginx_manual_deny_file=args.nginx_manual_deny_file,
            day=day,
        )

    write_diff_report(diff_path, decisions, day, allowlist, nginx_result=nginx_result)
    sys.stdout.write(render_stdout_summary(decisions, day, nginx_result=nginx_result) + "\n")

    if nginx_result is not None and not nginx_result["ok"]:
        sys.stderr.write(
            f"[blocker REAL] ERROR nginx: {nginx_result.get('error')}\n"
        )
        return 1

    return 0


# ---------------------------------------------------------------------------
# Inputs
# ---------------------------------------------------------------------------

def resolve_summary_input(
    input_value: Optional[str],
    date_value: Optional[str],
    classifier_output_root: str,
) -> Tuple[Path, str]:
    if input_value:
        path = Path(input_value)
        if not path.exists():
            raise SystemExit(f"Classifier summary not found: {path}")
        day = path.name.replace(".summary.jsonl", "")
        return path, day

    day = date_value or (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
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


def load_state(path: Path) -> Dict[str, IPHistory]:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Corrupted state file {path}: {exc}") from exc
    entries = data.get("ips") if isinstance(data, dict) else None
    if not entries:
        return {}
    result: Dict[str, IPHistory] = {}
    for row in entries:
        history = IPHistory.from_dict(row)
        result[history.ip] = history
    return result


def write_state(path: Path, state: Dict[str, IPHistory]) -> None:
    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "ips": [state[ip].to_dict() for ip in sorted(state.keys())],
    }
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    tmp_path.replace(path)


def write_state_snapshot(path: Path, state: Dict[str, IPHistory], day: str) -> None:
    payload = {
        "date": day,
        "snapshot_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "ips": [state[ip].to_dict() for ip in sorted(state.keys())],
    }
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


# ---------------------------------------------------------------------------
# Allowlist
# ---------------------------------------------------------------------------

@dataclass
class Allowlist:
    ips: Set[str] = field(default_factory=set)
    networks: List[ipaddress._BaseNetwork] = field(default_factory=list)
    comments: Dict[str, str] = field(default_factory=dict)

    def matches(self, ip_str: str) -> Optional[str]:
        if ip_str in self.ips:
            return self.comments.get(ip_str, "allowlisted_ip")
        try:
            ip_obj = ipaddress.ip_address(ip_str)
        except ValueError:
            return None
        for net in self.networks:
            if ip_obj in net:
                key = str(net)
                return self.comments.get(key, f"allowlisted_cidr={key}")
        return None


def load_allowlist(allowlist_file: str, allowlist_ips: str) -> Allowlist:
    result = Allowlist()

    for raw in (allowlist_ips or "").split(","):
        token = raw.strip()
        if token:
            _register_allowlist_token(result, token, comment="")

    if allowlist_file:
        path = Path(allowlist_file)
        if path.exists():
            for raw_line in path.read_text(encoding="utf-8").splitlines():
                line = raw_line.strip()
                if not line or line.startswith("#"):
                    continue
                token, _, comment = line.partition("#")
                token = token.strip()
                comment = comment.strip()
                if token:
                    _register_allowlist_token(result, token, comment=comment)

    return result


def _register_allowlist_token(result: Allowlist, token: str, comment: str) -> None:
    if "/" in token:
        try:
            net = ipaddress.ip_network(token, strict=False)
        except ValueError:
            return
        result.networks.append(net)
        if comment:
            result.comments[str(net)] = comment
    else:
        try:
            ipaddress.ip_address(token)
        except ValueError:
            return
        result.ips.add(token)
        if comment:
            result.comments[token] = comment


# ---------------------------------------------------------------------------
# Logica de decision
# ---------------------------------------------------------------------------

@dataclass
class Decision:
    ip: str
    classification: str
    score: int
    carril: str                       # "A", "B", "C"
    action: str                       # "block_proposed", "observe", "skip_allowlisted"
    reasons: List[str]
    ttl_days: Optional[int]
    expires_at: Optional[str]
    allowlist_reason: Optional[str] = None
    hostile_iocs_today: List[str] = field(default_factory=list)
    hostile_iocs_window: Dict[str, List[str]] = field(default_factory=dict)


def evaluate_decisions(
    day: str,
    rows: List[dict],
    state: Dict[str, IPHistory],
    allowlist: Allowlist,
    carril_a_ttl_days: int,
    carril_b_ttl_days: int,
    carril_b_window_days: int,
) -> List[Decision]:
    day_dt = parse_day(day)
    window_start = day_dt - timedelta(days=carril_b_window_days - 1)

    _prune_state(state, day_dt)

    decisions: List[Decision] = []

    # Primera pasada: refrescar state.hostile_days con la evidencia de hoy.
    for row in rows:
        ip = str(row.get("ip") or "").strip()
        if not ip:
            continue
        hostile_iocs_today = extract_hostile_iocs(row)
        classification = str(row.get("classification") or "NORMAL")
        if not hostile_iocs_today and classification not in HIGH_SEVERITY:
            # no aporta al historial hostil; solo refrescamos last_seen
            _touch_state(state, ip, day)
            continue
        _register_hostile_day(
            state,
            ip=ip,
            day=day,
            classification=classification,
            hostile_iocs=hostile_iocs_today,
        )

    # Segunda pasada: decidir carril por IP.
    for row in rows:
        ip = str(row.get("ip") or "").strip()
        if not ip:
            continue
        classification = str(row.get("classification") or "NORMAL")
        score = int(row.get("score") or 0)

        allowlist_reason = allowlist.matches(ip)
        if allowlist_reason:
            decisions.append(
                Decision(
                    ip=ip,
                    classification=classification,
                    score=score,
                    carril="C",
                    action="skip_allowlisted",
                    reasons=[f"allowlist: {allowlist_reason}"],
                    ttl_days=None,
                    expires_at=None,
                    allowlist_reason=allowlist_reason,
                )
            )
            continue

        hostile_iocs_today = extract_hostile_iocs(row)
        matched_labels = extract_matched_rule_labels(row)
        hostile_ioc_count = int(((row.get("features") or {}).get("hostile_ioc_count")) or 0)
        hostile_route_iocs_today = [
            label for label in hostile_iocs_today if label in HOSTILE_ROUTE_LABELS
        ]

        carril_a_reasons = evaluate_carril_a(
            classification=classification,
            hostile_iocs_today=hostile_iocs_today,
            matched_labels=matched_labels,
            hostile_ioc_count=hostile_ioc_count,
            hostile_route_iocs_today=hostile_route_iocs_today,
        )

        if carril_a_reasons:
            expires_at = (day_dt + timedelta(days=carril_a_ttl_days)).strftime("%Y-%m-%d")
            _set_block_state(
                state,
                ip=ip,
                carril="A",
                ttl_days=carril_a_ttl_days,
                expires_at=expires_at,
                reasons=carril_a_reasons,
                opened_at=day,
            )
            decisions.append(
                Decision(
                    ip=ip,
                    classification=classification,
                    score=score,
                    carril="A",
                    action="block_proposed",
                    reasons=carril_a_reasons,
                    ttl_days=carril_a_ttl_days,
                    expires_at=expires_at,
                    hostile_iocs_today=hostile_iocs_today,
                )
            )
            continue

        carril_b_reasons, window_ioc_days = evaluate_carril_b(
            state=state,
            ip=ip,
            day_dt=day_dt,
            window_start=window_start,
        )

        if carril_b_reasons:
            expires_at = (day_dt + timedelta(days=carril_b_ttl_days)).strftime("%Y-%m-%d")
            _set_block_state(
                state,
                ip=ip,
                carril="B",
                ttl_days=carril_b_ttl_days,
                expires_at=expires_at,
                reasons=carril_b_reasons,
                opened_at=day,
            )
            decisions.append(
                Decision(
                    ip=ip,
                    classification=classification,
                    score=score,
                    carril="B",
                    action="block_proposed",
                    reasons=carril_b_reasons,
                    ttl_days=carril_b_ttl_days,
                    expires_at=expires_at,
                    hostile_iocs_today=hostile_iocs_today,
                    hostile_iocs_window=window_ioc_days,
                )
            )
            continue

        # Carril C: observar, no bloquear.
        # Prioridad de razon: IOC presente (aislado) > severidad alta sin IOC > sin IOC.
        if hostile_iocs_today:
            c_reasons = [
                "IOC hostil aislado sin repeticion ni criterio Carril A",
                "iocs_today=" + ",".join(sorted(hostile_iocs_today)),
            ]
        elif classification in HIGH_SEVERITY:
            c_reasons = [
                f"clasificacion={classification} sin IOC hostil en ruta hostil; "
                f"score={score}; main_reason={row.get('main_reason') or 'n/a'}"
            ]
        else:
            c_reasons = ["no IOC hostil relevante"]
        decisions.append(
            Decision(
                ip=ip,
                classification=classification,
                score=score,
                carril="C",
                action="observe",
                reasons=c_reasons,
                ttl_days=None,
                expires_at=None,
                hostile_iocs_today=hostile_iocs_today,
            )
        )

    return decisions


def evaluate_carril_a(
    classification: str,
    hostile_iocs_today: List[str],
    matched_labels: List[str],
    hostile_ioc_count: int,
    hostile_route_iocs_today: List[str],
) -> List[str]:
    reasons: List[str] = []

    ua_hits = sorted(set(hostile_iocs_today) & UA_SCANNER_IOCS)
    if ua_hits:
        reasons.append("ua_scanner=" + ",".join(ua_hits))

    if SHELL_PROBE_IOC in hostile_iocs_today:
        reasons.append("shell_probe")

    if OVERRIDE_LABEL_CRITICAL_FLOOR in matched_labels:
        reasons.append("override=hostile_plus_admin_sensitive")

    if classification == CRITICAL and hostile_ioc_count >= 1 and hostile_route_iocs_today:
        reasons.append(
            "classification=CRITICA+hostile_ioc="
            + ",".join(sorted(set(hostile_route_iocs_today)))
        )

    if len(set(hostile_route_iocs_today)) >= 2:
        reasons.append(
            "multi_probe_same_day="
            + ",".join(sorted(set(hostile_route_iocs_today)))
        )

    return reasons


def evaluate_carril_b(
    state: Dict[str, IPHistory],
    ip: str,
    day_dt: datetime,
    window_start: datetime,
) -> Tuple[List[str], Dict[str, List[str]]]:
    history = state.get(ip)
    if not history:
        return [], {}

    window_days: Dict[str, List[str]] = {}
    window_had_high_severity = False
    repeated_iocs: Counter = Counter()

    for entry in history.hostile_days:
        entry_dt = parse_day(entry["day"])
        if entry_dt < window_start or entry_dt > day_dt:
            continue
        entry_iocs = [
            label
            for label in (entry.get("hostile_iocs") or [])
            if label in HOSTILE_ROUTE_LABELS
        ]
        if not entry_iocs and entry.get("classification") not in HIGH_SEVERITY:
            continue
        window_days[entry["day"]] = entry_iocs
        for label in entry_iocs:
            repeated_iocs[label] += 1
        if entry.get("classification") in HIGH_SEVERITY:
            window_had_high_severity = True

    days_with_route_iocs = [d for d, iocs in window_days.items() if iocs]
    if len(set(days_with_route_iocs)) < 2:
        return [], window_days
    if not window_had_high_severity:
        return [], window_days

    repeated = [label for label, count in repeated_iocs.items() if count >= 2]
    if not repeated:
        return [], window_days

    reasons = [
        f"ioc_repetido_en_ventana={','.join(sorted(repeated))}",
        f"dias_con_ioc={sorted(set(days_with_route_iocs))}",
        "severidad_max_ventana>=MALICIOSA",
    ]
    return reasons, window_days


# ---------------------------------------------------------------------------
# Extraccion de evidencia desde una fila del summary
# ---------------------------------------------------------------------------

def extract_hostile_iocs(row: dict) -> List[str]:
    """
    Extrae IOCs hostiles del row del summary. Consulta cuatro fuentes en orden,
    sin duplicar. Las fuentes cubren casos donde un IOC de ruta aparece en
    evidence.hostile_hits, evidence.matched_rule_labels, matched_rules o
    en main_reason (por ejemplo 'xmlrpc_scan+many_routes_6').
    """
    seen: Set[str] = set()
    labels: List[str] = []

    def _add(label: str) -> None:
        if label not in seen:
            seen.add(label)
            labels.append(label)

    # Fuente 1: evidence.hostile_hits (campo canonico de rutas hostiles).
    evidence = row.get("evidence") or {}
    for item in evidence.get("hostile_hits") or []:
        key = item.get("key") if isinstance(item, dict) else None
        if key:
            _add(str(key))

    # Fuente 2: matched_rule_labels (UA scanners + IOC de ruta hostil).
    for label in extract_matched_rule_labels(row):
        if label in UA_SCANNER_IOCS or label in HOSTILE_ROUTE_LABELS:
            _add(label)

    # Fuente 3: matched_rules del row principal (fallback si evidence ausente).
    for rule in row.get("matched_rules") or []:
        label = rule.get("label") if isinstance(rule, dict) else None
        if label and (label in UA_SCANNER_IOCS or label in HOSTILE_ROUTE_LABELS):
            _add(str(label))

    # Fuente 4: main_reason (ultimo recurso; cubre casos como
    # 'xmlrpc_scan+many_routes_6' donde el IOC va prefijado al reason).
    main_reason = str(row.get("main_reason") or "")
    for token in re.split(r"[+\s,;|]+", main_reason):
        token = token.strip()
        if token and (token in UA_SCANNER_IOCS or token in HOSTILE_ROUTE_LABELS):
            _add(token)

    return labels


def extract_matched_rule_labels(row: dict) -> List[str]:
    evidence = row.get("evidence") or {}
    matched = evidence.get("matched_rule_labels")
    if isinstance(matched, list):
        return [str(x) for x in matched if x]
    # fallback: matched_rules en el row principal
    out: List[str] = []
    for rule in row.get("matched_rules") or []:
        label = rule.get("label") if isinstance(rule, dict) else None
        if label:
            out.append(str(label))
    return out


# ---------------------------------------------------------------------------
# Actualizacion del estado persistente
# ---------------------------------------------------------------------------

def _touch_state(state: Dict[str, IPHistory], ip: str, day: str) -> None:
    history = state.get(ip)
    if not history:
        state[ip] = IPHistory(ip=ip, first_seen=day, last_seen=day)
        return
    if day > history.last_seen:
        history.last_seen = day


def _register_hostile_day(
    state: Dict[str, IPHistory],
    ip: str,
    day: str,
    classification: str,
    hostile_iocs: List[str],
) -> None:
    history = state.get(ip)
    if not history:
        history = IPHistory(ip=ip, first_seen=day, last_seen=day)
        state[ip] = history
    if day > history.last_seen:
        history.last_seen = day

    # upsert por dia
    for entry in history.hostile_days:
        if entry.get("day") == day:
            existing = set(entry.get("hostile_iocs") or [])
            existing.update(hostile_iocs)
            entry["hostile_iocs"] = sorted(existing)
            if _severity_rank(classification) > _severity_rank(entry.get("classification", "NORMAL")):
                entry["classification"] = classification
            return

    history.hostile_days.append(
        {
            "day": day,
            "classification": classification,
            "hostile_iocs": sorted(set(hostile_iocs)),
        }
    )


def _set_block_state(
    state: Dict[str, IPHistory],
    ip: str,
    carril: str,
    ttl_days: int,
    expires_at: str,
    reasons: List[str],
    opened_at: str,
) -> None:
    history = state.get(ip)
    if not history:
        history = IPHistory(ip=ip, first_seen=opened_at, last_seen=opened_at)
        state[ip] = history

    current = history.block or {}
    # Si ya hay un bloqueo A vigente, no lo degradamos a B.
    if current.get("carril") == "A" and carril == "B":
        return

    history.block = {
        "carril": carril,
        "ttl_days": ttl_days,
        "opened_at": opened_at,
        "expires_at": expires_at,
        "reasons": reasons,
    }


def _prune_state(state: Dict[str, IPHistory], day_dt: datetime) -> None:
    """Vencer bloqueos expirados y recortar hostile_days muy antiguos."""
    max_history_days = 60  # suficiente para ventana de 7d y auditoria corta
    horizon = day_dt - timedelta(days=max_history_days)
    today_str = day_dt.strftime("%Y-%m-%d")

    for history in state.values():
        # expirar bloqueos
        if history.block and history.block.get("expires_at"):
            if history.block["expires_at"] <= today_str:
                history.block = None
        # recortar hostile_days antiguos
        history.hostile_days = [
            entry for entry in history.hostile_days
            if parse_day(entry["day"]) >= horizon
        ]


def _severity_rank(classification: str) -> int:
    order = {"NORMAL": 0, "SOSPECHOSA": 1, "MALICIOSA": 2, "CRITICA": 3}
    return order.get(classification, 0)


# ---------------------------------------------------------------------------
# Bloqueo real en nginx (solo Carril A, solo cuando DRY_RUN=0)
# ---------------------------------------------------------------------------

_DENY_IP_RE = re.compile(r"^\s*deny\s+([^\s;]+)\s*;")


def load_manual_deny_entries(manual_file: str) -> Tuple[List[str], Set[str]]:
    """
    Lee el fichero de bloqueos manuales en modo lectura estricta.
    - No falla si el fichero no existe.
    - Devuelve (lineas_preservadas, ips_en_manual).
    - lineas_preservadas: lineas no vacias tal cual (incluye comentarios).
    - ips_en_manual: IPs extraidas de 'deny <IP>;' para deduplicacion.
    """
    if not manual_file:
        return [], set()
    path = Path(manual_file)
    if not path.exists():
        return [], set()
    raw_lines: List[str] = []
    ips: Set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        raw_lines.append(line.rstrip())
        m = _DENY_IP_RE.match(stripped)
        if m:
            ips.add(m.group(1))
    return raw_lines, ips


def apply_carril_a_to_nginx(
    decisions: List[Decision],
    nginx_deny_file: str,
    day: str,
    nginx_manual_deny_file: str = "",
) -> dict:
    """
    Aplica el bloqueo real EXCLUSIVAMENTE para IPs de Carril A.
    Carril B y Carril C NO se tocan aqui.

    El fichero live resultante combina, en orden:
      1. Entradas manuales preservadas de nginx_manual_deny_file (si existe).
         El fichero manual NO se modifica.
      2. Bloque auto-generado con IPs Carril A no presentes ya en el manual.

    Flujo de seguridad:
      1. nginx -t PREFLIGHT (config actual intacta)
      2. Cargar entradas manuales (lectura; fallo silencioso si no existe)
      3. Escribir contenido combinado en <deny_file>.new
      4. Backup del fichero live con timestamp
      5. Reemplazo atomico .new -> live
      6. nginx -t POSTFLIGHT (con nuevo contenido)
         Si falla: rollback desde backup
      7. systemctl reload nginx
         Si falla: rollback + reload previo

    Devuelve un dict con:
      ok, ips_blocked, manual_entries_preserved, backup_path,
      nginx_test_before, nginx_test_after, rollback, error
    """
    result: dict = {
        "ok": False,
        "ips_blocked": 0,
        "manual_entries_preserved": 0,
        "backup_path": None,
        "nginx_test_before": None,
        "nginx_test_after": None,
        "rollback": False,
        "error": None,
    }

    carril_a_ips = sorted(
        {d.ip for d in decisions if d.carril == "A" and d.action == "block_proposed"}
    )

    deny_path = Path(nginx_deny_file)
    tmp_path = deny_path.with_name(deny_path.name + ".new")

    # 1. Preflight: nginx -t con config actual (antes de tocar nada).
    r_pre = subprocess.run(
        ["nginx", "-t"], capture_output=True, text=True, timeout=30
    )
    result["nginx_test_before"] = (
        "ok" if r_pre.returncode == 0 else f"FAILED: {r_pre.stderr.strip()}"
    )
    if r_pre.returncode != 0:
        result["error"] = (
            f"nginx -t fallo ANTES de aplicar cambio (nginx ya estaba roto); "
            f"abortando sin tocar nada. stderr: {r_pre.stderr.strip()}"
        )
        return result

    # 2. Cargar entradas manuales (solo lectura; no falla si no existe).
    manual_lines, ips_in_manual = load_manual_deny_entries(nginx_manual_deny_file)
    result["manual_entries_preserved"] = len(manual_lines)

    # IPs Carril A que no estan ya cubiertas por el bloque manual.
    carril_a_new_ips = [ip for ip in carril_a_ips if ip not in ips_in_manual]

    # 3. Escribir contenido combinado en fichero temporal.
    try:
        content_parts: List[str] = []
        if manual_lines:
            content_parts.append("# Bloqueos manuales (preservados de "
                                  + (nginx_manual_deny_file or "manual") + ")")
            content_parts.extend(manual_lines)
            content_parts.append("")
        content_parts.append(
            f"# Auto-generado por test-access-blocker - Carril A - {day}"
        )
        if carril_a_new_ips:
            content_parts.extend(f"deny {ip};" for ip in carril_a_new_ips)
        else:
            content_parts.append(f"# Sin IPs nuevas de Carril A en {day}")
        tmp_path.write_text("\n".join(content_parts) + "\n", encoding="utf-8")
    except OSError as exc:
        result["error"] = f"No se pudo escribir {tmp_path}: {exc}"
        return result

    # 3. Backup del fichero live actual con timestamp.
    backup_path: Optional[Path] = None
    if deny_path.exists():
        ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        backup_path = deny_path.with_name(f"{deny_path.name}.bak_{ts}")
        try:
            shutil.copy2(deny_path, backup_path)
            result["backup_path"] = str(backup_path)
        except OSError as exc:
            tmp_path.unlink(missing_ok=True)
            result["error"] = f"No se pudo crear backup {backup_path}: {exc}"
            return result

    # 4. Reemplazo atomico: .new -> live.
    try:
        tmp_path.replace(deny_path)
    except OSError as exc:
        tmp_path.unlink(missing_ok=True)
        result["error"] = f"No se pudo reemplazar {deny_path}: {exc}"
        return result

    # 5. Postflight: nginx -t con el nuevo contenido.
    r_post = subprocess.run(
        ["nginx", "-t"], capture_output=True, text=True, timeout=30
    )
    result["nginx_test_after"] = (
        "ok" if r_post.returncode == 0 else f"FAILED: {r_post.stderr.strip()}"
    )
    if r_post.returncode != 0:
        # Rollback: restaurar backup o eliminar el fichero live.
        _rollback_nginx(deny_path, backup_path)
        result["rollback"] = True
        result["error"] = (
            f"nginx -t fallo DESPUES de aplicar cambio; rollback aplicado. "
            f"stderr: {r_post.stderr.strip()}"
        )
        return result

    # 6. Reload nginx.
    r_reload = subprocess.run(
        ["systemctl", "reload", "nginx"], capture_output=True, text=True, timeout=30
    )
    if r_reload.returncode != 0:
        # Reload fallo: rollback y segundo intento de reload con config anterior.
        _rollback_nginx(deny_path, backup_path)
        subprocess.run(
            ["systemctl", "reload", "nginx"], capture_output=True, text=True, timeout=30
        )
        result["rollback"] = True
        result["error"] = (
            f"systemctl reload nginx fallo; rollback aplicado. "
            f"stderr: {r_reload.stderr.strip()}"
        )
        return result

    result["ok"] = True
    # ips_blocked = nuevas IPs de Carril A no presentes ya en el bloque manual.
    result["ips_blocked"] = len(carril_a_new_ips)
    return result


def _rollback_nginx(deny_path: Path, backup_path: Optional[Path]) -> None:
    """Restaura el fichero de deny list desde el backup, o lo elimina si no habia backup."""
    try:
        if backup_path and backup_path.exists():
            shutil.copy2(backup_path, deny_path)
        else:
            deny_path.unlink(missing_ok=True)
    except OSError:
        pass  # Fallo de rollback: se loggeara en el caller via result["error"]


# ---------------------------------------------------------------------------
# Salidas
# ---------------------------------------------------------------------------

def write_proposed_deny_list(path: Path, decisions: List[Decision], day: str) -> None:
    lines: List[str] = []
    lines.append("# Proposed deny list for TEST nginx (DRY-RUN).")
    lines.append(f"# Generated: {day}")
    lines.append("# This file is advisory only. It is NOT loaded by nginx.")
    lines.append("# Active deny list in EC2: /etc/nginx/deny-test-ips.conf")
    lines.append("#")
    lines.append("# Format mirrors nginx syntax to simplify manual review:")
    lines.append("#   deny <IP>;  # carril=<A|B> expires_at=<YYYY-MM-DD> reasons=...")
    lines.append("")

    blocks = [d for d in decisions if d.action == "block_proposed"]
    blocks.sort(key=lambda d: (d.carril, d.ip))

    if not blocks:
        lines.append("# No IPs proposed for blocking on this date.")
    else:
        for d in blocks:
            reasons = "; ".join(d.reasons)
            lines.append(
                f"deny {d.ip};  # carril={d.carril} expires_at={d.expires_at} "
                f"classification={d.classification} reasons=[{reasons}]"
            )

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_diff_report(
    path: Path,
    decisions: List[Decision],
    day: str,
    allowlist: Allowlist,
    nginx_result: Optional[dict] = None,
) -> None:
    is_real_mode = nginx_result is not None
    mode_label = "REAL carril_A" if is_real_mode else "DRY-RUN"

    lines: List[str] = []
    lines.append(f"TEST access blocker diff - {day} ({mode_label})")
    lines.append("")
    lines.append(f"IPs evaluadas: {len(decisions)}")
    lines.append(
        f"Carril A (block_proposed TTL largo): "
        f"{sum(1 for d in decisions if d.carril == 'A' and d.action == 'block_proposed')}"
    )
    lines.append(
        f"Carril B (block_proposed TTL medio): "
        f"{sum(1 for d in decisions if d.carril == 'B' and d.action == 'block_proposed')}"
    )
    lines.append(
        f"Carril C (observar): "
        f"{sum(1 for d in decisions if d.carril == 'C' and d.action == 'observe')}"
    )
    lines.append(
        f"Allowlisted (skip): "
        f"{sum(1 for d in decisions if d.action == 'skip_allowlisted')}"
    )
    lines.append("")
    lines.append(
        f"Allowlist cargada: {len(allowlist.ips)} IPs + {len(allowlist.networks)} CIDR"
    )

    if is_real_mode:
        lines.append("")
        lines.append("Resultado bloqueo real (Carril A):")
        if nginx_result["ok"]:
            lines.append(f"  estado: OK")
            lines.append(f"  ips_nuevas_carril_a: {nginx_result['ips_blocked']}")
            lines.append(f"  entradas_manuales_preservadas: {nginx_result.get('manual_entries_preserved', 0)}")
            lines.append(f"  nginx_test_antes: {nginx_result['nginx_test_before']}")
            lines.append(f"  nginx_test_despues: {nginx_result['nginx_test_after']}")
            lines.append(f"  backup: {nginx_result.get('backup_path') or 'n/a (fichero nuevo)'}")
            lines.append(f"  reload_nginx: ok")
        else:
            lines.append(f"  estado: ERROR")
            lines.append(f"  rollback: {'si' if nginx_result.get('rollback') else 'no (no llego a reemplazar)'}")
            lines.append(f"  nginx_test_antes: {nginx_result['nginx_test_before']}")
            lines.append(f"  nginx_test_despues: {nginx_result.get('nginx_test_after') or 'n/a'}")
            lines.append(f"  backup: {nginx_result.get('backup_path') or 'n/a'}")
            lines.append(f"  error: {nginx_result.get('error')}")

    lines.append("")
    lines.append("Decisiones por IP:")
    decisions_sorted = sorted(
        decisions,
        key=lambda d: (_carril_sort(d.carril, d.action), d.ip),
    )
    for d in decisions_sorted:
        reasons = "; ".join(d.reasons) if d.reasons else "n/a"
        ttl_str = f"ttl={d.ttl_days}d expires_at={d.expires_at}" if d.ttl_days else "ttl=n/a"
        lines.append(
            f"- {d.ip} | carril={d.carril} | action={d.action} | "
            f"classification={d.classification} | score={d.score} | "
            f"{ttl_str} | reasons=[{reasons}]"
        )

    lines.append("")
    lines.append("Nota:")
    if is_real_mode:
        lines.append("- Modo REAL: Carril A escrito en deny list live de nginx.")
        lines.append("- Carril B y Carril C: solo propuesta advisory, sin efecto en nginx.")
    else:
        lines.append("- Modo DRY-RUN: ningun cambio en nginx ni en deny list viva.")
    lines.append("- El estado persistente se mantiene en el STATE_FILE del componente.")

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def render_stdout_summary(
    decisions: List[Decision],
    day: str,
    nginx_result: Optional[dict] = None,
) -> str:
    a = sum(1 for d in decisions if d.carril == "A" and d.action == "block_proposed")
    b = sum(1 for d in decisions if d.carril == "B" and d.action == "block_proposed")
    c = sum(1 for d in decisions if d.carril == "C" and d.action == "observe")
    al = sum(1 for d in decisions if d.action == "skip_allowlisted")

    if nginx_result is None:
        return (
            f"[blocker DRY-RUN] {day} ips={len(decisions)} "
            f"carril_A={a} carril_B={b} carril_C={c} allowlisted={al}"
        )

    # Modo real: incluye resultado de la operacion nginx.
    if nginx_result["ok"]:
        nginx_str = (
            f"nginx_test_before={nginx_result['nginx_test_before']} "
            f"nginx_test_after={nginx_result['nginx_test_after']} "
            f"ips_bloqueadas={nginx_result['ips_blocked']} "
            f"reload=ok"
        )
    else:
        nginx_str = (
            f"nginx_test_before={nginx_result['nginx_test_before']} "
            f"nginx_test_after={nginx_result.get('nginx_test_after') or 'n/a'} "
            f"rollback={'si' if nginx_result.get('rollback') else 'no'} "
            f"error=[{nginx_result.get('error')}]"
        )

    return (
        f"[blocker REAL carril_A] {day} ips={len(decisions)} "
        f"carril_A={a} carril_B={b} carril_C={c} allowlisted={al} "
        f"{nginx_str}"
    )


def _carril_sort(carril: str, action: str) -> Tuple[int, int]:
    carril_rank = {"A": 0, "B": 1, "C": 2}.get(carril, 9)
    action_rank = 0 if action == "block_proposed" else (1 if action == "observe" else 2)
    return (carril_rank, action_rank)


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def parse_day(day: str) -> datetime:
    return datetime.strptime(day, "%Y-%m-%d").replace(tzinfo=timezone.utc)


if __name__ == "__main__":
    sys.exit(main())
