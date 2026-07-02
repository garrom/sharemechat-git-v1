# Knowledge Base — SharemeChat Agente IA de Soporte

Base de conocimiento consumida por el `SupportKnowledgeBaseLoader` al arrancar
el backend. Todos los ficheros `*.md` presentes en este directorio se
concatenan y se incluyen en el system prompt de cada llamada a Claude.

En construcción iterativa. Ficheros 01-03 cerrados. Faltan
`04-chat-y-favoritos.md`, `05-pagos-y-saldo.md`,
`06-moderacion-y-seguridad.md`, `07-privacidad-y-datos.md`,
`08-cuenta.md`, `09-empresa-y-contacto.md`,
`10-preguntas-frecuentes.md` que se irán añadiendo en sesiones
siguientes.

## Estructura actual

- `00-comportamiento-agente-ia.md` — instrucciones internas de comportamiento del Agente IA (identidad, tono, no-proactividad, detección malas prácticas, escalado).
- `00-placeholder.md` — resumen básico (redundante con 01-producto.md pero mantenido como safety net).
- `01-producto.md` — **cerrado**.
- `02-onboarding-cliente.md` — **cerrado**.
- `03-onboarding-modelo.md` — **cerrado**.
- `04-chat-y-favoritos.md` — pendiente.
- `05-pagos-y-saldo.md` — pendiente.
- `06-moderacion-y-seguridad.md` — pendiente.
- `07-privacidad-y-datos.md` — pendiente.
- `08-cuenta.md` — pendiente.
- `09-empresa-y-contacto.md` — pendiente.
- `10-preguntas-frecuentes.md` — pendiente.

## Reglas

- No incluir información sensible (credenciales, IPs internas, ARNs).
- Tono conversacional, no legalista literal.
- ES + EN admitidos en el mismo fichero (Haiku detecta idioma solo).
- Cuando un fichero se añade, no requiere cambio de código; se recarga en
  el siguiente arranque del backend.
