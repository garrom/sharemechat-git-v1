# Operaciones administrativas

## Operaciones principales

- login específico de backoffice
- revisión de modelos y checklist
- consulta de streams activos
- revisión de moderación
- lectura de métricas y finanzas
- consultas internas de datos
- administración de usuarios, roles y permisos de backoffice

## Controles relevantes

- el acceso de backoffice exige perfil efectivo de backoffice
- el email no verificado ya no bloquea el login de backoffice, pero deja la UI interna en estado restringido hasta completar la validacion
- existe trazabilidad de acciones de acceso

## Punto de atención

Aunque el backoffice ya tiene bastante cobertura funcional, su correcto uso depende de que el catálogo de permisos y los overrides se mantengan coherentes con la evolución de endpoints y paneles.

## Moderación de usuarios

Los usuarios pueden reportar abusos a través de la UI de producto. Cada reporte se persiste en la tabla `moderation_reports` y queda disponible en el panel de administración (`/api/admin/moderation/reports*`), donde un operador con permisos puede revisarlo, marcar resultado y, si procede, aplicar acciones sobre las cuentas implicadas (bloqueo, advertencia, etc.). El flujo está soportado por:

- Entidad `ModerationReport` (paquete `com.sharemechat.entity`).
- Servicio `ModerationReportService`.
- Controllers: `ModerationReportController` (creación desde producto, `POST /api/reports/abuse`) y `AdminController` (revisión desde backoffice, `/api/admin/moderation/reports*`).
- UI admin: `AdminModerationPanel.jsx`.
