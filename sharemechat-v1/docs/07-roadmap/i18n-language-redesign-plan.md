# Plan — Idioma unificado + traducción (i18n redesign) — 2026-08-20

**Estado:** ANÁLISIS COMPLETO sobre código fuente + datos reales de BD. Dirección
y decisiones de alcance **aprobadas por el operador**. **Nada implementado aún.**
Arrancamos por **Fase 1 + Fase 2**.

**Idea rectora (decisión del operador):** *un solo idioma por usuario para TODO*.
Si un francés elige "Français" en la home, lo ve **todo** en francés (UI **y** chat).
Se elimina el selector separado de "idioma de chat" (hoy confunde).

**Mock de referencia:** `i18n-language-redesign-assets/mocks/language-selector.html`
(selector tipo dropdown de ancho fijo, estilo LiveJasmin; no crece al cambiar de
idioma; escala a N idiomas sin tocar el navbar).

---

## 0. Distinción CLAVE — dos "idiomas" con alcances distintos

Este frente separa deliberadamente dos cosas que NO tienen el mismo coste ni el
mismo alcance:

| | **Idioma de UI** (traducción de la página) | **Idioma de chat** (traducción de mensajes) |
|---|---|---|
| Qué traduce | Botones, menús, labels, textos del producto | Los mensajes P2P entre usuarios |
| Coste por idioma | ALTO (~3.249 cadenas/idioma + URL/SEO) | CERO marginal (motor ya existe) |
| Cuántos idiomas | **Pocos y curados** (fr, de, luego it/pt/nl/pl) | **Cualquiera**, incl. idiomas raros (p.ej. **malgache** — modelos de Madagascar) |
| Motor | i18next + JSON por idioma | Google Cloud Translation v2 (ya ON en TEST) |

> **Regla de producto (operador):** la traducción **total de la página** se limita
> a pocos idiomas a corto plazo; la **traducción de chat** debe poder activarse para
> *cualquier* idioma en cualquier momento (no importa que la página externa no esté
> en malgache; importa que el chat con esa modelo sí se traduzca).

Implicación técnica: el set de **idiomas de UI** (`SUPPORTED_LOCALES` frontend +
validación backend) y el set de **idiomas de chat** (`SupportedChatLanguages`) son
**listas independientes**. La segunda puede crecer (o abrirse a los 130+ de Google)
sin tocar la primera.

---

## 1. Estado real (fuente leída — evidencia)

Hoy conviven **tres** conceptos de "idioma", desconectados entre sí:

1. **Idioma de UI — `users.ui_locale`** (`entity/User.java`, `VARCHAR(5)`, NOT NULL).
   - Solo `es`/`en`. `service/UserService.java#normalizeUiLocale` **recorta a es/en**
     (devuelve null para cualquier otro, incl. `fr`).
   - Frontend: i18next (`i18n/index.js`), `SUPPORTED_LOCALES=['es','en']`
     (`i18n/localeConfig.js`), **atado a la URL** (`/en` → EN; sin prefijo → ES;
     `i18n/localeUtils.js#getInitialLocale`), persistido en `localStorage`
     (`sharemechat.uiLocale`) + backend. Selector = pills ES/EN
     (`components/LocaleSwitcher.jsx` + `styles/NavbarStyles.js` `LocaleButton`).
   - **Cobertura i18n del producto: ALTA** — 1.916 usos de `t()`, 0 placeholders
     hardcodeados. **Pero** queda una **cola de literales sin `t()`**, sobre todo
     en `alert()`/errores de `DashboardClient.jsx` / `DashboardModel.jsx`
     (p.ej. `alert('Tienes una LLAMADA activa…')`, `'No se pudo enviar el mensaje…'`).

2. **Idioma de chat — `users.preferred_chat_lang`** (`VARCHAR(5)`, nullable, fallback
   a `ui_locale`).
   - **Traductor YA CONSTRUIDO y ENCENDIDO** (verificado en TEST:
     `TRANSLATION_GOOGLE_ENABLED=true` + API key presente en `config.env`/`secrets.env`).
   - Auto-traduce los mensajes **recibidos** al idioma del viewer, cachea en
     `message_translations` (UNIQUE `(message_id, target_lang)`), toggle global
     "Ver original", modo degradado (503 `TRANSLATION_UNAVAILABLE`) si no hay key.
   - Target lang (`hooks/useTranslationSettings.js`): `preferredChatLang || uiLocale`.
   - 15 idiomas (`constants/SupportedChatLanguages.java`): es,en,pt,fr,it,de,nl,pl,ru,
     ja,zh,ko,ar,tr,ro. Proveedor `service/translation/GoogleCloudTranslationClient.java`,
     config `config/TranslationProperties.java` (`translation.google.*`).
   - Se fija en una card del Perfil (`components/PreferredChatLangCard.jsx` →
     `PUT /api/users/me/preferred-chat-lang`).

