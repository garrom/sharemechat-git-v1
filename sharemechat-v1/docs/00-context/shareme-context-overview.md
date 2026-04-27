# SharemeChat — Contexto general de proyecto

Documento transversal de traspaso de conocimiento. Sirve como contexto base reutilizable para iniciar conversaciones nuevas con asistentes externos al repositorio. No sustituye a la documentacion durable de `sharemechat-v1/docs/`, sino que la resume.

## 1. Identidad del proyecto

- Nombre: SharemeChat
- Empresa: Shareme Technologies OÜ (Estonia)
- Tipo: plataforma web de videochat 1 a 1 entre cliente y modelo
- Referencias de mercado: CooMeet, LuckyCrush
- Estado: MVP avanzado, cercano a produccion, sin ingresos reales todavia

## 2. Descripcion del producto

SharemeChat conecta dos roles diferenciados en una sesion de videochat en tiempo real:

- Cliente: usuario final que consume sesiones, recarga saldo y envia regalos
- Modelo: usuario que ofrece sesiones, recibe regalos y genera ingresos
- SharemeChat se posiciona como una alternativa web-first a plataformas de videochat existentes, eliminando fricción de instalación y permitiendo acceso inmediato desde navegador.

Funcionalidades operativas:

- Videochat aleatorio (modo RANDOM): emparejamiento automatico cliente-modelo via WebRTC
- Llamada directa entre favoritos (modo CALLING): videochat 1 a 1 iniciado desde lista de favoritos
- Chat de texto en tiempo real sobre WebSocket, integrado en el videochat y disponible fuera de sesion entre favoritos
- Sistema de regalos (gifts) con contabilidad doble (cargo cliente, ingreso modelo, margen plataforma)
- Balance, recargas y transacciones por usuario
- Backoffice administrativo con roles granulares
- KYC basico para validacion de modelos (documentos, foto de perfil, video de presentacion)

Problema de negocio que resuelve:

- Conexion en directo y monetizable entre clientes que buscan interaccion personal y modelos que ofrecen ese servicio, sin friccion de descarga de app y con control operativo desde backend.

## 3. Arquitectura tecnica

- Frontend: React con patron Dual Surface (build de producto y build de admin separados; comparten utilidades pero no UI)
- Backend: Spring Boot, patron Controller → Service → Repository → Entity, JWT en cookies HttpOnly (`SameSite=None; Secure`)
- Realtime media: WebRTC con TURN propio por entorno; signaling via WebSocket sobre `/match` (RANDOM) y `/messages` (chat y notificaciones)
- Persistencia: MySQL (RDS)
- Estado runtime: Redis (matching, presencia, sesiones activas, rate limit, auth-risk)
- Storage privado: S3 con acceso mediado por backend (`/api/storage/content`)
- Edge: CloudFront con CloudFront Functions para fallback SPA y AllowedMethods completos en behaviors WebSocket
- Proxy: Nginx en cada EC2 para `/api`, `/match`, `/messages` y access logs
- Infraestructura: AWS (EC2 backend, EC2 TURN, S3, CloudFront, RDS, Route53)

## 4. Entornos

### TEST (`test.sharemechat.com`)

- Entorno de desarrollo y validacion funcional continua
- Arranque manual del backend (no en produccion 24/7 garantizado)
- Accesible publicamente sin IP fija
- Registro publico deshabilitado a nivel UI (no a nivel backend)
- Logs no persistentes garantizados
- TURN propio operativo

### AUDIT (`audit.sharemechat.com`)

- Entorno de auditoria, validacion PSP y revisiones externas
- Accesible publicamente sin IP fija
- Sin registro publico activo: solo cuentas existentes pueden operar
- Logs persistentes en EC2 con journald + access logs Nginx
- Pipeline perimetral activo: normalizer, classifier, reporter, blocker (modo real Carril A)
- TURN propio operativo bajo systemd con certificado valido
- Auth-risk Fase 1 + Fase 2 validados

### PRO (produccion)

- Pendiente de despliegue completo
- Objetivo de lanzamiento: 1 de julio de 2026
- Heredara contratos ya validados en AUDIT (edge, TURN, auth-risk, blocker en DRY-RUN inicial)

### Filosofia operativa de entornos

- Publico pero no auto-onboardable: cualquiera puede acceder a la URL, pero no puede crearse cuenta libremente en TEST/AUDIT
- Las cuentas existentes son las unicas que validan flujo end-to-end fuera de PRO

## 5. Seguridad actual

Capa aplicacion:

- Auth-risk con respuesta progresiva:
  - Modo OBSERVE (logging y scoring) en todas las superficies de login
  - Delay aleatorio (~750-1500 ms) para nivel HIGH
  - Bloqueo temporal por email (TTL ~600s) para nivel CRITICAL
  - Contrato HTTP uniforme: respuesta `401` indistinguible para evitar canal lateral
  - Hash HMAC-SHA256 truncado del email en Redis y logs (privacy-preserving)
