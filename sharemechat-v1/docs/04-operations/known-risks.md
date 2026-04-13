# Riesgos conocidos

- La configuracion versionada esta mas alineada con TEST que con una estrategia plenamente parametrizada por entorno.
- El frontend mantiene acoplamientos explicitos a dominios de test.
- Un entorno sin Redis operativo rompe matching y coordinacion realtime aunque el handshake WebSocket ya funcione correctamente.
- El enforcement de consentimiento y compliance no es homogeneo entre REST y WebSocket.
- Los limites efectivos de subida pueden divergir entre backend y capa publica. Si Nginx o la capa HTTP publica no fijan explicitamente un limite alineado con backend, una peticion multipart valida para Spring Boot puede seguir siendo rechazada con `413` antes de llegar al controller.
- El repositorio principal no versiona los ficheros reales de Nginx de TEST y AUDIT. Mientras la paridad dependa de comparacion operativa fuera del repo, puede reabrirse deuda de publicacion HTTP sin que el diff exacto quede trazado junto al codigo.
- El bloqueo por email no verificado en backoffice queda concentrado en la UI privada y no en todos los endpoints admin. Eso simplifica la operativa y la UX, pero mantiene como riesgo residual que un usuario interno autenticado con email pendiente pueda seguir teniendo capacidad de acceso tecnico a APIs si se sale de la interfaz prevista.
- El age gate guest sigue siendo una decision de superficie y almacenamiento local. Si en el futuro se necesitara excluir tambien a usuarios backoffice autenticados que entren por rutas publicas de producto, haria falta revisar el flujo de sesion en rutas publicas y no solo los dashboards autenticados.
- `/users/me` sigue excluido del mecanismo automatico de refresh de sesion en `http.js`. Tras eliminar el bootstrap duplicado del backoffice, este comportamiento deja de ser la causa principal del bucle, pero puede seguir generando diferencias visibles frente a otros endpoints autenticados si la sesion entra en estados transitorios.
- La superficie admin puede seguir teniendo una deuda de publicacion HTTP para rutas `/api/*`. Mientras no se verifique que los errores del backend se propagan intactos como `4xx application/json`, existe riesgo de que ciertos errores de login o autorizacion se sustituyan por `200 text/html` y queden enmascarados como respuestas validas para el frontend.
- Aunque TEST y AUDIT ya operan con S3 privado y han eliminado su legacy conocido de `/uploads/...`, sigue existiendo riesgo residual si algun otro entorno futuro no replica la misma activacion y validacion de forma homogenea.
- El proxy privado `/api/storage/content` ya no admite acceso anonimo. Si existia algun consumo anonimo de media gestionado por storage, necesitara un canal funcional distinto y explicito en lugar de reutilizar el storage privado.
- `USER + FORM_CLIENT` no entra por defecto en el acceso general al media de perfil servido por storage. Si el flujo de random necesitara ese caso en el futuro, habra que abrirlo con una regla especifica y validada, no con una ampliacion global.
- PSP y KYC externo siguen pareciendo areas de transicion.
- Parte del conocimiento historico previo estaba en documentos muy operativos; tras el saneado puede quedar alguna dependencia tacita fuera del repositorio principal si no existe una fuente operativa separada.
