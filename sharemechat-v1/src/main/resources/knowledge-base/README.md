# Knowledge Base — SharemeChat Agente IA de Soporte

Base de conocimiento consumida por el `SupportKnowledgeBaseLoader` al arrancar
el backend. Todos los ficheros `*.md` presentes en este directorio se
concatenan y se incluyen en el system prompt de cada llamada a Claude.

Estructura vigente tras Fase 1.B del refactor Agente IA (ADR-044): la
taxonomía objetivo del filesystem coincide 1:1 con las filas que produce
`POST /api/admin/knowledge-base/seed-from-jar` en la tabla
`support_bot_prompts`. Un fichero temático = una fila. Fase 1.C consumirá
esa tabla; Fase 1.D eliminará estos MDs del JAR.

## Ficheros temáticos (13 físicos → 14 filas en tabla)

- `00-comportamiento-agente-ia.md` — Constitución del bot (identidad, tono,
  filtro por rol, malas prácticas, escalado, dominio, idioma). Fila
  siempre-incluida.
- `00-placeholder.md` — Redundante con `producto-general.md`, mantenido
  como safety net del loader del JAR. **Excluido del seed** (no genera fila).
- `producto-general.md` — Descripción general + FAQ transversal. Fallback
  del router. Fusiona el antiguo `01-producto.md` + `10-preguntas-frecuentes.md`.
- `02-onboarding-cliente.md` — Registro cliente + KYC cliente + primer login.
- `03-onboarding-modelo.md` — Registro modelo + contrato + KYC modelo +
  aprobación admin + assets + suspensión/baneo. Split del antiguo 03.
- `03b-payout-y-tiers.md` — Sistema económico modelo (tiers, cambio,
  gifts, payout, umbral, Wise). Split del antiguo 03.
- `04-chat-y-favoritos.md` — Favoritos, chat texto, emojis, gifts,
  bloqueo/reporte, notificaciones.
- `05-pagos-y-saldo.md` — Modelo económico cliente (packs, consumo,
  refunds, chargebacks, facturación). El seed fuerza `role='CLIENT'` para
  esta fila vía map de overrides (el nombre del fichero no lo revela).
- `06-moderacion-y-seguridad.md` — Moderación IA, reportes, /complaint,
  apelaciones, acciones cuenta, KYC como concepto.
- `07-privacidad-y-datos.md` — GDPR, vendors, retención, derechos.
- `08-cuenta.md` — Login, contraseñas, cambiar email, cerrar cuenta,
  cambio de rol.
- `09-empresa-y-contacto.md` — Datos societarios, canales, horarios,
  suplantación.
- `11-ui-reference.md` — Mapa UI real (navbar, tabs, dashboards). Fila
  siempre-incluida en Fase 1.C.
- `12-troubleshooting-modelo.md` — Problemas técnicos rol MODEL.
- `13-troubleshooting-cliente.md` — Problemas técnicos rol CLIENT.

## Reglas

- No incluir información sensible (credenciales, IPs internas, ARNs).
- Tono conversacional, no legalista literal.
- ES + EN admitidos en el mismo fichero (Haiku detecta idioma solo).
- Cuando un fichero se añade, no requiere cambio de código; se recarga en
  el siguiente arranque del backend (BdC del JAR) o al ejecutar
  `POST /api/admin/knowledge-base/reload` (BdC de la tabla, Fase 1.C+).
- Nombres de fichero admitidos por `deriveCaseKey`: prefijo `\d+-` (como
  `05-pagos-y-saldo`) o `\d+[a-z]-` (como `03b-payout-y-tiers`). El
  `case_key` se deriva quitando el prefijo y la extensión `.md`.
- Sufijos `-modelo` / `-cliente` en el nombre auto-derivan `role='MODEL'`
  / `role='CLIENT'`. Para case_keys sin sufijo revelador, existe un map
  de overrides en `KnowledgeBaseAdminController.ROLE_OVERRIDES`.