3. **Idiomas hablados — tabla `user_languages`** (`entity/UserLanguage.java`,
   unique `(user_id, lang_code)`).
   - Es lo que ve el cliente como "Idioma" en el spotlight y en "ver perfil"
     (`service/ModelService.java#getPublicProfile` lee `user_languages`).
   - Se **siembra UNA sola vez** en el registro desde `ui_locale`
     (`UserService#seedPrimaryLanguageIfMissing`, guard "solo si vacío" → **nunca
     se re-siembra**). **No existe UI para editarlo.**
   - `UserLanguageRepository.findByUserId` **sin `ORDER BY`** → orden no determinista.

### 1.1 La incongruencia "selecciono ES y se ve FR" (caso Guarris — datos reales)

Fila real en TEST (id=31): `ui_locale='en'`, `preferred_chat_lang=NULL`,
`country_detected='FR'`, y `user_languages.lang_code='fr'` (primario).

- Lo que el cliente ve (**FR**) sale del concepto **#3** (`user_languages`), **no**
  de la IP en tiempo de render. Ese idioma se **sembró en el registro** desde el
  navegador (`Accept-Language`) y quedó **congelado**, sin pantalla para corregirlo.
- El `'fr'` de Guarris es **legacy**: el código vigente solo siembra es/en (recorta
  el resto), así que esa fila entró a mano o de una versión antigua.
- El selector que la modelo cree que fija "su idioma" (card del Perfil) escribe el
  **#2** (`preferred_chat_lang`), que **no toca** el #3 → toca una cosa y se muestra
  otra. **Ésa es la incongruencia.**

### 1.2 Corrección de un malentendido

"Ahora no puede traducir al francés porque no está desarrollado" es **inexacto**:
el motor existe y está **encendido**. Un usuario con idioma de chat `fr` **ya**
recibe todo traducido al francés hoy. Lo que falta es **plomería/UX**: el selector
solo ofrece es/en y los 3 conceptos están fragmentados/ocultos.

---

## 2. Modelo unificado (decisión aprobada)

- **Un solo idioma por usuario** gobierna UI + chat. Al elegir "Français":
  `ui_locale='fr'` (UI en francés) **y** ese mismo valor es el destino de traducción
  de chat (el hook ya usa `preferred_chat_lang || ui_locale`, así que con `ui_locale`
  basta).
- `preferred_chat_lang` queda **redundante** → se depreca / auto-sincroniza; se
  retira la `PreferredChatLangCard`.
- **Solo producto.** El **backoffice NO se traduce** (queda es/en).

---

## 3. Decisiones de alcance (cerradas con el operador 2026-08-20)

| Punto | Decisión |
|---|---|
| Idiomas de UI iniciales | **fr + de** primero; luego **it, pt, nl, pl**. |
| Idiomas de chat | Lista **independiente y ampliable** a idiomas raros (malgache, etc.). |
| Backoffice | **NO** se traduce. |
| Contrato Master | **Solo inglés** (no se traduce). |
| KYC / textos legales / consentimiento | **Solo inglés** (con inglés se cumple; práctica habitual — revisar). |
| Emails transaccionales | **Standby** (anotado; se hará más adelante). |
| Página de modelos + página de estudios | **Standby**. |
| Blog | **Sección aparte** dentro de este proyecto, **standby** (ver `i18n-language-redesign-assets/blog-i18n-standby.md`). |
| Traducción de las cadenas de UI | **Máquina (Google, ya lo tenemos) + revisión del operador.** |
| Script de sincronización de claves i18n | **Sí**, se crea. |

---

## 4. Puntos delicados (registro de riesgos — ser riguroso)

1. **Cola de textos hardcodeados** → si no se envuelven en `t()`, se quedan en
   español. Prioridad en `DashboardClient.jsx`/`DashboardModel.jsx` (`alert()`,
   errores). Tarea acotada de auditoría+wrap. **Bloquea la calidad de Fase 1.**
