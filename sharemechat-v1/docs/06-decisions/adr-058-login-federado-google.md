# ADR-058 — Login federado "Sign in with Google" (Google Identity Services) para el rol CLIENT

**Estado:** Aceptada (2026-08-05). Backend Fase 1 implementado; frontend pendiente; deploy TEST pendiente.

## Contexto

Al cierre de la sesión de nivelación Master en PROD (2026-08-04) el operador declaró como siguiente frente estratégico la implementación de "login con Google" como método adicional de autenticación para reducir la fricción de registro y alinearse con el sector.

El operador aportó un estudio profundo previo (`Sharemechat_Aplicaciones/SECURIZACION/Login-google.pdf`, 7 páginas con fuentes citadas y verificación de campo, 2026-08-05) que mapea la industria adult/dating:

- **Dating mainstream** (Tinder, Bumble, Hinge, Grindr, Feeld, HER, Badoo, OkCupid, Zoosk): SSO agresivo — teléfono/SMS + Apple + Google, Facebook en retirada estructural.
- **Cam sites tradicionales anonimizados** (Chaturbate, Stripchat, LiveJasmin, Jerkmate, Streamate, BongaCams, CooMeet): email/username + password puro, sin SSO documentado. La razón dominante es privacidad, evitar la vinculación con identidad real y las políticas de proveedores.
- **Precedente adult moderno**: OnlyFans es la única plataforma adult grande con Google Sign-In documentado, para cuentas de consumidor (fan), reservando el KYC pesado solo para creators.

El estudio confirma:
1. Google API Services User Data Policy **NO prohíbe apps adult** para autenticación pura (solo restringe apps dirigidas a menores). Con scopes `openid + email + profile` (no sensibles), la app cae en "authentication only" y solo requiere **brand verification** (no revisión de seguridad completa de scopes).
2. GIS con ID tokens verificados server-side integra sin romper el auth actual custom (JWT stateless en cookies HttpOnly SameSite=None).
3. **Google Sign-In NO verifica edad** — el age-gate/KYC propio de SharemeChat sigue siendo obligatorio bajo DSA (Comisión EU 14 jul 2025), UK Online Safety Act (Ofcom, desde 25 jul 2025) y ley francesa SREN/ARCOM.

## Decisión

**Implementar Google Identity Services (GIS) "Sign in with Google" en el frontend + verificación server-side del ID token en el backend con integración en el pipeline auth propio existente. Alcance Fase 1 acotado al rol CLIENT únicamente. Alcance Fase 2+ se decide con datos reales de adopción.**

### D1 — Stack técnico: GIS + google-api-client (no Spring Security OAuth2 client)

Dependencia: `com.google.api-client:google-api-client:2.7.2` (librería oficial de Google que gestiona JWKS caching + retry con backoff automáticos).

Rechazo explícito de `spring-boot-starter-oauth2-client`: traería toda la maquinaria Spring Security OAuth2 (session management, redirect flow, code exchange, WebSecurityConfigurerAdapter chains) que **rompe** el modelo actual custom (stateless JWT + refresh en cookies HttpOnly SameSite=None + rate-limit + risk + backoffice split). El coste de esa integración supera con creces el beneficio.

### D2 — Alcance Fase 1: solo CLIENT

Rol MODEL y rol MASTER quedan **fuera de Fase 1**, siguiendo el patrón fan/creator validado por OnlyFans (SSO ligero para consumidor, KYC pesado para talento sin SSO). Justificación:

- Modelo tiene ceremonia intencional (KYC Didit + contrato v4/v6 + admin review). Añadir Google al flujo modelo desde el día 1 no ahorra fricción relevante y complica el matcher backend.
- Master es B2B con responsabilidad sobre dinero de terceros; email+password + KYC pesado es coherente con el rol.
- No hay precedente público documentado de SSO diferenciado por rol; Fase 1 acotada = zona técnica probada.

**Extensión a MODEL** queda como decisión reversible con dato empírico: si >30% de los CLIENTs eligen Google en los primeros meses y hay demanda de modelos, se abre frente propio. Un solo commit frontend habilita el botón en `register-model`.

### D3 — Política de account linking: híbrida P2/P3 (no P3 puro, no P1 auto-link ciego)

En caso de colisión por email (usuario Google intenta autenticarse con un email ya registrado por email+password):

