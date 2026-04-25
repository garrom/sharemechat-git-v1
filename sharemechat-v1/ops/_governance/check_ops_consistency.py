#!/usr/bin/env python3
"""
ops/_governance/check_ops_consistency.py

Governance script: validates consistency between AUDIT and TEST components
under ops/. Read-only — modifies nothing, creates nothing, deletes nothing.

Usage:
    python ops/_governance/check_ops_consistency.py

    or from this directory:
    python check_ops_consistency.py

Exit codes:
    0 — no errors (warnings may be present)
    1 — one or more errors found
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import List, Set

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

# ops/ root is one level above this script's directory (_governance/).
OPS_ROOT = Path(__file__).resolve().parent.parent

# Subdirectories required in every fully-structured component.
REQUIRED_SUBDIRS: List[str] = ["bin", "lib", "config"]

# systemd/ is optional; asymmetry between AUDIT and TEST → WARNING.
OPTIONAL_SUBDIRS: List[str] = ["systemd"]


# ---------------------------------------------------------------------------
# Discovery
# ---------------------------------------------------------------------------

def discover_audit_suffixes() -> List[str]:
    """
    Finds all directories under ops/ named 'audit-access-<suffix>'
    where <suffix> is non-empty (excludes the umbrella 'audit-access/').
    Returns sorted list of suffixes.
    """
    suffixes: List[str] = []
    for path in sorted(OPS_ROOT.iterdir()):
        if not path.is_dir():
            continue
        name = path.name
        if name.startswith("audit-access-"):
            suffix = name[len("audit-access-"):]
            if suffix:
                suffixes.append(suffix)
    return suffixes


# ---------------------------------------------------------------------------
# Per-component validation
# ---------------------------------------------------------------------------

def check_component(
    suffix: str,
    ok: List[str],
    errors: List[str],
    warnings: List[str],
) -> None:
    a_dir = OPS_ROOT / f"audit-access-{suffix}"
    t_dir = OPS_ROOT / f"test-access-{suffix}"
    label = f"[{suffix}]"

    # ------------------------------------------------------------------
    # Rule 1: Paridad de componentes
    # test-access-{suffix}/ debe existir si audit-access-{suffix}/ existe.
    # ------------------------------------------------------------------
    if not t_dir.exists():
        errors.append(
            f"{label} test-access-{suffix}/ no existe "
            f"(sin paridad con audit-access-{suffix}/)"
        )
        # Sin directorio no tiene sentido validar el resto.
        return
    ok.append(f"{label} test-access-{suffix}/ existe (paridad OK)")

    # ------------------------------------------------------------------
    # Rule 2: README obligatorio en ambos lados.
    # ------------------------------------------------------------------
    for env, comp_dir in [("audit", a_dir), ("test", t_dir)]:
        readme = comp_dir / "README.md"
        if readme.exists():
            ok.append(f"{label} {env}-access-{suffix}/README.md presente")
        else:
            errors.append(f"{label} {env}-access-{suffix}/README.md falta")

    # ------------------------------------------------------------------
    # Rule 3: Subdirectorios obligatorios (bin/, lib/, config/).
    # Si uno tiene y el otro no → ERROR.
    # Si ninguno tiene → no se puntua (no es obligatorio universalmente).
    # ------------------------------------------------------------------
    for subdir in REQUIRED_SUBDIRS:
        a_has = (a_dir / subdir).is_dir()
        t_has = (t_dir / subdir).is_dir()
        if a_has and t_has:
            ok.append(f"{label} {subdir}/ presente en ambos")
        elif a_has and not t_has:
            errors.append(
                f"{label} test-access-{suffix}/{subdir}/ falta "
                f"(presente en audit-access-{suffix}/)"
            )
        elif not a_has and t_has:
            errors.append(
                f"{label} audit-access-{suffix}/{subdir}/ falta "
                f"(presente en test-access-{suffix}/)"
            )
        # Ambos ausentes: sin puntuacion ni error.

    # ------------------------------------------------------------------
    # Rule 3b: systemd/ opcional — asimetria → WARNING.
    # ------------------------------------------------------------------
    a_has_sys = (a_dir / "systemd").is_dir()
    t_has_sys = (t_dir / "systemd").is_dir()
    if a_has_sys and t_has_sys:
        ok.append(f"{label} systemd/ presente en ambos")
    elif a_has_sys and not t_has_sys:
        warnings.append(
            f"{label} systemd/ en audit-access-{suffix}/ pero no en "
            f"test-access-{suffix}/ "
            f"(units operativas en EC2 TEST pero no versionadas en el repo)"
        )
    elif not a_has_sys and t_has_sys:
        warnings.append(
            f"{label} systemd/ en test-access-{suffix}/ pero no en "
            f"audit-access-{suffix}/"
        )
    # Ambos ausentes: simetrico, sin puntuacion.

    # ------------------------------------------------------------------
    # Rule 4: Equivalencia de scripts en bin/.
    # Patron de traduccion: -audit- → -test- en el nombre del fichero.
    # Se comprueban ambas direcciones para detectar scripts huerfanos.
    # ------------------------------------------------------------------
    a_bin = a_dir / "bin"
    t_bin = t_dir / "bin"

    # AUDIT → TEST
    a_scripts: Set[str] = set()
    if a_bin.is_dir():
        for script in sorted(a_bin.iterdir()):
            if not script.is_file():
                continue
            a_scripts.add(script.name)
            expected_test_name = script.name.replace("-audit-", "-test-")
            if expected_test_name == script.name:
                # Nombre sin patron '-audit-': validar que existe el mismo en TEST.
                t_counterpart = t_bin / script.name if t_bin.is_dir() else None
                if t_counterpart and t_counterpart.exists():
                    ok.append(
                        f"{label} bin/{script.name} presente en ambos"
                    )
                else:
                    warnings.append(
                        f"{label} bin/{script.name} en audit pero no "
                        f"en test (nombre sin patron -audit-, revision manual)"
                    )
            else:
                t_counterpart = t_bin / expected_test_name if t_bin.is_dir() else None
                if t_counterpart and t_counterpart.exists():
                    ok.append(
                        f"{label} bin/{script.name} "
                        f"<-> bin/{expected_test_name} (par completo)"
                    )
                else:
                    errors.append(
                        f"{label} bin/{script.name} existe en audit "
                        f"pero bin/{expected_test_name} falta en test"
                    )

    # TEST → AUDIT (detectar scripts huerfanos en TEST)
    if t_bin.is_dir():
        for script in sorted(t_bin.iterdir()):
            if not script.is_file():
                continue
            expected_audit_name = script.name.replace("-test-", "-audit-")
            if expected_audit_name == script.name:
                if script.name not in a_scripts and not (a_bin / script.name).exists():
                    warnings.append(
                        f"{label} bin/{script.name} en test pero no "
                        f"en audit (nombre sin patron -test-, revision manual)"
                    )
            else:
                if not (a_bin / expected_audit_name).exists():
                    errors.append(
                        f"{label} bin/{script.name} existe en test "
                        f"pero bin/{expected_audit_name} falta en audit"
                    )

    # ------------------------------------------------------------------
    # Rule 5: config.env.example obligatorio si config/ existe.
    # ------------------------------------------------------------------
    for env, comp_dir in [("audit", a_dir), ("test", t_dir)]:
        cfg_dir = comp_dir / "config"
        if cfg_dir.is_dir():
            cfg_example = cfg_dir / "config.env.example"
            if cfg_example.exists():
                ok.append(
                    f"{label} {env}-access-{suffix}/config/config.env.example presente"
                )
            else:
                errors.append(
                    f"{label} {env}-access-{suffix}/config/config.env.example falta"
                )

    # ------------------------------------------------------------------
    # Rule 5b: Ficheros extra en config/ — asimetria → WARNING.
    # (Ej: allowlist.conf.example presente en blocker de ambos lados.)
    # ------------------------------------------------------------------
    a_cfg_dir = a_dir / "config"
    t_cfg_dir = t_dir / "config"
    if a_cfg_dir.is_dir() and t_cfg_dir.is_dir():
        a_cfg_files = {f.name for f in a_cfg_dir.iterdir() if f.is_file()}
        t_cfg_files = {f.name for f in t_cfg_dir.iterdir() if f.is_file()}
        # Excluir config.env.example (ya validado arriba).
        for fname in sorted(a_cfg_files - t_cfg_files - {"config.env.example"}):
            warnings.append(
                f"{label} config/{fname} en audit-access-{suffix}/ "
                f"pero no en test-access-{suffix}/"
            )
        for fname in sorted(t_cfg_files - a_cfg_files - {"config.env.example"}):
            warnings.append(
                f"{label} config/{fname} en test-access-{suffix}/ "
                f"pero no en audit-access-{suffix}/"
            )


# ---------------------------------------------------------------------------
# Umbrella README validation
# ---------------------------------------------------------------------------

def check_umbrellas(
    ok: List[str],
    errors: List[str],
    warnings: List[str],
) -> None:
    """
    Validates that the umbrella README files exist:
      ops/audit-access/README.md
      ops/test-access/README.md
    """
    for env in ["audit", "test"]:
        umbrella = OPS_ROOT / f"{env}-access"
        readme = umbrella / "README.md"
        if readme.exists():
            ok.append(f"[umbrella] {env}-access/README.md presente")
        else:
            errors.append(f"[umbrella] {env}-access/README.md falta")


# ---------------------------------------------------------------------------
# Report rendering
# ---------------------------------------------------------------------------

def print_report(
    ok: List[str],
    errors: List[str],
    warnings: List[str],
) -> None:
    width = 60
    print("=" * width)
    print("OPS CONSISTENCY CHECK")
    print(f"ops/ root: {OPS_ROOT}")
    print("=" * width)

    if ok:
        print("\nOK:")
        for msg in ok:
            print(f"  - {msg}")

    if errors:
        print("\nERROR:")
        for msg in errors:
            print(f"  - {msg}")

    if warnings:
        print("\nWARNING:")
        for msg in warnings:
            print(f"  - {msg}")

    print(f"\nSUMMARY:")
    print(f"  errors={len(errors)} warnings={len(warnings)}")
    print("=" * width)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> int:
    ok: List[str] = []
    errors: List[str] = []
    warnings: List[str] = []

    # Validate umbrella READMEs.
    check_umbrellas(ok, errors, warnings)

    # Discover and validate per-component consistency.
    suffixes = discover_audit_suffixes()
    if not suffixes:
        errors.append(
            "No se encontraron componentes audit-access-X bajo ops/ — "
            f"verificar que OPS_ROOT es correcto: {OPS_ROOT}"
        )
    else:
        for suffix in suffixes:
            check_component(suffix, ok, errors, warnings)

    print_report(ok, errors, warnings)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
