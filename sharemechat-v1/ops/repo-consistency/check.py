#!/usr/bin/env python3
"""
Motor 2 (ADR-061 "Facts as Code") — detector de podredumbre repo-wide.

Vigila lo que NO se puede generar (prosa: docs, ADRs, KB, READMEs). No reescribe
nada: detecta incoherencias y hace fallar el CI para que la podredumbre no se
acumule en silencio. Cubre TODO el repo desde el primer dia.

Checks (cada hallazgo lleva un fingerprint estable para el ratchet de baseline):
  A. Enlaces markdown internos rotos            -> [text](ruta) cuyo destino no existe.
  B. Referencias a rutas del repo inexistentes  -> `ruta/con/extension` en backticks que no existe.
  C. Patrones caducados fuera de _archive/      -> lista curada en stale-patterns.txt.
  D. Integridad de ADRs                          -> ADR-NNN referenciado sin fichero; numeros duplicados.

Ratchet: los hallazgos ya existentes se congelan en baseline.txt (--write-baseline).
El CI solo falla ante hallazgos NUEVOS (no presentes en baseline). El baseline solo
puede menguar: la deuda existente no bloquea a nadie, pero no se puede crear mas.

Uso:
  python check.py                 # verifica; exit 1 si hay hallazgos nuevos
  python check.py --write-baseline  # congela los hallazgos actuales como aceptados
  python check.py --all             # lista TODOS los hallazgos (incl. baselined)

Sin dependencias externas (stdlib). Pensado para correr en CI (ubuntu, python3).
"""
import os
import re
import sys

# --- Localizacion de raices --------------------------------------------------
# El script vive en <repo>/sharemechat-v1/ops/repo-consistency/check.py
HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
CONFIG_DIR = HERE
STALE_FILE = os.path.join(CONFIG_DIR, "stale-patterns.txt")
BASELINE_FILE = os.path.join(CONFIG_DIR, "baseline.txt")

# Directorios que nunca se escanean. _archive/ y _audit/ son historia congelada
# por diseno (la regla "borrar-no-marcar" del ADR-061 manda ahi lo caducado):
# no se vigilan ni sus enlaces ni sus patrones.
EXCLUDE_DIRS = {
    ".git", "node_modules", "target", "build", ".cache", ".idea",
    ".claude", "coverage", "test-results", "playwright-report",
    "_archive", "_audit", "_deprecated",
}

# Referencia a linea de codigo escrita como enlace: Foo.java:123 o Foo.jsx:12:5.
LINENUM_SUFFIX_RE = re.compile(r":\d+(?::\d+)?$")

MD_EXT = (".md",)
# Extensiones que consideramos "ruta de fichero del repo" en el check B.
PATHY_EXT = (
    ".java", ".jsx", ".js", ".ts", ".tsx", ".sql", ".ps1", ".sh", ".py",
    ".md", ".yaml", ".yml", ".properties", ".json", ".xml", ".css", ".html",
)
# Prefijos que delatan una ruta del repo (para no marcar URLs ni texto suelto).
PATHY_PREFIXES = (
    "sharemechat-v1/", "src/", "ops/", "docs/", "frontend/", ".github/",
    "support-kb/", "db/migration/",
)

LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+)\)")
BACKTICK_RE = re.compile(r"`([^`]+)`")
ADR_REF_RE = re.compile(r"\bADR-(\d{3})\b", re.IGNORECASE)
ADR_FILE_RE = re.compile(r"^adr-(\d{3})-.*\.md$", re.IGNORECASE)


def iter_files(root, exts):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for fn in filenames:
            if fn.lower().endswith(exts):
                yield os.path.join(dirpath, fn)


def rel(path):
    return os.path.relpath(path, REPO_ROOT).replace(os.sep, "/")


def read_lines(path):
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.read().splitlines()


class Finding:
    __slots__ = ("check", "file", "line", "msg", "fp")

    def __init__(self, check, file, line, msg, fp):
        self.check = check
        self.file = file
        self.line = line
        self.msg = msg
        self.fp = fp

    def render(self):
        return f"[{self.check}] {self.file}:{self.line}  {self.msg}"


def path_exists(candidate):
    """True si 'candidate' existe relativo a REPO_ROOT o a sharemechat-v1/."""
    c = candidate.strip().lstrip("/")
    for base in (REPO_ROOT, os.path.join(REPO_ROOT, "sharemechat-v1")):
        if os.path.exists(os.path.join(base, c)):
            return True
    return False


# --- Check A: enlaces markdown internos rotos --------------------------------
def check_links(md_files):
    out = []
    for path in md_files:
        base = os.path.dirname(path)
        for i, line in enumerate(read_lines(path), 1):
            # Un [x](y) dentro de un code span `...` es un ejemplo, no un enlace
            # activo: se neutraliza antes de buscar enlaces (evita falsos positivos
            # en docs que muestran sintaxis markdown).
            scan = re.sub(r"`[^`]*`", " ", line)
            for m in LINK_RE.finditer(scan):
                target = m.group(1).strip()
                # Ignorar enlaces externos, anchors puros, mailto, imagenes data.
                low = target.lower()
                if (low.startswith(("http://", "https://", "mailto:", "#", "tel:", "data:"))
                        or not target):
                    continue
                # Quitar anchor y query.
                clean = target.split("#", 1)[0].split("?", 1)[0].strip()
                clean = LINENUM_SUFFIX_RE.sub("", clean)
                if not clean:
                    continue
                # 1) relativo al fichero (convencion markdown estandar).
                resolved = os.path.normpath(os.path.join(base, clean))
                if os.path.exists(resolved):
                    continue
                # 2) tolerancia: rutas escritas desde la raiz del repo o desde
                #    sharemechat-v1/ (patron frecuente en estos docs).
                if path_exists(clean):
                    continue
                r = rel(path)
                out.append(Finding("A", r, i,
                                   f"enlace roto -> {target}",
                                   f"A|{r}|{clean}"))
    return out