2. **URL + SEO (ADR-022)**: el idioma va atado a la URL (`/en`) con `hreflang`.
   Añadir idiomas = prefijos `/fr` `/de` + `hreflang` + sitemap. Trabajo de routing,
   no solo JSON. Sensible en el blog por la estrategia GEO.
3. **Contenido ≠ UI**: el JSON traduce el chrome del producto; NO traduce blog
   (contenido autoral), contrato (PDF) ni emails (plantillas). Alcance ya decidido
   (contrato/KYC = EN; blog/emails/páginas modelos-estudios = standby).
4. **Textos legales/sensibles**: contrato y KYC quedan **en inglés** (decisión). El
   resto de UI puede ir máquina + repaso.
5. **Fallback y mantenimiento**: i18next cae a `en` si falta una clave en `fr` → no
   rompe, pero se ve mezclado hasta completar. Cada feature nueva añade claves a N
   ficheros → **script de sincronización** (rellena por máquina las faltantes) +
   guard opcional en CI de "claves que faltan".
6. **RTL/CJK**: de los idiomas de chat, `ar` es RTL y `ja/zh/ko` CJK (coste de
   layout). El set de **UI** se mantiene **LTR europeo** (fr/de/it/pt/nl/pl) → sin
   coste de maquetación. ar/cjk/malgache viven **solo en traducción de chat**.

---

## 5. Fases

### Fase 1 — Idioma unificado + selector nuevo + UI en fr/de
- **Backend**: ampliar la validación de `ui_locale` (nuevo `SupportedUiLocales` o
  ampliar `normalizeUiLocale`) al set de UI. `ui_locale` ya es `VARCHAR(5)` → **sin
  migración de esquema**. Deprecar `preferred_chat_lang` (auto-sincronizar con
  `ui_locale`; el fallback ya lo cubre).
- **Frontend**:
  - i18n: `SUPPORTED_LOCALES=[es,en,fr,de,…]`, `LOCALE_LABELS`, importar
    `fr.json`/`de.json`.
  - Selector: `LocaleSwitcher` de pills → **dropdown** (el mock).
  - Routing/URL: soportar prefijos `/fr` `/de` + `hreflang`.
  - Generar `fr.json`/`de.json` (máquina + revisión).
  - **Auditar y envolver la cola de hardcodeados** (punto delicado #1).
- **Sync script**: herramienta para rellenar claves faltantes por idioma (punto #5).

### Fase 2 — Arreglar la incongruencia del perfil (`user_languages`)
- Endpoint `PUT /me/languages` (editar `user_languages`) + card "Idiomas que hablo"
  (modelo y cliente), con los 15 códigos.
- Sincronizar/limpiar datos legacy (el `fr` de Guarris y similares).
- Retirar `PreferredChatLangCard` (idioma ya unificado).
- Añadir `ORDER BY` determinista a `findByUserId` (deuda menor detectada).

### Fase 3 — Sugerencia inteligente en el registro (barato; ya tenemos los datos)
- Proponer idioma por `Accept-Language` + `country_detected` (ambos ya se capturan
  vía CDN headers, `CountryAccessService.resolveViewerCountry`) con banner sugerente,
  sin imponer. Un usuario de Francia arranca con francés propuesto.

### Fase 4 — Ampliar idiomas de UI (it, pt, nl, pl) + traducción de chat a idiomas raros
- Repetir el proceso de Fase 1 para los siguientes idiomas de UI.
- **Chat**: ampliar `SupportedChatLanguages` (o abrirlo) para idiomas raros
  (malgache, etc.) — coste marginal cero en motor.

---

## 6. Standby / pendientes anotados (no se pierden)

- **Emails transaccionales** en fr/de (hoy `EmailLocaleResolver` colapsa a es/en).
- **Página de modelos** + **página de estudios** (localización).
- **Blog** multi-idioma → `i18n-language-redesign-assets/blog-i18n-standby.md`.
- **Contrato Master** y **KYC/legal**: se quedan en inglés (decisión, no pendiente).

---

## 7. Próximo paso

Con las decisiones cerradas, el siguiente entregable es el **listado exacto
fichero-a-fichero de Fase 1** (backend + frontend + routing + sync script) para OK
del operador antes de escribir código (política: análisis punta a punta → PARAR →
editar tras OK).