- **Auto-link SOLO** si `email_verified=true` en el ID token de Google **Y** la cuenta existente tenía `email_verified_at` poblado en BD. Sin fricción para el caso común.
- **Rechazo** con `409 EMAIL_COLLISION_NEEDS_PASSWORD` si la cuenta existente no había verificado su email. El usuario debe primero loguearse con password y vincular Google desde su perfil.
- **Nunca auto-link ciego por email solo** (P1 puro). Es el vector de account takeover documentado por Clerk/Ory/WorkOS.

### D4 — Identificador del usuario federado: `sub` de Google, no email

Google es explícita en su documentación: *"Don't use email address as an identifier because a Google Account can have multiple email addresses at different points in time. Always use the sub field as the identifier for the user"*. El claim `sub` es globalmente único, estable por vida de la cuenta Google y nunca reutilizado.

Se persiste en `oauth_accounts.provider_user_id` con constraint UNIQUE(provider, provider_user_id). El email vivo del usuario se mantiene en `users.email`; el email al momento del signup se congela en `oauth_accounts.email_at_signup` para auditoría.

### D5 — Tabla `oauth_accounts` multi-provider desde el origen

Tabla genérica `oauth_accounts(id, user_id FK, provider, provider_user_id, email_at_signup, google_hd, picture_url, created_at, last_used_at, revoked_at)` con constraint `CHECK provider IN ('google', 'apple', 'twitter')`. Diseñada para soportar futuros providers sin cambios de schema. Fase 1 solo puebla filas con `provider='google'`.

`revoked_at` es soft-delete: unlink de un provider mantiene la fila con timestamp, permite auditoría y evita colisiones si el usuario re-vincula la misma cuenta Google más tarde.

### D6 — `users.password` pasa a NULLABLE

Los usuarios creados vía Google son "Google-only" desde el día 1 (no tienen password). La columna `users.password` pasa a `NULL` permitido (migration V48). Semántica:

- `password IS NOT NULL` → tiene password, puede loguearse por email+password.
- `password IS NULL` → Google-only, solo puede loguearse por Google (o añadir password vía `POST /api/users/me/password/initial`).

No se añade columna `password_set_at` redundante — la presencia/ausencia de `password` es la fuente autoritativa.

### D7 — Pipeline auth simétrico con `/api/auth/login`

`POST /api/auth/google` replica el pipeline completo de `AuthController.login`:

1. Consent age-gate (mismo).
2. Rate-limit por IP (mismo).
3. Country-access (mismo).
4. Verificar ID token con `GoogleIdTokenVerifierService` (nuevo).
5. Auth-risk `LOGIN_ATTEMPT_GOOGLE` con **nuevo canal** `product-google` (permite dashboards separados).
6. Resolver/crear User + OAuthAccount con política P2/P3.
7. Backoffice deny (mismo que login clásico).
8. Account status checks (mismo).
9. Emitir cookies JWT (mismas: access 15 min + refresh 14 días, HttpOnly SameSite=None).
10. Auth-risk `LOGIN_SUCCESS_GOOGLE`.
11. Dormancy `recordActivity` (mismo).

Cambiar solo el método de autenticación (password → ID token verificado) y todo el ecosistema de defensas se hereda intacto.

### D8 — Consent screen: modo Testing durante Fase 1

Google permite dos estados: Testing (solo test users pueden usar el OAuth) y Production (público, requiere brand verification).

Fase 1 arranca en **Testing** con los emails del operador como test users. Motivos:
- Sin brand verification hasta que TEST/AUDIT/PROD funcionen técnicamente.
- Si Google rechazara brand verification por categoría adult (riesgo empírico no documentado en la industria), se pivota a magic link sin haber invertido en trabajo de brand verification.

Se publica a Production **después** de validar el flujo end-to-end en TEST y AUDIT.

### D9 — Backend siempre disponible con degradación limpia

Si la property `auth.google.client-id` no está poblada (ej. AUDIT o PROD sin `GOOGLE_OAUTH_CLIENT_ID` en `config.env`), el endpoint `POST /api/auth/google` devuelve `503 GOOGLE_AUTH_UNAVAILABLE`. El resto del backend arranca normalmente. Cero acoplamiento con el resto del sistema.

