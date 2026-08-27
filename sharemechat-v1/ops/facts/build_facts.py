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
PRICING_YAML = os.path.join(REPO_ROOT, "sharemechat-v1", "docs", "_data", "pricing-tiers.yaml")

EXCLUDE_DIRS = {
    ".git", "node_modules", "target", "build", ".cache", ".idea",
    ".claude", "coverage", "test-results", "playwright-report",
    "_archive", "_audit", "_deprecated",
}

BLOCK_RE = re.compile(
    r"(<!--\s*BEGIN generated:pricing-tiers\s+renderer=(?P<renderer>[\w-]+)[^>]*-->)"
    r"(?P<body>.*?)"
    r"(<!--\s*END generated:pricing-tiers\s*-->)",
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


RENDERERS = {
    "md-table": render_md_table,
    "kb-list": render_kb_list,
}


def iter_md(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for fn in filenames:
            if fn.lower().endswith(".md"):
                yield os.path.join(dirpath, fn)


def rel(path):
    return os.path.relpath(path, REPO_ROOT).replace(os.sep, "/")


def process(data, check):
    changed, errors, blocks = [], [], 0
    for path in sorted(iter_md(REPO_ROOT)):
        with open(path, "r", encoding="utf-8") as f:
            original = f.read()

        def repl(m):
            nonlocal blocks, errors
            blocks += 1
            renderer = m.group("renderer")
            fn = RENDERERS.get(renderer)
            if fn is None:
                errors.append(f"{rel(path)}: renderer desconocido '{renderer}'")
                return m.group(0)
            rendered = fn(data)
            return f"{m.group(1)}\n{rendered}\n{m.group(4)}"

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
    with open(PRICING_YAML, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    blocks, changed, errors = process(data, check)

    print("=== Motor 1 :: generación de hechos (pricing-tiers) ===")
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
