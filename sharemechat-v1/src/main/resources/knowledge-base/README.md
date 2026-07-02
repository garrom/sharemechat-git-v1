# Knowledge Base — SharemeChat Agente IA de Soporte

Base de conocimiento consumida por el `SupportKnowledgeBaseLoader` al arrancar
el backend. Todos los ficheros `*.md` presentes en este directorio se
concatenan y se incluyen en el system prompt de cada llamada a Claude.

Construcción cerrada: **10/10 ficheros temáticos cerrados**. La BdC
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

## Reglas

- No incluir información sensible (credenciales, IPs internas, ARNs).
- Tono conversacional, no legalista literal.
- ES + EN admitidos en el mismo fichero (Haiku detecta idioma solo).
- Cuando un fichero se añade, no requiere cambio de código; se recarga en
  el siguiente arranque del backend.