## Alcance de la implementación Fase 1 backend (2026-08-05)

### Estructura de código

**Migrations Flyway** (aplicadas al primer restart backend):
- `V47__add_oauth_accounts.sql` — tabla `oauth_accounts` con constraints UNIQUE y CHECK.
- `V48__make_users_password_nullable.sql` — `users.password` pasa a NULLABLE.

**Backend Java**:
- Dependencia: `com.google.api-client:google-api-client:2.7.2` en `pom.xml`.
- Property: `auth.google.client-id=${GOOGLE_OAUTH_CLIENT_ID:}` en `application.properties`.
- Entity: `entity/OAuthAccount.java`.
- Repository: `repository/OAuthAccountRepository.java`.
- Servicio: `service/GoogleIdTokenVerifierService.java` (verifica firma + iss + aud + exp).
- DTOs: `dto/GoogleAuthRequestDTO.java`, `dto/OAuthLinkRequestDTO.java`, `dto/SetInitialPasswordRequest.java`.
- Controllers:
  - `controller/AuthGoogleController.java` — `POST /api/auth/google` (público).
  - `controller/OAuthAccountController.java` — `GET /oauth`, `POST /oauth/google/link`, `DELETE /oauth/google`, `POST /password/initial` (autenticados, bajo `/api/users/me/`).
- Actualización `SecurityConfig.java`: permitAll `POST /api/auth/google`.
- Actualización `AuthRiskConstants.java`: nuevo canal `Channels.PRODUCT_GOOGLE`.

**Tests**: `GoogleIdTokenVerifierServiceTest` con 5 casos (configurado/no configurado + token inválido/vacío/null). Suite completa: 746 tests OK, cero regresiones.

### Códigos de respuesta

El endpoint público expone códigos JSON explícitos para el frontend:

| HTTP | code | Significado |
|---|---|---|
| 200 | — | Login/registro OK (cookies JWT puestas) |
| 401 | `INVALID_TOKEN`, `INVALID_TOKEN_PAYLOAD` | ID token no verifica |
| 401 | `GOOGLE_EMAIL_NOT_VERIFIED` | Google reporta email no verificado |
| 403 | — | Age gate no confirmado |
| 404 | `NO_ACCOUNT_FOR_EMAIL` | intent=login pero no existe cuenta con ese email |
| 409 | `EMAIL_COLLISION_NEEDS_PASSWORD` | Cuenta existente sin email verificado — usuario debe entrar con password |
| 400 | `INVALID_INTENT` | intent no ∈ {login, register-client} |
| 503 | `GOOGLE_AUTH_UNAVAILABLE` | Property no configurada |

Los endpoints autenticados (`/api/users/me/...`) usan además:
`ALREADY_LINKED`, `SUB_ALREADY_LINKED_TO_OTHER_USER`, `NEEDS_PASSWORD_FIRST`, `NOT_LINKED`, `PASSWORD_ALREADY_SET`.

## Alternativas consideradas

**Facebook Login**. Rechazado. El estudio confirma retirada estructural en el sector: Hinge lo retiró tras update de Meta; Bumble lo hizo opcional y no disponible en web; OkCupid lo desactivó en iOS. No recomendable priorizar.

**Sign in with Apple (Fase 1)**. Diferido a Fase 2. Obligatorio si se publica app iOS con otros SSO (Apple App Store guideline 4.8). SharemeChat es web-only en soft-launch — sin urgencia. Apple Sign In tiene ventaja de privacidad (email relay) muy valorada en adult; se añade cuando escale o haya app iOS.

**Magic link / passkeys (Fase 3+)**. Diferidos. Magic link (email OTP) es alternativa federada sin depender de Google. Passkeys (WebAuthn/FIDO2) es la dirección futura del sector (Bumble y Badoo ya los ofrecen como método secundario). Se consideran cuando la base crezca o si Google rechaza brand verification adult.

**SSO diferenciado por rol (CLIENT + MODEL en Fase 1)**. Rechazado. No hay precedente público documentado; añadir MODEL desde el día 1 pisa terreno virgen sin dato de adopción. Coste bajo, riesgo asimétrico. Se puede añadir después con 1 línea de frontend.

