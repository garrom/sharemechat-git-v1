# ops/_governance

Scripts de gobernanza y validacion para el pipeline perimetral de auditoria de accesos.

Todos los scripts son **solo lectura**: no modifican ficheros, no crean recursos, no recargan servicios.

---

## Scripts disponibles

### `check_ops_consistency.py` — validacion del repositorio

Valida que la estructura de `ops/` sea consistente entre AUDIT y TEST **a nivel de ficheros del repositorio**. No requiere acceso a EC2 ni a ningun servicio externo.

**Que valida:**

| Regla | Descripcion |
|-------|-------------|
| Paridad de componentes | Por cada `audit-access-X/` debe existir `test-access-X/` |
| README obligatorio | Cada componente debe tener `README.md` |
| Estructura interna | `bin/`, `lib/`, `config/` presentes en ambos lados |
| `systemd/` opcional | Asimetria entre AUDIT y TEST → WARNING |
| Equivalencia de scripts | `bin/*-audit-*.sh` ↔ `bin/*-test-*.sh` |
| `config.env.example` | Obligatorio si `config/` existe |
| Ficheros extra en config | Asimetria entre lados → WARNING |

**Uso:**

```bash
# Desde la raiz del repositorio:
python ops/_governance/check_ops_consistency.py

# Desde el directorio _governance:
python check_ops_consistency.py
```

**Exit codes:** `0` sin errores (puede haber warnings), `1` si hay errores.

---

### `check_ops_runtime.sh` — validacion del estado real en EC2

Valida el estado operativo **real en una EC2 concreta** (AUDIT o TEST). Debe ejecutarse directamente en la instancia EC2 objetivo. No tiene sentido ejecutarlo en entorno de desarrollo local.

**Que valida:**

| Regla | Descripcion |
|-------|-------------|
| Config existe | `/etc/sharemechat-<env>-access-blocker/config.env` |
| DRY_RUN correcto | AUDIT debe tener `DRY_RUN=0`; TEST debe tener `DRY_RUN=1` |
| Timer enabled + active | `sharemechat-<env>-access-blocker.timer` |
| Service cargado | `sharemechat-<env>-access-blocker.service` |
| Salidas del dia anterior | `.blocker-diff.txt`, `.proposed.conf`, `.ips.json` |
| State file JSON valido | `/var/lib/sharemechat-<env>-access-blocker/ips.json` |
| `nginx -t` | Configuracion nginx valida (solo lectura) |
| Deny files nginx | Live y manual; severidad distinta segun entorno |
| Proxima ejecucion timer | `systemctl list-timers` |
| Journal reciente | Ultimas 20 lineas del service |

**Uso:**

```bash
# Entorno explicito (recomendado):
bash ops/_governance/check_ops_runtime.sh audit
bash ops/_governance/check_ops_runtime.sh test

# Deteccion automatica (si solo un entorno esta configurado en /etc/):
bash ops/_governance/check_ops_runtime.sh
```

**Exit codes:** `0` sin errores (puede haber warnings), `1` si hay errores.

**Nota sobre permisos:** algunas comprobaciones (`nginx -t`, `journalctl`) pueden requerir `sudo` en funcion de la configuracion del sistema. El script informa cuando detecta un fallo por permisos en lugar de marcar error.

---

## Diferencia clave entre los dos scripts

| | `check_ops_consistency.py` | `check_ops_runtime.sh` |
|-|---------------------------|------------------------|
| **Ambito** | Repositorio (ficheros versionados) | EC2 real (estado operativo) |
| **Donde ejecutar** | Maquina de desarrollo / CI | EC2 AUDIT o EC2 TEST |
| **Que detecta** | Falta de paridad estructural entre AUDIT y TEST | Problemas operativos reales (timer caido, DRY_RUN incorrecto, salidas ausentes) |
| **Dependencias** | Python 3 | Bash, systemctl, journalctl, nginx, python3 |
| **Frecuencia tipica** | En cada PR o push a `ops/` | Ad-hoc ante incidencia o como comprobacion diaria manual |

---

## Reglas de severidad por entorno

| Condicion | AUDIT | TEST |
|-----------|-------|------|
| `DRY_RUN=1` | ERROR (debe ser 0) | OK |
| `DRY_RUN=0` | OK | ERROR (debe ser 1) |
| deny live ausente | ERROR | WARNING informativo |
| deny manual ausente | WARNING | OK (esperado en DRY_RUN) |
| salidas del dia ausentes | WARNING | WARNING |

---

## Cuando ejecutar `check_ops_runtime.sh`

- Despues de cualquier cambio en configuracion del blocker en EC2
- Tras un cambio de `DRY_RUN` (especialmente la transicion a modo real)
- Cuando el timer no ha corrido en el horario esperado
- Como comprobacion rapida tras una incidencia o reinicio de EC2
- Antes de evaluar el paso a `DRY_RUN=0` en TEST
