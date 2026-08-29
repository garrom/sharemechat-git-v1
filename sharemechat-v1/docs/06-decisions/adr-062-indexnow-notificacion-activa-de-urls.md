# ADR-062 — IndexNow: notificación activa de URLs a buscadores no-Google

> Estado: VIGENTE
> Fecha: 2026-08-30
> Vigencia esperada: indefinida (protocolo abierto, sin dependencia contractual)
> Reemplaza: N/A (documento nuevo)
> Ver también: [ADR-015](adr-015-canonical-domains-per-environment.md), [ADR-018](adr-018-blog-static-rendering.md), [ADR-033](adr-033-noindex-non-prod-environments.md), [ADR-042](adr-042-prerender-cron-on-backend-ec2.md), [ADR-045](adr-045-keywords-seo-per-locale.md), [`../_archive/07-roadmap/pending-hardening.md`](../_archive/07-roadmap/pending-hardening.md) §6.2, [`../01-business/seo/estrategia.md`](../01-business/seo/estrategia.md)

## Estado

Aceptado.

## Contexto

La estrategia de tráfico orgánico ([`estrategia.md`](../01-business/seo/estrategia.md)) asume que el descubrimiento de contenido es **pasivo**: se publica un artículo, se lista en `/sitemap.xml` y se espera a que el crawler pase. Para un dominio con autoridad establecida eso basta. Para `sharemechat.com` no.

Medición del 2026-08-29 contra los sistemas vivos (GA4 Data API y Search Console API, no documentación):

- **Search Console, agosto**: 53 impresiones, 14 clics, posición media 14,9. La trayectoria de clics es la correcta (5 el 10-ago → 10 el 21-ago → 14 el 29-ago), pero el volumen absoluto es marginal.
- **Inspección de URLs**: `/modelos` figuraba como *"URL desconocida para Google, nunca rastreada"* pese a estar en el sitemap desde junio. Dos de los tres artículos de captación de modelos, igual. El sitemap se descarga (última: 25-ago) pero Google no gasta presupuesto de rastreo en un dominio joven de este vertical.
- **Canal `AI Assistant` en GA4** (30 días): 10 sesiones con 9 *engaged*, frente a **7 sesiones** de Google orgánico. Menor volumen, mejor calidad, y ya por delante del buscador.

Ese último dato no es una anomalía del mes: §6.2 de `pending-hardening` ya documentaba que **los usuarios que llegan por IA convierten 4-5× más** que los de Google, y que el bloqueo era no estar indexados en Bing, que es la fuente de búsqueda web de ChatGPT y Copilot. El alta en Bing Webmaster Tools (6.2.T1) se completó, pero el panel sigue en **0 impresiones y 0 clics**: estar dado de alta no equivale a estar rastreado.

Existe además una asimetría estructural que conviene explicitar porque cambia el orden de prioridades: Google penaliza la juventud del dominio y aplica escrutinio adicional al vertical adulto; los motores de respuesta de IA, alimentados por el índice de Bing, no aplican el mismo filtro de autoridad. El canal más barato de conseguir hoy no es Google.

## Opciones consideradas

### Opción 1 — No hacer nada: seguir solo con sitemap

Mantener el descubrimiento pasivo y esperar a que la autoridad del dominio crezca.

Pros:
- Coste cero, nada que mantener.
- Es la hipótesis ya asumida en `estrategia.md` (el SEO compone tarde).

Contras:
- Deja sin explotar el único canal con retorno medido hoy.
- El propio panel de Bing señala la ausencia de IndexNow como recomendación principal.
- No corrige el problema observado: URLs en el sitemap que llevan meses sin rastrearse.

### Opción 2 — IndexNow solo como script manual

Quedarse en el paso A: un `.ps1` que se lanza a mano cuando hay contenido nuevo.

Pros:
- Sin cambios en backend ni en el pipeline editorial.
- Reversible y sin superficie nueva de fallo.

