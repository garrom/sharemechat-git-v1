# Roles y flujos

## Roles de producto

- `USER`: cuenta base autenticable aún no promovida
- `CLIENT`: usuario con wallet activa y acceso a experiencia de cliente
- `MODEL`: modelo aprobado administrativamente
- `ADMIN`: rol de producto con acceso implícito al backoffice

El código también trata `SUPPORT` como rol restringido al backoffice si aparece en datos.

## Flujos principales

### Alta de cliente

- registro inicial como `USER` con tipo de formulario cliente
- login con cookies JWT y refresh token
- promoción a `CLIENT` tras primera transacción válida

### Alta de modelo

- registro inicial como `USER` con tipo de formulario modelo
- carga documental y flujo KYC
- revisión administrativa
- promoción a `MODEL` cuando la revisión es aprobada

### Matching aleatorio

- conexión WebSocket a `/match`
- entrada en colas operativas
- emparejamiento con contraparte disponible
- señalización WebRTC a través del backend

### Mensajería y llamada directa

- conexión WebSocket a `/messages`
- chat persistido y eventos realtime
- llamada directa condicionada por la relación habilitada entre usuarios

## Consentimiento

El repositorio muestra control de age gate y términos tanto en modo invitado como autenticado. No obstante, el enforcement no es completamente homogéneo entre REST y WebSocket, por lo que debe leerse como un área sensible que aún requiere endurecimiento.
