#!/usr/bin/env python3
"""
Motor 1 (ADR-061 "Facts as Code") — generador de hechos desde la fuente única.

Lee las fuentes de verdad (de momento pricing-tiers.yaml) y (re)genera los
BLOQUES MARCADOS de los docs/KB que las consumen. Los hechos no se teclean en
los docs: se generan. El bucle se cierra en runtime con un test de integración
que verifica que la fuente == lo que corre el sistema (ver PricingTiersSsotIT).

Bloques en los docs:
    <!-- BEGIN generated:pricing-tiers renderer=md-table (no editar a mano) -->
    ...contenido generado...
    <!-- END generated:pricing-tiers -->

Renderers disponibles: md-table (tabla markdown), kb-list (lista de hechos, estilo KB).

Uso:
    python3 build_facts.py            # reescribe los bloques en su sitio
    python3 build_facts.py --check    # NO escribe; exit 1 si algún bloque está desincronizado

Dependencia: PyYAML (pip install pyyaml). En CI el job 'facts-generation' lo instala.
"""
import os
import re
import sys

try:
    import yaml
except ImportError:
    print("ERROR: falta PyYAML. Instala con: pip install pyyaml", file=sys.stderr)
    sys.exit(2)

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
DATA_DIR = os.path.join(REPO_ROOT, "sharemechat-v1", "docs", "_data")

EXCLUDE_DIRS = {
    ".git", "node_modules", "target", "build", ".cache", ".idea",
    ".claude", "coverage", "test-results", "playwright-report",
    "_archive", "_audit", "_deprecated",
}

# Marcador genérico multi-dominio:
#   <!-- BEGIN generated:<domain> renderer=<r> ... -->  ...  <!-- END generated:<domain> -->
# El END debe casar el mismo <domain> (backreference).
BLOCK_RE = re.compile(
    r"(?P<begin><!--\s*BEGIN generated:(?P<domain>[\w-]+)\s+renderer=(?P<renderer>[\w-]+)[^>]*-->)"
    r"(?P<body>.*?)"
    r"(?P<end><!--\s*END generated:(?P=domain)\s*-->)",
    re.DOTALL,
)

# Bloques de código markdown. Un marcador mostrado como EJEMPLO dentro de ``` no
# es un bloque real (p. ej. en los README de tooling): se protege del procesado.
FENCE_RE = re.compile(r"```.*?```", re.DOTALL)


# --- Formato de números (convención ES) --------------------------------------
def eur_threshold(n):
    # 0 -> "0"; 1000 -> "1.000"; 15000 -> "15.000"
    return f"{int(n):,}".replace(",", ".")


def eur_rate(x):
    # 1.0 -> "1,00"; 3.0 -> "3,00"
    return f"{float(x):.2f}".replace(".", ",")


def eur_rate_plain(x):
    # 1.0 -> "1"; 3.0 -> "3"; 2.5 -> "2,50"  (euros enteros sin decimales)
    x = float(x)
    return str(int(x)) if x == int(x) else f"{x:.2f}".replace(".", ",")


def price_range(t):
    lo, hi = t["rate_first_eur"], t["rate_rest_eur"]
    if lo == hi:
        return f"{eur_rate_plain(lo)} €/min fijo"
    return f"{eur_rate_plain(lo)} – {eur_rate_plain(hi)} €/min"


# --- Renderers ----------------------------------------------------------------
def render_md_table(data):
    lines = [
        "| Tramo | Facturación bruta (rolling 30d) | % modelo | % empresa | Rango €/min |",
        "|---|---|---:|---:|---|",
    ]
    for t in data["tiers"]:
        share = t["model_share_pct"]
        lines.append(
            f"| {t['code']} | desde {eur_threshold(t['threshold_eur_30d'])} € | "
            f"{share}% | {100 - share}% | {price_range(t)} |"
        )
    return "\n".join(lines)


