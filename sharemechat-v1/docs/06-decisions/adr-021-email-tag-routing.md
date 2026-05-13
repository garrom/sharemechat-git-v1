# ADR-021 — Trazabilidad operativa de emails con alias +tag (Microsoft 365)

## Estado

Aceptada (2026-05-12).

Documenta la convención adoptada en Sub-pasada 2D / D2 para todos los enlaces `<a href="mailto:...">` del frontend público. Complementa a [ADR-020](./adr-020-blog-spa-seo.md) (cierre de la Sub-pasada 2C) y al resto de cambios de la Sub-pasada 2D (D1 = AI-Assisted Content en `/legal`, D2 = patrón +tag, D3 = mensajes de error amigables) consolidados en el commit del 2026-05-12.

## Contexto

SharemeChat usa Microsoft 365 Business como proveedor de correo. Solo existe una cuenta real: `operations@sharemechat.com`. Todos los demás buzones visibles públicamente (`contact@`, `support@`, `demo@`, etc.) son alias que entregan en `operations@`. Esto es deliberado: el equipo es pequeño y centralizar la bandeja simplifica respuesta y archivado.

Microsoft 365 (igual que Gmail, Outlook.com y la mayoría de proveedores SMTP modernos) soporta el truco del `+tag` en la parte local del email. Cuando llega correo a `contact+xxx@sharemechat.com`:

- El servidor lo entrega en el buzón asociado a `contact@` (ignorando el `+xxx` para enrutado).
- Mantiene el valor original en la cabecera `To:`, permitiendo filtros automáticos por patrón.
- No requiere alias adicionales en el panel admin: el `+xxx` se inventa en el origen.

Antes de la Sub-pasada 2D, el frontend mostraba `contact@sharemechat.com` como **texto plano** en todas las superficies públicas excepto en `AgeGateModal.jsx`, único punto que ya usaba `<a href="mailto:">`. Consecuencia operativa: cualquier correo entrante llegaba a `operations@` sin información del origen (footer global, página legal, FAQ, reglas de la sala, etc.). Distinguir un usuario que reporta abuso desde el AgeGate de un usuario que pregunta sobre privacidad desde `/legal` requería leer el cuerpo del email.

Adicionalmente, `Legal.jsx` mantenía un `support@sharemechat.com` literal en la sección 23 de Terms que entregaba al mismo buzón que `contact@`. Funcionalmente redundante y visualmente ruidoso.

## Opciones consideradas

### Opción A — 20 tags distintos (granularidad máxima)

Un tag por sección, tab o componente: `+footer`, `+faq`, `+safety`, `+rules`, `+config`, `+agegate`, `+terms`, `+privacy`, `+refunds`, `+cookies`, `+ai`, `+complaints`, `+appeals`, `+takedown`, `+rights`, ...

Pros:
- Trazabilidad máxima: cada email revela la pantalla exacta de origen.
- Útil si hubiera analítica fina sobre qué sección genera más contacto.

Contras:
- 20 reglas de filtrado en M365 a mantener, con sintaxis no trivial.
- Riesgo alto de typo o desincronización entre frontend y reglas (si se renombra un tag, hay que tocar dos sitios).
- Sobrecarga operativa desproporcionada al volumen actual (proyecto pre-PRO, contacto entrante esporádico).
- La mayoría de las "secciones" comparten naturaleza operativa (todas las páginas marketing del footer mandan a la misma cola humana).

Descartada por sobre-ingeniería para la fase actual.

### Opción B — 3 tags semánticos (web/legal/gdpr) (elegida)

Tres tags que agrupan por **flujo operativo**, no por pantalla:

- `web`: páginas marketing/UX donde el contacto es soporte general no urgente.
- `legal`: contenido legal informativo donde el contacto es interpretativo o aclaratorio.
- `gdpr`: peticiones formales con plazos legales asociados (rights, complaints, appeals, takedown).

Pros:
- Tres reglas M365 manejables, una por carpeta de bandeja.
- Los tres flujos tienen SLA y tono de respuesta distintos: la agrupación refleja la operativa real.
- Extensible: añadir un cuarto tag (`+pipeline`, `+admin`, etc.) cuando aparezca un flujo nuevo es trivial.

