# Gating de registro: país, dominio de email y modo

Cómo se decide si un alta (cliente o modelo) se permite. Reúne tres mecanismos que
actúan **en cadena** sobre `POST /api/users/register/{client,model}`. La fuente de
verdad de las llaves es `src/main/resources/application.properties` (anclado por
tests); aquí se explica el **comportamiento**, no se duplican defaults que puedan
derivar.

Para **qué países** están permitidos y **por qué** (competencia + compliance), ver
[`docs/01-business/competitor-country-registration-analysis-2026-08-28.md`](../01-business/competitor-country-registration-analysis-2026-08-28.md).
Para el **modo operativo** y el coming-soon, ver [`product-flags.md`](./product-flags.md)
y [ADR-009](../06-decisions/adr-009-product-operational-mode.md).

## Orden de capas en un registro de cliente

Un alta de cliente atraviesa, en este orden (ver `UserController.registerClient` +
`UserService.registerClient`):

1. **Age gate (18+)** — el controller exige la cookie de consentimiento de edad
   (`consentService.hasGuestAgeGate`); sin ella → `403 "Debes confirmar…mayor de 18"`.
   La pone el flujo de la SPA (modal 18+ de la landing).
2. **Gate de país** — `countryAccessService.assertAllowedForClientRegistration`
   (ver abajo). País no permitido → `403` con code `REGISTRATION_UNAVAILABLE`.
3. **Gate de modo de registro** — vía filtro/`ProductOperationalModeService`: si el
   modo del rol es `CLOSED` o `product.registration.client.enabled=false` →
   `REGISTRATION_CLOSED`. `PRELAUNCH` **no** cierra el registro (solo el go-live).
4. **Validación de dominio de email** — `EmailDomainValidator.domainLikelyValid`
   (ver abajo). Dominio inexistente → `400` "el dominio del correo no existe".
5. Reglas de negocio (nickname único, política de contraseña, email ya existente →
   respuesta uniforme anti-enumeración) y alta efectiva + email de verificación.

Tras el alta, el acceso al **videochat** lo gobierna aparte
`product.golive.client.enabled` (coming-soon); en `PRELAUNCH` el cliente puede
registrarse pero ve "próximamente" hasta el go-live. El registro y el go-live son
llaves independientes.

## 1. Gate de país (allowlist)

Implementado en `CountryAccessService`. **Modelo de allowlist** (deny-by-default):
solo pasan los países listados. Decisión de hardening 2026-05-27 (sustituyó a una
blocklist previa); se mantiene por ser la postura segura de compliance (un país no
vetado, o un geo que no resuelve, queda bloqueado por defecto).

Llaves (`country.access.*` en `application.properties`, valores por caja en
`config.env`):

- `enabled` — activa/desactiva todo el gate.
- `client-registration.allowed-countries` — allowlist ISO-2 para alta de **cliente**.
- `model-registration.allowed-countries` — allowlist ISO-2 para alta de **modelo**.
- `block-when-missing` — si `true` y el país no se resuelve (headers ausentes), se
  **deniega** (fail-closed). Recomendado `true`.
- `bypass-ips` — IPs/CIDR que **saltan** todo el gate (operador, PSPs).

Detalles de comportamiento:

- **Dos listas independientes.** Cliente y modelo tienen allowlists distintas (p. ej.
  un país puede ser modelo pero no cliente). Login/refresh/admin usan la **unión** de
  ambas (`assertAllowed`). El KYC de cliente/modelo (Didit) reusa la lista de su rol.
- **País del visitante**: se resuelve por headers, en orden `CloudFront-Viewer-Country`
  → `CF-IPCountry` → `X-AppEngine-Country` → `X-Country-Code`.