- Rate limiting basico por IP/email en endpoints sensibles
- Country access (gating por pais sobre superficies sensibles)
- JWT en cookies HttpOnly + refresh tokens persistidos con IP/UA por sesion
- Separacion de namespaces Redis por entorno (`ar:test:*`, `ar:audit:*`)

Capa perimetral (AUDIT):

- Pipeline desacoplado del backend Java
- Normalizacion diaria de access logs
- Clasificacion deterministica con scoring por IP
- Reporting operativo
- Blocker activo en Carril A (TTL 30 dias) escribiendo `/etc/nginx/deny-audit-ips.conf` con preflight/postflight `nginx -t` + reload
- Allowlist documentada
- TEST en modo DRY-RUN del blocker

Limitaciones reconocidas:

- No es un sistema antifraude completo
- Riesgos conocidos abiertos:
  - Ataques low-and-slow (por debajo de umbrales de scoring)
  - Distribucion por IP (un atacante con muchas IPs distintas degrada las heuristicas)
  - Consent_id debil del lado del producto
  - Lateral timing channel residual (delay aleatorio mitiga, no elimina)

## 6. Estado actual

Funciona end-to-end en TEST y AUDIT:

- Producto completo cliente y modelo
- RANDOM y CALLING estables con TURN propio
- Confirmacion industrial via doble `ack-media` antes de iniciar tramo facturable
- Gifts validados contra sesion confirmada (no se cobra antes de media usable)
- Backoffice operativo con permisos granulares
- Storage privado S3 sirviendo media protegida con control de acceso por rol
- Auth-risk validado funcionalmente en ambos entornos
- Pipeline perimetral AUDIT autonomo bajo systemd

Pero:

- No hay PSP integrado (sin pasarela de pago real)
- No hay ingresos reales
- Produccion no abierta al publico
- No hay captacion activa de usuarios

## 7. Problemas abiertos importantes

- Integracion PSP pendiente: bloqueante para monetizacion real
- Despliegue PRO pendiente: edge, TURN, backend, blocker en DRY-RUN
- Falta captacion real de modelos y clientes
- Registro publico deshabilitado solo a nivel UI: backend sigue aceptando registro si se llama directamente al endpoint (deuda de gating real por entorno)
- i18n incompleto: la UI todavia depende en parte de `err.message` raw del backend; pendiente migracion a codigos funcionales estables mapeados con `i18n.t(...)`
- Contrato de errores no totalmente estabilizado: REST y WebSocket tienen niveles distintos de codigos vs texto libre
- Salto visual de `<video>` remoto en Chromium durante fase pre-media (deuda visual no disruptiva)
- Diagnostico fino abierto en regalos RANDOM tras sesion larga (resolucion via fallback a BD pendiente de validar)
- El principal riesgo actual no es técnico, sino de validación de mercado.

## 8. Roadmap inmediato

### GO LIVE (bloqueante para produccion)

- Integracion PSP (eleccion de proveedor + flujo de checkout + webhooks)
- Despliegue PRO completo (edge CloudFront, EC2 backend, EC2 TURN, RDS, S3, blocker en DRY-RUN)
- Landing publica sin login + flujo de registro real abierto solo en PRO

### CRECIMIENTO

- Captacion de modelos: onboarding KYC simplificado, payouts claros
- Captacion de clientes: landing, SEO basico, conversion trial → cliente

### SEGURIDAD

- Blacklist por pais aplicada en edge y backend
- Control basico de abuso: throttling adicional en gifts y matching
- Activacion del blocker Carril A en PRO tras DRY-RUN
- Endurecimiento del consent_id

### OPERACION

- Chat de soporte (cliente ↔ operador)
- Metricas admin: dashboards de sesiones, ingresos, gifts, retencion

### DIFERENCIACION

- Deteccion de cara en streaming (modelo debe estar visible para cobrar)
- Posibles features de matching mas inteligente

## 9. Filosofia de desarrollo

- Evitar abrir demasiados frentes en paralelo: estabilizar antes de extender
- Priorizar correcciones de raiz frente a parches locales
- Separar claramente producto, infraestructura y seguridad
- Decisiones arquitectonicas relevantes documentadas en ADR (`docs/06-decisions/`)
- Cambios iterativos, reversibles y validados por entorno (TEST → AUDIT → PRO)
- Documentacion durable concentrada en `sharemechat-v1/docs/`, sin duplicacion fuera
- No usar `git worktree` ni carpetas auxiliares de agentes en el repo
- Toda incidencia operativa relevante queda registrada en `docs/04-operations/incident-notes.md` con causa raiz, solucion y resultado
- El objetivo es llegar a producción lo antes posible con control suficiente, evitando sobreingeniería prematura.

## 10. Objetivo final

- Lanzamiento a produccion: 1 de julio de 2026
- Validacion del modelo de negocio con usuarios reales y pagos reales
- Inicio de ingresos via PSP integrado
- Preparacion de la plataforma para escalado horizontal sin reescritura mayor