Contras:
- Pierde granularidad fina (no se distingue Footer de FAQ; ambos van a `+web`). Aceptable.

Elegida.

### Opción C — 2 tags (web/legal)

Mínimo viable: solo `+web` y `+legal`, agrupando GDPR dentro de legal.

Pros:
- Aún más simple: dos reglas M365.

Contras:
- Las peticiones GDPR tienen plazos legales (30 días para responder al ejercicio de derechos del Reglamento UE 2016/679). Mezclarlas con consultas legales informativas significa que una petición formal puede quedar enterrada en la misma carpeta.
- La carpeta GDPR necesita visibilidad propia para auditoría y monitorización de plazos.

Descartada: el coste de añadir un tercer tag es despreciable y el beneficio operativo (carpeta GDPR aislada) es significativo.

## Decisión

Adoptar el patrón de alias `+tag` en todos los `<a href="mailto:">` del frontend, con tres tags semánticos:

- `web` → páginas marketing/UX (Footer global, FAQ, Safety, Rules, Config, AgeGate).
- `legal` → contenido legal informativo (Terms, Refunds, Cookies, AI-Assisted Content, enlace del footer interno de `/legal`).
- `gdpr` → peticiones formales con plazos legales (Privacy Rights, Complaints, Appeals, Takedown).

El patrón aplicado en JSX:

```jsx
<a href="mailto:contact+TAG@sharemechat.com">
  contact@sharemechat.com
</a>
```

- **Email visible al usuario**: `contact@sharemechat.com` (limpio, sin `+tag`).
- **Email destinatario real (`href`)**: `contact+TAG@sharemechat.com`.
- **Entrega final**: `operations@sharemechat.com` vía alias M365.

Aplicado en 19 enlaces a lo largo de 7 ficheros del frontend (`Footer.jsx`, `Faq.jsx`, `Safety.jsx`, `Rules.jsx`, `Config.jsx`, `Legal.jsx`, `AgeGateModal.jsx`). Antes de 2D existía un único `<a mailto>` (en AgeGate); tras 2D existen 19.

**Decisión secundaria**: eliminado el `support@sharemechat.com` duplicado de `Legal.jsx` (Terms, sección 23). Entregaba al mismo buzón que `contact@` y solo generaba ruido visual al lector.

**Decisión Z1 (i18n)**: el JSON i18n guarda solo el texto visible del email (`contact@sharemechat.com`); el atributo `href` con el `+tag` vive hardcoded en el JSX. Si en el futuro hay locales que cambien el dominio del email (caso improbable), se aborda en una sub-pasada de i18n específica. Aplicado coherentemente en `AgeGateModal.jsx`, que consume el texto visible vía clave `consent.ageGate.report.email` pero mantiene el `href` en JSX.

## Justificación

La pregunta operativa era: ¿cómo obtenemos trazabilidad de origen en los emails entrantes sin levantar infraestructura adicional ni multiplicar buzones reales?

Microsoft 365 (igual que Gmail) respeta `+tag` de forma nativa, sin requerir alias dados de alta en el panel admin. El operador solo configura reglas de bandeja por patrón `to:contact+TAG@sharemechat.com`. Tres reglas en M365 son perfectamente manejables; veinte no lo serían.

La elección de los tres tags refleja **flujos operativos diferenciados**, no agrupación arbitraria:

- `web` es la cola humana general, sin plazo legal asociado.
- `legal` es interpretación o aclaración de contenido publicado, sin plazo formal asociado pero con tono más cuidadoso.
- `gdpr` tiene plazos legales del RGPD (artículos 12, 15-22, 77). Mezclar GDPR con `legal` genera riesgo regulatorio operativo bajo, pero no nulo.

Mantener el email visible **sin** el `+tag` es deliberado: el usuario que copia el email del navegador a su gestor de correo lo escribe limpio. Si se copia, pierde trazabilidad de origen, pero llega igualmente. Es un trade-off consciente: priorizamos UX del usuario (un email memorable y limpio) sobre la traza al 100% (que con el clic en `mailto:` se mantiene de todos modos para el caso mayoritario).

