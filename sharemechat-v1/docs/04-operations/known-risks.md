# Riesgos conocidos

- La configuracion versionada esta mas alineada con TEST que con una estrategia plenamente parametrizada por entorno.
- El frontend mantiene acoplamientos explicitos a dominios de test.
- La configuracion WebSocket versionada no refleja todavia de forma consistente todos los entornos previstos.
- El enforcement de consentimiento y compliance no es homogeneo entre REST y WebSocket.
- El bloqueo por email no verificado en backoffice queda concentrado en la UI privada y no en todos los endpoints admin. Eso simplifica la operativa y la UX, pero mantiene como riesgo residual que un usuario interno autenticado con email pendiente pueda seguir teniendo capacidad de acceso tecnico a APIs si se sale de la interfaz prevista.
- El age gate guest sigue siendo una decision de superficie y almacenamiento local. Si en el futuro se necesitara excluir tambien a usuarios backoffice autenticados que entren por rutas publicas de producto, haria falta revisar el flujo de sesion en rutas publicas y no solo los dashboards autenticados.
- `/users/me` sigue excluido del mecanismo automatico de refresh de sesion en `http.js`. Tras eliminar el bootstrap duplicado del backoffice, este comportamiento deja de ser la causa principal del bucle, pero puede seguir generando diferencias visibles frente a otros endpoints autenticados si la sesion entra en estados transitorios.
- La superficie admin puede seguir teniendo una deuda de publicacion HTTP para rutas `/api/*`. Mientras no se verifique que los errores del backend se propagan intactos como `4xx application/json`, existe riesgo de que ciertos errores de login o autorizacion se sustituyan por `200 text/html` y queden enmascarados como respuestas validas para el frontend.
- PSP y KYC externo siguen pareciendo areas de transicion.
- El storage operativo de uploads continua siendo local, con la carga operativa y de escalado que ello implica.
- Parte del conocimiento historico previo estaba en documentos muy operativos; tras el saneado puede quedar alguna dependencia tacita fuera del repositorio principal si no existe una fuente operativa separada.
