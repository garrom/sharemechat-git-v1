# Knowledge Base — SharemeChat Agente IA de Soporte

Base de conocimiento consumida por el `SupportKnowledgeBaseLoader` al arrancar
el backend. Todos los ficheros `*.md` presentes en este directorio se
concatenan y se incluyen en el system prompt de cada llamada a Claude.

Construcción cerrada: **13/13 ficheros temáticos cerrados**. La BdC
se mantiene viva en el tiempo (correcciones factuales, incorporación
de FAQs reales, actualización de nuevos flujos), pero el temario
inicial planificado queda completo.

## Estructura actual

- `00-comportamiento-agente-ia.md` — instrucciones internas de comportamiento del Agente IA (identidad, tono, no-proactividad, detección malas prácticas, escalado).
- `00-placeholder.md` — resumen básico (redundante con 01-producto.md pero mantenido como safety net).
- `01-producto.md` — **cerrado**.
- `02-onboarding-cliente.md` — **cerrado**.
- `03-onboarding-modelo.md` — **cerrado**.
- `04-chat-y-favoritos.md` — **cerrado**.
- `05-pagos-y-saldo.md` — **cerrado**.
- `06-moderacion-y-seguridad.md` — **cerrado**.
- `07-privacidad-y-datos.md` — **cerrado**.
- `08-cuenta.md` — **cerrado**.
- `09-empresa-y-contacto.md` — **cerrado**.
- `10-preguntas-frecuentes.md` — **cerrado**.
- `11-ui-reference.md` — **cerrado**. Mapa de la UI real del producto (navbar, tabs, dónde está el saldo, cómo se accede al perfil, ruta de recuperación de contraseña, etc.). El Agente IA lo usa para dar indicaciones precisas en vez de instrucciones abstractas.
- `12-troubleshooting-modelo.md` — **cerrado**. Problemas técnicos frecuentes del rol MODEL (no llegan clientes al matching, cámara no arranca, sesión se corta, cuenta pendiente de aprobación, ubicación de Estadísticas). SOLO se aplica cuando el usuario tiene role=MODEL. Nunca mencionar saldo, packs, comprar ni recargar.
- `13-troubleshooting-cliente.md` — **cerrado**. Problemas técnicos frecuentes del rol CLIENT (no salen modelos al matching, cámara no arranca, sesión cortada, email de verificación no llega, compra de saldo falla). SOLO se aplica cuando el usuario tiene role=CLIENT. Nunca mencionar tiers, payout, Wise ni retirar.

## Reglas

- No incluir información sensible (credenciales, IPs internas, ARNs).
- Tono conversacional, no legalista literal.
- ES + EN admitidos en el mismo fichero (Haiku detecta idioma solo).
- Cuando un fichero se añade, no requiere cambio de código; se recarga en
  el siguiente arranque del backend.