## Impacto

**Arquitectura**:
- Cero cambios en backend, DTOs, esquema SQL ni configuración de hosting.
- Cero dependencias nuevas en `package.json` ni `pom.xml`.
- Cero migraciones de datos.

**Código frontend**:
- 7 ficheros modificados: `frontend/src/footer/Footer.jsx`, `Faq.jsx`, `Safety.jsx`, `Rules.jsx`, `Config.jsx`, `Legal.jsx`, `frontend/src/consent/AgeGateModal.jsx`.
- 19 enlaces `<a mailto>` creados (antes había 1 en AgeGate).
- 1 línea eliminada en Legal Terms sección 23 (`support@` duplicado).
- Cero cambios en JSON i18n (el texto visible ya estaba presente; el `href` no es i18nable por Z1).

**Operaciones (M365)**:
- 1 alias real necesario: `contact@sharemechat.com` (más el `operations@` real subyacente). Ya existía antes de 2D.
- 3 reglas de filtrado por bandeja a configurar en M365 (operativa del administrador, no del código):
  - `to:contact+web@sharemechat.com` → carpeta "Web".
  - `to:contact+legal@sharemechat.com` → carpeta "Legal".
  - `to:contact+gdpr@sharemechat.com` → carpeta "GDPR" (con plazo del RGPD asociado).

**Despliegues**:
- Un único deploy frontend con toda 2D (D1 + D2 + D3) agrupada en el commit del 2026-05-12.

## Consecuencias

### Positivas

- **Trazabilidad de origen sin abrir el email**: la cabecera `To:` revela el flujo operativo del que viene.
- **Bandeja organizada** en tres carpetas (Web / Legal / GDPR) mediante reglas M365 estáticas.
- **Cero infraestructura adicional**: solo una convención de naming y tres reglas en el panel admin.
- **Patrón extensible**: si en el futuro hace falta `+admin`, `+pipeline`, `+careers`, etc., basta añadir el tag en el JSX y una regla M365 más. No hay que tocar DNS, backend ni base de datos.
- **Coherencia visual**: todos los emails visibles del frontend son ahora `contact@sharemechat.com` (limpio, memorable, sin `support@` duplicado).
- **Reducción de superficie**: eliminado un email visible (`support@`) que era redundante.

### Negativas / aceptadas

- **El usuario que copia el email manualmente pierde la traza**: escribe a `contact@` sin tag y cae en la cola general de M365 (sin filtrado a carpeta). Aceptable: el email llega, la pérdida es solo de metadato operativo.
- **El `+tag` es visible al usuario** en el cliente de correo al redactar (campo "Para" mostrará `contact+legal@sharemechat.com`). Visible, no oculto. Aceptable: no es información sensible y forma parte del estándar RFC 5233 para subaddressing.
- **Algunos clientes de correo muy antiguos podrían escapar `+` como `%2B`** en URIs `mailto:`. La RFC 6068 permite `+` literal en la parte local. M365 interpreta correctamente ambas formas. Riesgo residual mínimo, sin medidas adicionales.
- **Sin tests automatizados** que verifiquen el mapping visible↔tag en cada superficie. Aceptado a tamaño actual; mitigable con E2E (Playwright/Cypress) cuando exista la suite.

### Trade-offs

- Tres tags (Opción B) frente a granularidad máxima (Opción A): se renuncia a saber la pantalla exacta del clic a cambio de mantener tres reglas M365 en lugar de veinte. El balance favorece la simplicidad operativa.
- Email visible limpio (`contact@`) frente a email visible con tag (`contact+web@`): se renuncia a la traza del usuario que copia-pega a cambio de UX y memorabilidad. Decisión consciente.

## Notas

### Notas operativas