# --- Check B: rutas del repo inexistentes en backticks -----------------------
def check_paths(md_files):
    out = []
    for path in md_files:
        for i, line in enumerate(read_lines(path), 1):
            for m in BACKTICK_RE.finditer(line):
                tok = m.group(1).strip()
                if " " in tok or "/" not in tok:
                    continue
                # Placeholders / globs no son rutas reales: <env>, {a,b,c}, *, ?
                if any(ch in tok for ch in "<>{}*?"):
                    continue
                low = tok.lower()
                if low.startswith(("http://", "https://")):
                    continue
                if not tok.startswith(PATHY_PREFIXES):
                    continue
                # Debe parecer un fichero (con extension conocida) o un dir.
                cand = LINENUM_SUFFIX_RE.sub("", tok).rstrip("/")
                is_file = cand.lower().endswith(PATHY_EXT)
                if not is_file and not tok.endswith("/"):
                    continue
                if not path_exists(cand):
                    r = rel(path)
                    out.append(Finding("B", r, i,
                                       f"ruta inexistente -> {tok}",
                                       f"B|{r}|{cand}"))
    return out


# --- Check C: patrones caducados fuera de _archive/ --------------------------
def load_stale_patterns():
    pats = []
    if not os.path.exists(STALE_FILE):
        return pats
    for raw in read_lines(STALE_FILE):
        s = raw.strip()
        if not s or s.startswith("#"):
            continue
        try:
            pats.append((s, re.compile(s, re.IGNORECASE)))
        except re.error as e:
            print(f"WARN: patron invalido en stale-patterns.txt: {s} ({e})",
                  file=sys.stderr)
    return pats


def check_stale(md_files, patterns):
    out = []
    if not patterns:
        return out
    for path in md_files:
        for i, line in enumerate(read_lines(path), 1):
            for src, rx in patterns:
                if rx.search(line):
                    r = rel(path)
                    out.append(Finding("C", r, i,
                                       f"patron caducado ('{src}') fuera de _archive/",
                                       f"C|{r}|{src}"))
    return out


# --- Check D: integridad de ADRs ---------------------------------------------
def check_adrs(md_files):
    out = []
    decisions_dir = os.path.join(REPO_ROOT, "sharemechat-v1", "docs", "06-decisions")
    existing = {}
    dupes = []
    if os.path.isdir(decisions_dir):
        for fn in os.listdir(decisions_dir):
            m = ADR_FILE_RE.match(fn)
            if m:
                num = m.group(1)
                if num in existing:
                    dupes.append((num, fn, existing[num]))
                else:
                    existing[num] = fn
    for num, fn, prev in dupes:
        out.append(Finding("D", "sharemechat-v1/docs/06-decisions/", 0,
                           f"numero ADR duplicado: {num} ({fn} y {prev})",
                           f"D|dup|{num}"))
    for path in md_files:
        for i, line in enumerate(read_lines(path), 1):
            for m in ADR_REF_RE.finditer(line):
                num = m.group(1)
                if num not in existing:
                    r = rel(path)
                    out.append(Finding("D", r, i,
                                       f"referencia a ADR-{num} sin fichero en 06-decisions/",
                                       f"D|ref|{num}"))
    return out


def load_baseline():
    if not os.path.exists(BASELINE_FILE):
        return set()
    return {l.strip() for l in read_lines(BASELINE_FILE)
            if l.strip() and not l.strip().startswith("#")}


def main():
    args = set(sys.argv[1:])
    md_files = sorted(iter_files(REPO_ROOT, MD_EXT))

    findings = []
    findings += check_links(md_files)
    findings += check_paths(md_files)
    findings += check_stale(md_files, load_stale_patterns())
    findings += check_adrs(md_files)

    if "--write-baseline" in args:
        fps = sorted({f.fp for f in findings})
        with open(BASELINE_FILE, "w", encoding="utf-8", newline="\n") as fh:
            fh.write("# Motor 2 baseline (ADR-061). Hallazgos preexistentes aceptados.\n")
            fh.write("# Solo puede menguar: no se anaden nuevos a mano. Regenerar con --write-baseline.\n")
            for fp in fps:
                fh.write(fp + "\n")
        print(f"baseline escrito: {len(fps)} hallazgos congelados en {rel(BASELINE_FILE)}")
        return 0

    baseline = load_baseline()
    show_all = "--all" in args
    new = [f for f in findings if f.fp not in baseline]
    shown = findings if show_all else new

    by_check = {}
    for f in shown:
        by_check.setdefault(f.check, []).append(f)

    total_new = len(new)
    print("=== Motor 2 :: consistencia del repo ===")
    print(f"ficheros .md escaneados: {len(md_files)}")
    print(f"hallazgos totales: {len(findings)}  |  en baseline: {len(findings) - total_new}  |  NUEVOS: {total_new}")
    print("")
    if not shown:
        print("OK: sin hallazgos nuevos.")
        return 0
    for check in sorted(by_check):
        print(f"--- Check {check} ({len(by_check[check])}) ---")
        for f in by_check[check]:
            print("  " + f.render())
        print("")
    if show_all:
        return 0
    print(f"FALLO: {total_new} hallazgo(s) NUEVO(s). Arregla, o si es deuda aceptada corre --write-baseline.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