Contras:
- Depende de que un humano lo recuerde tras cada publicación. **Ese modo de fallo ya se materializó** en este mismo repo: el pre-render de landings era un paso manual post-deploy y se pudrió en silencio durante semanas (bitácora 2026-08-29).
- El valor de IndexNow es la inmediatez; un aviso que llega días tarde no aporta sobre el sitemap.

### Opción 3 — IndexNow automático desde backend, disparado al publicar

El backend notifica en cuanto un artículo pasa a `PUBLISHED`.

Pros:
- Elimina el paso manual, que es la causa raíz conocida de podredumbre.
- El punto de disparo ya existe y es único (`ContentArticleService`, transición `IN_REVIEW → PUBLISHED`).
- Reutiliza el patrón consolidado de la capa SEO pública (`SitemapController` + gate `isProdApex()` de ADR-033).

Contras:
- Superficie nueva en backend, con una llamada saliente en un flujo de escritura.
- Requiere disciplina de aislamiento para que un fallo del servicio externo no afecte a la publicación.

### Opción 4 — Delegar en un servicio SEO externo

Contratar una herramienta que gestione el envío.

Pros:
- Cero mantenimiento propio.

Contras:
- Coste recurrente por algo que es un POST HTTP.
- Dependencia de vendor para una función trivial, contra el criterio de no introducir vendors innecesarios.
- Implicaría dar acceso a un tercero sobre el dominio.

## Decisión

Se adopta la **Opción 3**, materializada en dos pasos, y se conserva el artefacto de la Opción 2 como herramienta operativa complementaria.

**Paso A (hecho, 2026-08-30)** — `ops/scripts/indexnow-submit-prod.ps1`: publica el fichero de clave en la raíz del bucket PROD y envía las URLs del sitemap. Sirve para la siembra inicial y para reenvíos masivos puntuales (rotación de clave, republicación en bloque). Primera ejecución: 36 URLs, HTTP 202.

**Paso B** — automatización en backend:

- `seo.indexnow.enabled` (**default `false`**), `seo.indexnow.key` y `seo.indexnow.endpoint` en `application.properties`, resolubles por variable de entorno.
- `IndexNowService`: envío **asíncrono y fail-open**. Cualquier excepción se registra y se descarta; nunca propaga.
- `IndexNowKeyController`: sirve `/<clave>.txt` bajo el mismo gate `isProdApex()` que `/sitemap.xml`. Fuera del apex PROD responde 404.
- Disparo en la transición `IN_REVIEW → PUBLISHED` de `ContentArticleService`, envuelto en `try/catch`.
- Endpoint admin de reenvío masivo bajo `/api/admin/**` (ya cubierto por `ROLE_ADMIN`).

Invariantes que la implementación no puede romper:

1. **Publicar un artículo nunca puede fallar por IndexNow.** El envío es un efecto secundario, no parte de la transacción.
2. **Solo el apex PROD notifica.** TEST y AUDIT no envían nada, coherente con el fail-closed de ADR-033: si esos entornos no deben indexarse, menos aún pedir que se les rastree.
3. **Apagado por defecto.** El binario es idéntico en los tres entornos (ONE JAR); la activación vive en el `config.env` de cada caja.
4. **La clave es configuración, no secreto ni código.** Se publica deliberadamente en el dominio; su sitio es `config.env`, nunca el repositorio.

## Justificación

La Opción 3 se elige porque el argumento decisivo no es el rendimiento del canal sino **el modo de fallo**. Este repositorio tiene un precedente reciente y caro: el pre-render de las landings de captación dependía de un paso manual posterior al despliegue, degradaba en silencio (Custom Error Response 403 → 200 sirviendo el shell) y estuvo semanas roto sin que nada lo delatara. Un aviso a IndexNow que dependa de la memoria de un operador reproduce exactamente ese patrón. La contramedida aprendida entonces fue eliminar el paso manual, no documentarlo mejor.

