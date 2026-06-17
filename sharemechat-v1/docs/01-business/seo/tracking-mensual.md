# Tracking mensual de KPIs — SEO / tráfico orgánico

Sistema de registro mes a mes para comparar la realidad operativa contra el plan pesimista de [`estrategia.md`](estrategia.md) (§ 4 y § 5). El objetivo es detectar drift tan pronto como sea posible y disparar la revisión de estrategia cuando los KPIs reales se separen del plan, no esperar 18 meses para verificar la hipótesis.

## Cuándo se actualiza

Cada **domingo de revisión semanal** (playbook P7 del calendario operativo del operador). La columna "real" del mes en curso se rellena con los datos cerrados de los últimos 28 días al momento de la revisión.

## Quién lo actualiza

El operador, manualmente. Los datos no se ingestan desde el repo: requieren login en Google Search Console, GA4 y los perfiles sociales.

## Dónde encontrar los datos

| KPI | Fuente | Ruta exacta |
|---|---|---|
| Impresiones, Clics, CTR medio, Posición media | Google Search Console | Rendimiento → Resultados de búsqueda → últimos 28 días |
| Sesiones GA4 total, % Sesiones Organic Search | Google Analytics 4 | Acquisition → Traffic acquisition → últimos 28 días |
| Followers X | Perfil público X | `https://x.com/shareme_chat` (contador en bio) |
| Karma Reddit (comment + post) | Perfil público Reddit | `https://reddit.com/user/sharemechat` (suma) |
| Miembros r/SharemeChat | Perfil del sub propio | `https://reddit.com/r/SharemeChat` (barra lateral) |
| Aportes X / Promos X publicados ese mes | Ledger interno | Conteo desde `docs/social/social-state.json` cruzado con el feed `@shareme_chat` |
| Artículos blog publicados ese mes | Repo + GSC | `git log --since` sobre `docs/cms/` o conteo de PUBLISHED en GSC |

## Convención de rellenado

- **"—"**: el documento de estrategia no proyecta este KPI para este mes. Dejar vacío en la columna "real" hasta que haya dato real.
- **Valor numérico (plan)**: copiado textualmente del documento de estrategia donde lo da explícito. Cualquier valor con sufijo `(ref)` viene de un anclaje cualitativo del doc (p.ej. "posición media debe pasar de 30 → 15 → 8 → 5 en 12 meses") y se ha asignado al mes que el doc menciona explícitamente.
- **Columna "real"**: vacía. La rellena el operador en cada revisión semanal P7.

---

## Tabla 1 — SEO Google (GSC)

Plan pesimista de `estrategia.md` § 5: impresiones deben crecer 20-30% mes a mes desde M3; posición media baja de 30 → 15 → 8 → 5 a lo largo de 12 meses. El documento no proyecta valores absolutos mensuales para impresiones, clics ni CTR.

| Mes | Impresiones plan | Impresiones real | Clics plan | Clics real | CTR % plan | CTR % real | Posición media plan | Posición media real |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Jun 2026 (M0)  | — | | — | | — | | — | |
| Jul 2026 (M1)  | — | | — | | — | | — | |
| Ago 2026 (M2)  | — | | — | | — | | — | |
| Sep 2026 (M3)  | — | | — | | — | | ~30 (ref) | |
| Oct 2026 (M4)  | — | | — | | — | | — | |
| Nov 2026 (M5)  | — | | — | | — | | — | |
| Dic 2026 (M6)  | — | | — | | — | | ~15 (ref) | |
| Ene 2027 (M7)  | — | | — | | — | | — | |
| Feb 2027 (M8)  | — | | — | | — | | — | |
| Mar 2027 (M9)  | — | | — | | — | | ~8 (ref) | |
| Abr 2027 (M10) | — | | — | | — | | — | |
| May 2027 (M11) | — | | — | | — | | — | |
| Jun 2027 (M12) | — | | — | | — | | ~5 (ref) | |
| Jul 2027 (M13) | — | | — | | — | | — | |
| Ago 2027 (M14) | — | | — | | — | | — | |
| Sep 2027 (M15) | — | | — | | — | | — | |
| Oct 2027 (M16) | — | | — | | — | | — | |
| Nov 2027 (M17) | — | | — | | — | | — | |
| Dic 2027 (M18) | — | | — | | — | | — | |

---

## Tabla 2 — Tráfico y conversión (GA4)

Plan pesimista de `estrategia.md` § 4 (tabla pesimista, columna Sesiones) y § 5 (la cuota Organic debe pasar de 5% a 30% en 12 meses).

| Mes | Fase | Sesiones plan | Sesiones real | % Organic plan | % Organic real |
|---|---|---:|---:|---:|---:|
| Jun 2026 (M0)  | F1 |   100 | | 5% (ref) | |
| Jul 2026 (M1)  | F1 |   150 | | — | |
| Ago 2026 (M2)  | F1 |   200 | | — | |
| Sep 2026 (M3)  | F1 |   300 | | — | |
| Oct 2026 (M4)  | F2 |   500 | | — | |
| Nov 2026 (M5)  | F2 |   700 | | — | |
| Dic 2026 (M6)  | F2 |   900 | | — | |
| Ene 2027 (M7)  | F3 | 1.200 | | — | |
| Feb 2027 (M8)  | F3 | 1.400 | | — | |
| Mar 2027 (M9)  | F3 | 1.600 | | — | |
| Abr 2027 (M10) | F3 | 1.800 | | — | |
| May 2027 (M11) | F3 | 2.100 | | — | |
| Jun 2027 (M12) | F3 | 2.500 | | 30% (ref) | |
| Jul 2027 (M13) | F4 | 3.000 | | — | |
| Ago 2027 (M14) | F4 | 3.500 | | — | |
| Sep 2027 (M15) | F4 | 4.000 | | — | |
| Oct 2027 (M16) | F4 | 4.500 | | — | |
| Nov 2027 (M17) | F4 | 5.000 | | — | |
| Dic 2027 (M18) | F4 | 5.500 | | — | |