- **Respuesta uniforme**: siempre `CountryBlockedException` → `403` code
  `REGISTRATION_UNAVAILABLE`, mensaje neutro ("Registro no disponible"), sin decir país
  ni scope (anti-fingerprinting). El motivo real va al log server-side. El **frontend
  de registro** traduce ese code a un mensaje claro para el usuario
  (`registerErrorMessage` → `common.errors.countryBlocked`); login/auth **no** usan ese
  helper, así que ahí el mensaje sigue siendo discreto.

### Cambiar la allowlist (operativa)

Es un cambio de **dato** en `config.env` (no de código, no rebuild):

1. Editar la llave (`COUNTRY_ACCESS_{CLIENT,MODEL}_REGISTRATION_ALLOWED_COUNTRIES`) en
   `/opt/sharemechat/config.env` de la caja (backup previo: `config.env.bak-countries`).
2. `sudo systemctl restart sharemechat-<env>.service`.
3. Verificar en el log de arranque: `CountryAccessService initialized: … clientAllowed=N,
   modelAllowed=M, unionAllowed=…`.

Mantener **TEST = PROD** (mismas cadenas) para no acumular drift. Nunca meter países en
embargo integral (p. ej. `CU`) ni de alto riesgo (`RU`) en la lista de **modelo**
(implica payout a esa jurisdicción).

### Ampliación 2026-08-30 — `UA` y `VE` solo en la lista de MODELO

`modelAllowed` pasa de **57 a 59** en TEST y PROD (`unionAllowed` 67). La lista de
**cliente** no se toca.

Motivo, tras el estudio de competencia del mismo día:

- **`VE` (Venezuela)** corrige una incoherencia propia: ya estaba admitida como
  **cliente** y rechazada como **modelo**. Además, buena parte de la mano de obra de
  los estudios colombianos es venezolana migrante.
- **`UA` (Ucrania)** es el sexto mercado mundial de oferta (~19.600 cuentas de modelo)
  y la actividad es legal allí, con encaje fiscal propio. Se asume el riesgo de
  fiabilidad de conexión y de cobro derivado de la guerra: el payout es cripto, no
  depende de banca local.

Ninguna de las dos es sancionada de forma integral. Se mantienen fuera `RU` y `BY`
(sanciones) y `CN`, `TH`, `ID`, `IN`, `VN`, donde producir contenido adulto es delito
para la propia modelo — abrirlas sería reclutar a alguien para delinquir en su país.

## 2. Validación de dominio de email

`EmailDomainValidator` (usado en `UserService.registerClient` y `registerModel`): antes
de crear la cuenta, comprueba por DNS que el **dominio** del email exista (registro MX o
A). Objetivo: cazar typos de dominio (`gmil.com`) que antes pasaban la sintaxis, creaban
cuenta y luego el email de verificación rebotaba en silencio.

- **Fail-open**: solo rechaza cuando el DNS confirma que el dominio NO existe (NXDOMAIN o
  sin MX ni A). Ante timeout/error de red → acepta (no bloquear a legítimos por un fallo
  transitorio). Timeout corto (3 s, 1 reintento).
- No detecta buzón inexistente en dominio válido (eso solo lo caza el rebote real);
  cubre "el dominio no existe".
- Rechazo → `400` "No se pudo registrar: el dominio del correo no existe…".

## 3. Modo de registro y coming-soon

Ver [`product-flags.md`](./product-flags.md): `product.access.mode`,
`product.registration.{client,model}.enabled`, `product.golive.{client,model}.enabled`.
Resumen: `PRELAUNCH` permite **registrarse** pero no entrar al videochat (go-live);
`CLOSED` cierra el registro; `product.access.allowlist.user-ids` salta el coming-soon
para cuentas concretas.

## Verificación de edad (relación con compliance)

La verificación de edad del **cliente** es estimación facial vía Didit, y su gate
(`isApprovedClient`) bloquea el **matching** y el **primer pago** si el KYC no está
APPROVED (no en el alta). Es un método aceptado en jurisdicciones estrictas (UK/FR).
Detalle e implicaciones para EEUU en el anexo §8 del dossier de países.