**Política P3 pura (exigir password siempre para vincular)**. Descartada frente a híbrido P2/P3. P3 puro es más seguro pero introduce fricción innecesaria al 90% de casos donde ambos emails están verificados. Híbrido preserva la seguridad (rechaza si el email de origen no está verificado) sin fricción para el caso feliz.

## Consecuencias

### Positivas

- **Reducción de fricción de registro CLIENT** (estimado 10-60% según vendedores de SSO; el único dato independiente MailChimp reporta +3.4% — el estudio marca sesgo comercial en cifras altas).
- **Alineación con precedente adult moderno** (OnlyFans).
- **Cero migración del modelo auth actual** (JWT stateless custom se mantiene).
- **Fallback email+password garantizado** — si Google Cloud revoca la OAuth app o falla, los usuarios pueden loguearse igual.
- **Multi-provider desde el origen** — infra lista para añadir Apple/Twitter con cambio menor.

### Negativas

- **Nueva superficie de dependencia** con Google Cloud (revocación de OAuth app posible, aunque sin precedente adult conocido).
- **CSP requiere ampliación** para permitir `https://accounts.google.com` en `script-src` y `frame-src`.
- **Compliance añadido**: política de privacidad debe reflejar el tratamiento de datos Google (nombre, email, foto de perfil). Cookie banner debe mencionar GIS.
- **Riesgo empírico de brand verification adult** — no documentado en la industria europea. Mitigación: modo Testing en Fase 1, publicación a Production después de validar TEST/AUDIT/PROD.

### Neutrales

- **Age gate/KYC propio se mantiene intacto**. El SSO y el age verification son ejes ortogonales — Google Sign-In no cambia la responsabilidad DSA/OSA/SREN.
- **Auth-risk pipeline separado**: nuevo canal `product-google` permite dashboards y reglas rate-limit distintas del login clásico.

## Impacto

### Impacto en código

Ya implementado en Fase 1 backend (2026-08-05); ver "Alcance de la implementación" arriba.

Pendiente:
- Frontend: cargar script GIS + componente `GoogleSignInButton` + integrar en `LoginModalContent.jsx` vistas login y register-client; sección "Cuentas vinculadas" en perfil.
- CSP nginx: ampliar `script-src` y `frame-src` con dominios GIS.
- Deploy TEST: env var `GOOGLE_OAUTH_CLIENT_ID` en `/opt/sharemechat/config.env`, deploy backend (aplica V47+V48), deploy frontend.

### Impacto en documentación

- Política de privacidad (nuevo tratamiento de datos Google).
- Cookie banner (mención GIS).
- Los ADRs relacionados (auth actual, security config) siguen vigentes sin cambio.

### Impacto en operaciones

- Nueva env var `GOOGLE_OAUTH_CLIENT_ID` a poblar en `config.env` de cada entorno.
- Consent screen a publicar a Production (Google Cloud Console) cuando TEST/AUDIT/PROD validen el flujo.
- Monitoring: dashboards auth-risk con filtro canal `product-google` para separar telemetría de login federado del clásico.

## ADRs relacionados

- **ADR-032** — CDN aware perimeter (IP client): reutilizado por rate-limit del endpoint Google.
- **ADR-052 §D11** — retirada del programa afiliadas: no afecta al login federado.
- **ADR-056** — Sistema Master/Studio: los roles MODEL/MASTER quedan explícitamente fuera del alcance Fase 1 según la decisión D2.
- **ADR-057** — Atribución de origen capa B: la fuente de captación se persiste en `user_acquisition` al registrar (por `/api/auth/google` cuando crea user nuevo, integración pendiente en next iteration si se decide capturar UTM también en el flujo Google).

## Estudio de referencia

Estudio profundo sectorial (2026-08-05) archivado en `Sharemechat_Aplicaciones/SECURIZACION/Login-google.pdf`. 7 páginas con fuentes citadas: Google API Services User Data Policy (15 feb 2024), Apple App Store guideline 4.8, Comisión Europea DSA guidelines (14 jul 2025), UK Online Safety Act (Ofcom), ley francesa SREN + référentiel ARCOM (enero 2025), procedimientos DSA formales contra Pornhub/Stripchat/XNXX/XVideos (mayo 2025, preliminary findings marzo 2026), reviews Chaturbate/Stripchat/LiveJasmin/OnlyFans, y fuentes técnicas Firebase/Clerk/Ory/WorkOS sobre patrones de account linking.
