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
- **Columna "real"**: vacía hasta el primer rellenado. La actualiza el operador en cada revisión semanal P7 con las marcas descritas debajo.

### Marcas en la columna "real"

- **`X*`** (sufijo asterisco): **PARCIAL** — dato capturado en mitad del mes (el mes aún no ha cerrado). Se sustituye por el dato definitivo en la revisión del último domingo del mes, sin marcar `*`.
- **`X (lg YYYY-MM-DD)`**: valor leído del ledger interno (`docs/social/social-state.json`) a esa fecha, sin actualización manual desde entonces. Requiere verificación contra la fuente externa real cuando se cierre el mes.
- **`(pdte fuente)`**: por rellenar; el operador mira el dato en la fuente externa indicada (GSC, perfil Reddit, etc.). La ruta exacta de cada fuente está en la sección "Notas mes a mes" del propio mes cuando hace falta detalle adicional.

---

## Tabla 1 — SEO Google (GSC)

Plan pesimista de `estrategia.md` § 5: impresiones deben crecer 20-30% mes a mes desde M3; posición media baja de 30 → 15 → 8 → 5 a lo largo de 12 meses. El documento no proyecta valores absolutos mensuales para impresiones, clics ni CTR.

| Mes | Impresiones plan | Impresiones real | Clics plan | Clics real | CTR % plan | CTR % real | Posición media plan | Posición media real |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Jun 2026 (M0)  | — | (pdte GSC) | — | (pdte GSC) | — | (pdte GSC) | — | (pdte GSC) |
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
| Jun 2026 (M0)  | F1 |   100 | 131* | 5% (ref) | 1.53%* |
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
| Jun 2026 (M0)  | — | 0* | — | 1 (lg 2026-06-12) | — | (pdte reddit) |
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
| Jun 2026 (M0)  | — | 2* | — | 0* | 4 | 1* |
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

**Snapshot parcial al 2026-06-18.** El mes no ha cerrado todavía; los valores marcados con `*` se sustituirán por los definitivos en la revisión del 2026-06-30. Esta es la primera entrada del tracking — sirve como referencia de método para los meses siguientes.

**Hechos del mes que contextualizan los KPIs**:

- **Plan SEO registrado oficialmente este mes** con la pareja `estrategia.md` + este tracking (commit `5e5f81d`, 2026-06-17).
- **Modelo financiero registrado este mes** (commit `aed0c5f`, 2026-06-17 — fijos €230/mes iniciales) y **actualizado al añadir el coste fijo de Sightengine** (commit `6296cbb`, 2026-06-18 — fijos €257/mes). Los costes operativos del horizonte 19m quedan formalmente comprometidos.
- **Sistema de tiers de modelos registrado este mes** (commit `bb7918f`, 2026-06-17).
- **Primer artículo del blog publicado el 2026-06-16**: `que-es-videochat-1-a-1`. Tercer artículo total del blog (con `elegir-videochat-seguro` y `foto-perfil-videochat` ya publicados antes del horizonte). En el conteo "Artículos blog real" se cuenta solo el publicado durante M0.
- **2 aportes en X** ejecutados con el pipeline social-ops (rondas 1 y 2 del ciclo Cowork: variantes "Retouch mismatch" y "Catalog effect", ambas sin nombrar marca, sin enlaces, sin CTA). `social-state.json` refleja `platforms.x.ratio.aporte = 2`. Cuenta `@shareme_chat` sigue en fase `warmup`.
- **Indexación masiva en GSC el 2026-06-16** (8 URLs: 3 artículos ES + 3 EN + home EN + blog index ES + blog index EN). **Hallazgo importante**: la home EN y los dos blog index NO estaban indexadas previamente, lo que explicaba el bajo tráfico orgánico hacia el mercado anglosajón y el descubrimiento defectuoso de artículos vía blog index. El efecto en impresiones GSC se espera en 1-2 semanas conforme Google procese y propague — posiblemente fuera de M0, ya en M1.

**Hallazgo clave en GA4 del mes 0 (PARCIAL al 2026-06-18)** que reajusta la lectura de los KPIs de tracking:

- Sesiones GA4 total = **131** en últimos 28 días.
- Pero ~**90% del tráfico es Direct** (autonavegación del propietario + tests internos sobre el SPA durante la fase de despliegues SEO/brand), no es tráfico convertible.
- Solo **2 sesiones de 131 (1.53%) son Organic Search**. Esa es la métrica que **realmente mide SEO** durante el sandbox de Google de los primeros meses, no el total de sesiones.

**Implicación operativa para los meses siguientes**: durante M0-M3 (sandbox Google), la métrica vigilada cuando se compara contra el plan pesimista debe ser `Sesiones × % Organic` (= sesiones realmente orgánicas), no `Sesiones GA4 total`. El plan pesimista del documento de estrategia proyecta 100 sesiones totales en M0 (ya superado: 131); pero esas sesiones no son SEO. El total de "sesiones de plan" del § 4 hay que interpretarlo como "tráfico real útil" en estas fases, no como "tráfico GA4 bruto". Documentar el ratio Direct/Organic en cada mes hasta que el SEO empiece a notarse (M3-M4 según el sandbox).

**Pendiente de rellenar al cierre del mes (2026-06-30)**:

- Impresiones, Clics, CTR, Posición media de GSC para junio cerrado.
- Sesiones GA4 y % Organic finales del mes cerrado (28 días móviles seguirán solapando con mayo, el dato de junio puro requiere filtro por fecha en GA4).
- Karma Reddit actual de `u/sharemechat` (Alain mira en `reddit.com/user/sharemechat`).
- Miembros actuales de `r/SharemeChat` (Alain mira en `reddit.com/r/SharemeChat`, barra lateral).
- Confirmar Followers X (esperado: sigue 0 en `warmup`, pero verificable en el perfil).
- Confirmar conteo final de Aportes/Promos X y Artículos blog del mes (cierre del ciclo social-ops y posibles publicaciones del 19-30 jun).

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
