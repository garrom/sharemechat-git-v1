# Panel de Adquisición (backoffice)

Panel admin de **analítica de crecimiento first-party**: de qué canal, país, rol y
landing page vienen los **registros reales**. Se apoya en la capa B de atribución
(**[ADR-057](../06-decisions/adr-057-acquisition-source-capa-b.md)**, tabla
`user_acquisition`) cruzada con `users`. **Solo lectura.**

## Por qué first-party y no GA4

Los datos salen de la propia BD (server-side), por lo que **no** están contaminados por
lo que ensucia GA4 en este vertical: tráfico interno (autonavegación), spam de referrals/bots,
y —lo estructural— **consent-mode** (banners de cookies UE que tumban eventos) y **ad-blockers**
(la audiencia adulto/privacy-conscious bloquea trackers muy por encima de la media). GA4 queda
como herramienta secundaria de comportamiento de visitantes anónimos; para "quién se registra y
de dónde viene" manda este panel.

## Qué muestra

Ventana temporal seleccionable (7 / 30 / 90 días), compartida por dos **pestañas**:
**"Tablas"** (grid de tarjetas con scroll interno por tarjeta — escalable, sin scroll de página
infinito) y **"Gráficos"** (barras horizontales por desglose + barras por día, en SVG/CSS puro,
sin dependencia de librería de charts). Responsive por defecto (`grid auto-fit`, 2→1 columnas).
Los KPIs se muestran en ambas pestañas. KPIs y desgloses:

- **KPIs**: registros totales; con atribución (% de cobertura de la capa B); email verificado (%).
- **Por canal** (`utm_source`) — los registros sin atribución cuentan como `(direct/none)`.
- **Por sitio de origen** (`referrer_host`).
- **Landing pages que convierten** (`landing_path`) — mide qué artículo del blog / página trae
  registros (señal directa del retorno del blog/GEO).
- **Por país** (`users.country_detected`).
- **Por rol / tipo** (`users.role` + `user_type`: cliente / modelo / master).
- **Registros por día** (serie temporal).

## Implementación

- **Backend** (read-only, aditivo):
  - `AdminService.getAcquisitionOverview(Integer days)` — agrega vía `NamedParameterJdbcTemplate`
    (mismo patrón que el resto de consultas internas del admin) sobre `users` + `user_acquisition`,
    acotado por ventana (`created_at >= DATE_SUB(NOW(), INTERVAL :days DAY)`, cap 1..365, default 30).
  - `AdminController` → `GET /api/admin/acquisition/overview?days=N`.
- **Seguridad**: sin cambios en `SecurityConfig`. Cae bajo el catch-all
  `/api/admin/**` → `ROLE_ADMIN`. Panel **admin-only** (`canViewAcquisition: adminView`).
- **Frontend**: `pages/admin/AdminAcquisitionPanel.jsx`, cableado en `DashboardAdmin.jsx`
  (vista `acquisition`, sección *business* del sidebar). Textos con `defaultValue` (ES).

## Límites conocidos (v1)

- **No filtra tráfico interno**: los registros de prueba del propio equipo cuentan (no existe hoy
  un flag `is_internal` en `users`). Mejora futura: marcar/excluir cuentas internas.
- **Cobertura de atribución**: los usuarios registrados **antes** de la capa B (ADR-057) no tienen
  fila en `user_acquisition` → aparecen como `(direct/none)`. El KPI "con atribución (%)" hace
  visible esa cobertura; sube según se acumulan registros nuevos.
- **i18n**: textos por `defaultValue` en español; localización EN queda como mejora.
