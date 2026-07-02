# Knowledge Base — SharemeChat Support Bot

Base de conocimiento consumida por el `SupportKnowledgeBaseLoader` al arrancar
el backend. Todos los ficheros `*.md` presentes en este directorio se
concatenan y se incluyen en el system prompt de cada llamada a Claude.

## Estructura prevista (iterativa)

- `00-placeholder.md` — contenido mínimo mientras se construye la BdC completa.
- `01-producto.md` — pendiente
- `02-onboarding-cliente.md` — pendiente
- `03-onboarding-modelo.md` — pendiente
- `04-chat-y-favoritos.md` — pendiente
- `05-pagos-y-saldo.md` — pendiente
- `06-moderacion-y-seguridad.md` — pendiente
- `07-privacidad-y-datos.md` — pendiente
- `08-cuenta.md` — pendiente
- `09-empresa-y-contacto.md` — pendiente
- `10-preguntas-frecuentes.md` — pendiente

## Reglas

- No incluir información sensible (credenciales, IPs internas, ARNs).
- Tono conversacional, no legalista literal.
- ES + EN admitidos en el mismo fichero (Haiku detecta idioma solo).
- Cuando un fichero se añade, no requiere cambio de código; se recarga en
  el siguiente arranque del backend.