---

## Tabla 3 — Social y contenido propio

`estrategia.md` no proyecta cifras absolutas mensuales para social ni para aportes/promos del pipeline (el doc razona en términos cualitativos: "Reddit como motor #2", "X como apoyo de marca"). El único dato cuantitativo claro es la cadencia editorial.

### 3a — Métricas sociales

| Mes | Followers X plan | Followers X real | Karma Reddit plan | Karma Reddit real | Miembros r/SharemeChat plan | Miembros real |
|---|---:|---:|---:|---:|---:|---:|
| Jun 2026 (M0)  | — | | — | | — | |
| Jul 2026 (M1)  | — | | — | | — | |
| Ago 2026 (M2)  | — | | — | | — | |
| Sep 2026 (M3)  | — | | — | | — | |
| Oct 2026 (M4)  | — | | — | | — | |
| Nov 2026 (M5)  | — | | — | | — | |
| Dic 2026 (M6)  | — | | — | | — | |
| Ene 2027 (M7)  | — | | — | | — | |
| Feb 2027 (M8)  | — | | — | | — | |
| Mar 2027 (M9)  | — | | — | | — | |
| Abr 2027 (M10) | — | | — | | — | |
| May 2027 (M11) | — | | — | | — | |
| Jun 2027 (M12) | — | | — | | — | |
| Jul 2027 (M13) | — | | — | | — | |
| Ago 2027 (M14) | — | | — | | — | |
| Sep 2027 (M15) | — | | — | | — | |
| Oct 2027 (M16) | — | | — | | — | |
| Nov 2027 (M17) | — | | — | | — | |
| Dic 2027 (M18) | — | | — | | — | |

### 3b — Actividad del pipeline propio

Plan: 4 artículos / mes (cadencia 1/semana, `estrategia.md` § 4 "Supuestos"). Aportes y promos X no tienen plan numérico mensual en el documento: dependen del estado del `social-phase-gate` (umbral promo-allowed: edad ≥ 7d + aportes ≥ 5).

| Mes | Aportes X plan | Aportes X real | Promos X plan | Promos X real | Artículos blog plan | Artículos blog real |
|---|---:|---:|---:|---:|---:|---:|
| Jun 2026 (M0)  | — | | — | | 4 | |
| Jul 2026 (M1)  | — | | — | | 4 | |
| Ago 2026 (M2)  | — | | — | | 4 | |
| Sep 2026 (M3)  | — | | — | | 4 | |
| Oct 2026 (M4)  | — | | — | | 4 | |
| Nov 2026 (M5)  | — | | — | | 4 | |
| Dic 2026 (M6)  | — | | — | | 4 | |
| Ene 2027 (M7)  | — | | — | | 4 | |
| Feb 2027 (M8)  | — | | — | | 4 | |
| Mar 2027 (M9)  | — | | — | | 4 | |
| Abr 2027 (M10) | — | | — | | 4 | |
| May 2027 (M11) | — | | — | | 4 | |
| Jun 2027 (M12) | — | | — | | 4 | |
| Jul 2027 (M13) | — | | — | | 4 | |
| Ago 2027 (M14) | — | | — | | 4 | |
| Sep 2027 (M15) | — | | — | | 4 | |
| Oct 2027 (M16) | — | | — | | 4 | |
| Nov 2027 (M17) | — | | — | | 4 | |
| Dic 2027 (M18) | — | | — | | 4 | |

---

## Notas mes a mes

Un bloque por mes para observaciones libres del operador (eventos, decisiones, anomalías, hipótesis a validar la semana siguiente, drift detectado y acción tomada). El registro es libre, no estructurado.

### Jun 2026 (M0)

- ...

### Jul 2026 (M1)

- ...

### Ago 2026 (M2)

- ...

### Sep 2026 (M3) — primera revisión trimestral programada (2026-09-16)

- ...

### Oct 2026 (M4)

- ...

### Nov 2026 (M5)

- ...

### Dic 2026 (M6) — segunda revisión trimestral

- ...

### Ene 2027 (M7)

- ...

### Feb 2027 (M8)

- ...

### Mar 2027 (M9) — tercera revisión trimestral

- ...

### Abr 2027 (M10)

- ...

### May 2027 (M11)

- ...

### Jun 2027 (M12) — cuarta revisión trimestral; cumple 12 meses del documento de estrategia

- ...

### Jul 2027 (M13)

- ...

### Ago 2027 (M14)

- ...

### Sep 2027 (M15) — quinta revisión trimestral

- ...

### Oct 2027 (M16)

- ...

### Nov 2027 (M17)

- ...

### Dic 2027 (M18) — cierre del horizonte de 18 meses del documento de estrategia; revisión completa de hipótesis

- ...