La Opción 1 se descarta porque renuncia al canal con mejor conversión medida por no hacer un POST. La Opción 4, porque introduce coste y vendor para algo que son treinta líneas. La Opción 2 se conserva pero no como mecanismo principal: sigue siendo la herramienta correcta para la siembra inicial y para reenvíos en bloque, que no tienen disparador natural en el ciclo de publicación.

Sobre el protocolo: IndexNow es abierto y lo consumen Bing, Yandex, Seznam y Naver desde un endpoint común. No hay contrato, credencial ni coste, y la propiedad del dominio se demuestra publicando un fichero. El riesgo de dependencia es despreciable: si desapareciera, se borra el fichero de clave y se apaga la flag. **Google no lo consume**; para Google el canal sigue siendo el sitemap, y esta decisión no lo altera.

## Impacto

**Arquitectura.** Una capacidad saliente nueva en la capa de publicación de contenido. Es la primera llamada HTTP saliente del paquete `content/`; se aísla en un servicio propio para que el resto del paquete siga sin conocer red externa.

**Código.** Tres clases nuevas (`IndexNowProperties`, `IndexNowKeyController`, `IndexNowService`), una llamada en `ContentArticleService`, un matcher en `SecurityConfig` y un endpoint admin. Sin migración de base de datos y sin cambios en frontend.

**Operaciones.** Dos variables nuevas en el `config.env` de PROD (`SEO_INDEXNOW_ENABLED`, `SEO_INDEXNOW_KEY`). El fichero de clave vive en el bucket de frontend, fuera del bundle: **un despliegue de frontend no debe borrarlo**. Ver la nota de riesgo más abajo.

**Riesgos.** Un fallo del servicio externo no puede afectar a la publicación, de ahí el aislamiento asíncrono y fail-open. Un envío excesivo puede devolver 429; el volumen editorial real (~4 artículos/mes) queda muy lejos de cualquier umbral.

## Consecuencias

**Positivas**

- Rastreo en horas en lugar de semanas para el canal que hoy mejor convierte.
- Se elimina un paso manual antes de que se convierta en deuda.
- Sin coste, sin vendor, sin credenciales que rotar.

**Negativas**

- Superficie de código nueva que mantener, por modesta que sea.
- Un flag más en el `config.env`, en un sistema que ya tiene bastantes.

**Trade-offs**

- Se acepta una llamada saliente en un flujo de escritura a cambio de que la notificación sea inmediata y no dependa de nadie. El aislamiento asíncrono y fail-open es el precio de esa decisión y no es negociable.
- La automatización cubre artículos, no landings: estas cambian con el despliegue, no con la publicación, y su notificación encaja mejor junto al paso `[4.6/N]` de `deploy-frontend.ps1`. Queda fuera de este ADR.

## Notas

**Riesgo operativo a vigilar.** El fichero de clave vive en la raíz del bucket `sharemechat-frontend-prod`, que es también el destino del `aws s3 sync` del despliegue de frontend. Si ese sync llegara a ejecutarse con `--delete`, borraría la clave y todos los envíos pasarían a responder 403 **en silencio**, porque el Custom Error Response convertiría el 403 de S3 en un 200 con el shell SPA. Es el mismo modo de fallo que motivó este ADR. Mitigación: el paso A es idempotente y republica la clave con `-UploadKeyFile`; conviene verificar el fichero tras cualquier cambio en la estrategia de sync del despliegue.

**Verificación.** IndexNow confirma recepción, no indexación. El efecto real se comprueba en Bing Webmaster Tools (URL Inspection / Site Explorer) a las 24-72 horas. La métrica de cierre de este frente no es el código de respuesta del POST sino que el panel de Bing deje de marcar 0 impresiones.

**Frentes adyacentes que este ADR no cubre.** La otra recomendación del panel de Bing —falta de enlaces entrantes desde dominios de calidad— es un frente de marketing, no de código: corresponde a 6.2.T2 (alternativeto.net) y 6.2.T5 (Reddit orgánico) del backlog.