- **Las reglas M365 son responsabilidad del operador**, no del código. Si en el futuro se quiere reasignar un tag a otro buzón real, basta cambiar la regla en el panel; el frontend no se toca.
- **Auditoría rápida** del mapping visible↔tag en el código:
  ```
  grep -rn "mailto:contact+" frontend/src/
  ```
  Debe devolver 19 ocurrencias agrupadas en los 7 ficheros listados.
- **Riesgo de typo en tags**: bajo, solo 3 valores válidos (`web`, `legal`, `gdpr`). Mitigable con constantes JS exportadas si el número de superficies crece (no aplicado por simplicidad).
- **Deploy y propagación**: tras desplegar el frontend, los nuevos `mailto:` están vivos. Las reglas M365 se aplican a partir del primer email entrante con el patrón correspondiente; no requieren backfill.

### Alternativas futuras consideradas

- **Mover los emails a configuración runtime** (`window.__CONFIG__` o similar) por si los tags cambian sin redeploy. Decisión diferida: hoy no aporta valor (los tags son estáticos y el redeploy frontend es operativamente trivial).
- **Variantes de subdominio** (`legal@legal.sharemechat.com`, `gdpr@gdpr.sharemechat.com`) en lugar de tags. Más limpio estéticamente y permitiría reputación SMTP separada por flujo, pero requiere registros DNS, alias M365 reales y mayor coste operativo. Descartada por desproporcionada para el volumen actual.
- **Tests E2E** que verifiquen que cada superficie pública renderiza el `href` correcto. Pendiente hasta que exista suite Playwright/Cypress.

### Deuda generada

- **Coherencia de marca con `support@`**: tras eliminar el `support@` duplicado de Legal Terms sección 23, ningún `support@` aparece ya en el frontend público. Si producto/marketing quiere reintroducirlo como alias visible separado de `contact@`, requiere sub-pasada cosmética coordinada con una regla M365 adicional.
- **Coherencia con i18n (Z1)**: AgeGate consume el email visible vía clave `consent.ageGate.report.email`, pero el `href` está hardcoded en JSX. Coherente con la decisión Z1. Si en el futuro un locale necesita dominio distinto, sub-pasada i18n específica.
- **Sin tests automatizados** que verifiquen el mapping visible↔tag (mencionado en Notas operativas y Alternativas).
- **Placeholder en `AdminAdministrationPanel.jsx`** usa `usuario@sharemechat.com` como ejemplo de input. No es un email funcional ni una superficie pública: queda fuera del alcance de este ADR.

## Referencias

- [ADR-020](./adr-020-blog-spa-seo.md) — Cierre de la Sub-pasada 2C (SEO industrial en SPA del blog). ADR-021 documenta la Sub-pasada 2D / D2, posterior y de alcance distinto.
- [ADR-019](./adr-019-blog-spa-react.md) — Blog servido desde SPA React. Plantilla estructural seguida por ADR-020 y ADR-021.
- [ADR-017](./adr-017-state-snapshots-and-docs-coexistence.md) — Coexistencia de snapshots y documentación narrativa. Patrón aplicado al documentar Sub-pasada 2D.
- `frontend/src/footer/Footer.jsx` — Footer global, enlace `+web`.
- `frontend/src/footer/Faq.jsx` — FAQ pública, enlace `+web`.
- `frontend/src/footer/Safety.jsx` — Safety guidelines, enlace `+web`.
- `frontend/src/footer/Rules.jsx` — Reglas de la sala, enlace `+web`.
- `frontend/src/footer/Config.jsx` — Página de configuración pública, enlace `+web`.
- `frontend/src/footer/Legal.jsx` — Página `/legal` con 8 tabs (Terms/Refunds/Cookies/Privacy Rights/Complaints/Appeals/Takedown/AI-Assisted Content), enlaces `+legal` y `+gdpr` según tab; `support@` eliminado.
- `frontend/src/consent/AgeGateModal.jsx` — Modal de age gate, enlace `+web` (texto visible vía i18n key `consent.ageGate.report.email`, `href` hardcoded por Z1).
- RFC 5233 (Sieve subaddressing) y RFC 6068 (URI `mailto:`) — base estándar del patrón `+tag`.