def render_kb_list(data):
    lines = [
        "- Cuatro tramos (régimen INDIVIDUAL): T1, T2, T3, T4. Así aparecen en la sección Estadísticas de la modelo.",
    ]
    for t in data["tiers"]:
        lines.append(
            f"- {t['code']}: umbral {eur_threshold(t['threshold_eur_30d'])} €/30d · "
            f"reparto {t['model_share_pct']}% · {eur_rate(t['rate_first_eur'])} €/min el primer minuto · "
            f"{eur_rate(t['rate_rest_eur'])} €/min el resto."
        )
    lines.append(
        "- El umbral es la facturación bruta de los últimos 30 días (ventana móvil); "
        "el tier se recalcula a diario y sube o baja solo al cruzar los umbrales."
    )
    lines.append(
        "- El Master (estudios) no tiene tramos propios: cobra la suma de los pagos "
        "individuales al % del tramo INDIVIDUAL de cada modelo."
    )
    return "\n".join(lines)


def render_modes_list(data):
    lines = []
    for m in data["modes"]:
        lines.append(f"- **{m['code']}**: {m['meaning']}")
    return "\n".join(lines)


# Registro de dominios: cada uno con su fichero fuente y sus renderers.
# El generador es genérico; añadir un dominio = una entrada aquí + su YAML.
DOMAINS = {
    "pricing-tiers": {
        "yaml": os.path.join(DATA_DIR, "pricing-tiers.yaml"),
        "renderers": {"md-table": render_md_table, "kb-list": render_kb_list},
    },
    "product-modes": {
        "yaml": os.path.join(DATA_DIR, "product-modes.yaml"),
        "renderers": {"modes-list": render_modes_list},
    },
}

# Caché de datos cargados por dominio.
_DATA_CACHE = {}


def load_domain(domain):
    if domain not in _DATA_CACHE:
        with open(DOMAINS[domain]["yaml"], "r", encoding="utf-8") as f:
            _DATA_CACHE[domain] = yaml.safe_load(f)
    return _DATA_CACHE[domain]


def iter_md(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for fn in filenames:
            if fn.lower().endswith(".md"):
                yield os.path.join(dirpath, fn)


def rel(path):
    return os.path.relpath(path, REPO_ROOT).replace(os.sep, "/")


def process(check):
    changed, errors, blocks = [], [], 0
    for path in sorted(iter_md(REPO_ROOT)):
        with open(path, "r", encoding="utf-8") as f:
            original = f.read()

        def repl(m):
            nonlocal blocks, errors
            blocks += 1
            domain = m.group("domain")
            renderer = m.group("renderer")
            spec = DOMAINS.get(domain)
            if spec is None:
                errors.append(f"{rel(path)}: dominio generado desconocido '{domain}'")
                return m.group(0)
            fn = spec["renderers"].get(renderer)
            if fn is None:
                errors.append(f"{rel(path)}: renderer '{renderer}' desconocido para dominio '{domain}'")
                return m.group(0)
            rendered = fn(load_domain(domain))
            return f"{m.group('begin')}\n{rendered}\n{m.group('end')}"

        # Proteger los fenced code blocks (marcadores de ejemplo) del procesado.
        fences = []

        def _stash(m):
            fences.append(m.group(0))
            return f"\x00FENCE{len(fences) - 1}\x00"

        protected = FENCE_RE.sub(_stash, original)
        new = BLOCK_RE.sub(repl, protected)
        for idx, frag in enumerate(fences):
            new = new.replace(f"\x00FENCE{idx}\x00", frag)
        if new != original:
            if check:
                changed.append(rel(path))
            else:
                with open(path, "w", encoding="utf-8", newline="\n") as f:
                    f.write(new)
                changed.append(rel(path))
    return blocks, changed, errors


def main():
    check = "--check" in sys.argv[1:]

    blocks, changed, errors = process(check)

    print("=== Motor 1 :: generación de hechos (" + ", ".join(sorted(DOMAINS)) + ") ===")
    print(f"bloques generados encontrados: {blocks}")
    if errors:
        for e in errors:
            print("  ERROR: " + e)
        return 2
    if check:
        if changed:
            print(f"DESINCRONIZADO: {len(changed)} fichero(s) con bloques que no cuadran con la fuente:")
            for c in changed:
                print("  " + c)
            print("Corre 'python3 build_facts.py' y commitea el resultado.")
            return 1
        print("OK: todos los bloques coinciden con la fuente.")
        return 0
    if changed:
        print(f"reescritos {len(changed)} fichero(s):")
        for c in changed:
            print("  " + c)
    else:
        print("sin cambios.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
